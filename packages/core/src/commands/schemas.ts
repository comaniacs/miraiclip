import { z } from "zod";

const id = z.string().min(1);
const us = z.number().int().min(0);
const positiveUs = z.number().int().positive();

export const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number().positive(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
});

// ---------------------------------------------------------------------------
// Payload schemas — one per built-in command.
// ---------------------------------------------------------------------------

export const builtinPayloadSchemas = {
  "project/set-settings": z.object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    fps: z.number().positive().optional(),
    name: z.string().optional(),
  }),

  "asset/add": z.object({
    id,
    kind: z.enum(["video", "audio", "image"]),
    src: z.string().min(1),
    durationUs: positiveUs.optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    fps: z.number().positive().optional(),
  }),
  "asset/remove": z.object({ id }),

  "track/add": z.object({
    id,
    kind: z.enum(["video", "audio"]),
    name: z.string().optional(),
    /** Insertion index in trackOrder; defaults to top. */
    index: z.number().int().min(0).optional(),
  }),
  "track/remove": z.object({ id }),
  "track/reorder": z.object({ trackId: id, index: z.number().int().min(0) }),
  "track/rename": z.object({ trackId: id, name: z.string().min(1) }),
  "track/set-property": z.object({
    trackId: id,
    muted: z.boolean().optional(),
    solo: z.boolean().optional(),
    locked: z.boolean().optional(),
  }),

  "clip/add": z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("video"),
      id,
      trackId: id,
      assetId: id,
      startUs: us,
      durationUs: positiveUs,
      trimStartUs: us.default(0),
      volume: z.number().min(0).default(1),
      transform: transformSchema.partial().optional(),
    }),
    z.object({
      kind: z.literal("audio"),
      id,
      trackId: id,
      assetId: id,
      startUs: us,
      durationUs: positiveUs,
      trimStartUs: us.default(0),
      volume: z.number().min(0).default(1),
      transform: transformSchema.partial().optional(),
    }),
    z.object({
      kind: z.literal("image"),
      id,
      trackId: id,
      assetId: id,
      startUs: us,
      durationUs: positiveUs,
      transform: transformSchema.partial().optional(),
    }),
    z.object({
      kind: z.literal("text"),
      id,
      trackId: id,
      startUs: us,
      durationUs: positiveUs,
      text: z.string(),
      fontFamily: z.string().default("sans-serif"),
      fontSizePx: z.number().positive().default(48),
      color: z.string().default("#ffffff"),
      transform: transformSchema.partial().optional(),
    }),
  ]),
  "clip/remove": z.object({ clipId: id }),
  "clip/move": z.object({
    clipId: id,
    startUs: us.optional(),
    trackId: id.optional(),
  }),
  "clip/trim": z.object({
    clipId: id,
    /** New timeline placement after trimming. */
    startUs: us.optional(),
    durationUs: positiveUs.optional(),
    /** New source offset (video/audio clips). */
    trimStartUs: us.optional(),
  }),
  "clip/split": z.object({
    clipId: id,
    /** Absolute timeline position to cut at; must fall inside the clip. */
    atUs: positiveUs,
    /** Id for the right-hand clip. Supply one for deterministic replay. */
    newClipId: id.optional(),
  }),
  "clip/duplicate": z.object({
    clipId: id,
    /** Id for the copy. Supply one for deterministic replay. */
    newClipId: id.optional(),
    startUs: us.optional(),
    trackId: id.optional(),
  }),
  "clip/set-property": z.object({
    clipId: id,
    /** Partial transform update, merged onto the clip's transform. */
    transform: transformSchema.partial().optional(),
    volume: z.number().min(0).optional(),
    text: z.string().optional(),
    fontFamily: z.string().optional(),
    fontSizePx: z.number().positive().optional(),
    color: z.string().optional(),
  }),
} as const;

export type BuiltinCommandType = keyof typeof builtinPayloadSchemas;

export type BuiltinCommandPayload<T extends BuiltinCommandType> = z.input<
  (typeof builtinPayloadSchemas)[T]
>;

/** A built-in command as dispatched. */
export type BuiltinCommand = {
  [T in BuiltinCommandType]: { type: T; payload: BuiltinCommandPayload<T> };
}[BuiltinCommandType];

export interface Command {
  type: string;
  payload: unknown;
}

/**
 * The machine-readable command catalog: one JSON Schema per command type.
 * Suitable for handing to an LLM as tool definitions.
 */
export function commandCatalog(
  extra: Record<string, z.ZodType> = {},
): Record<string, unknown> {
  const catalog: Record<string, unknown> = {};
  for (const [type, schema] of Object.entries({ ...builtinPayloadSchemas, ...extra })) {
    catalog[type] = z.toJSONSchema(schema, { io: "input" });
  }
  return catalog;
}
