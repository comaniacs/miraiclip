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

/** Preset names or explicit control points — stored expanded (see resolveEasing). */
export const easingInputSchema = z.union([
  z.enum(["linear", "hold", "easeIn", "easeOut", "easeInOut"]),
  z.object({
    kind: z.literal("bezier"),
    x1: z.number().min(0).max(1),
    y1: z.number(),
    x2: z.number().min(0).max(1),
    y2: z.number(),
  }),
  z.object({ kind: z.literal("hold") }),
]);

export const animatableProperty = z.enum([
  "x",
  "y",
  "scale",
  "rotation",
  "opacity",
  "volume",
]);

export const captionWordSchema = z.object({
  text: z.string().min(1),
  /** Clip-relative. */
  startUs: z.number().int().min(0),
  durationUs: z.number().int().positive(),
});

export const captionStyleSchema = z.object({
  preset: z.enum(["plain", "highlight", "karaoke", "pop"]).default("highlight"),
  fontFamily: z.string().default("sans-serif"),
  /** Fraction of composition height (resolution-independent). */
  fontSizeFrac: z.number().gt(0).max(0.5).default(0.06),
  color: z.string().default("#ffffff"),
  highlightColor: z.string().default("#ffd400"),
  backgroundColor: z.string().optional(),
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
    kind: z.enum(["video", "audio", "image", "font"]),
    src: z.string().min(1),
    durationUs: positiveUs.optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    fps: z.number().positive().optional(),
    /** Font assets: the CSS font-family name clips reference. */
    family: z.string().min(1).optional(),
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

  "clip/add": z.union([
    z.discriminatedUnion("kind", [
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
    z.object({
      kind: z.literal("caption"),
      id,
      trackId: id,
      startUs: us,
      durationUs: positiveUs,
      words: z.array(captionWordSchema).min(1),
      style: captionStyleSchema.prefault({}),
      transform: transformSchema.partial().optional(),
    }),
    z.object({
      kind: z.literal("html"),
      id,
      trackId: id,
      startUs: us,
      durationUs: positiveUs,
      /** HTML markup; {{name}} placeholders substitute from params. */
      template: z.string().min(1),
      params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
      /** Raster size in composition pixels (default: the composition size). */
      widthPx: z.number().int().positive().optional(),
      heightPx: z.number().int().positive().optional(),
      transform: transformSchema.partial().optional(),
    }),
    ]),
    // Custom clip kinds (see registerClipKind): payload under `props`,
    // validated against the kind's registered schema in the handler.
    z.object({
      kind: z
        .string()
        .min(1)
        .refine((k) => !["video", "audio", "image", "text", "caption", "html"].includes(k), {
          message: "built-in kinds use their dedicated payload shape",
        }),
      id,
      trackId: id,
      startUs: us,
      durationUs: positiveUs,
      props: z.record(z.string(), z.unknown()).default({}),
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
    /** html clips: merged into the clip's params (re-rasters the template). */
    params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    clipId: id,
    /** Partial transform update, merged onto the clip's transform. */
    transform: transformSchema.partial().optional(),
    volume: z.number().min(0).optional(),
    text: z.string().optional(),
    fontFamily: z.string().optional(),
    fontSizePx: z.number().positive().optional(),
    color: z.string().optional(),
    /** Caption clips: partial style update, merged onto the clip's style. */
    style: captionStyleSchema.partial().optional(),
  }),

  // --- Animation (v4) ------------------------------------------------------

  "keyframe/set": z.object({
    clipId: id,
    property: animatableProperty,
    /** Clip-relative time (0 = the clip's visible start). */
    timeUs: us,
    value: z.number(),
    /** Curve from this keyframe to the next. Preset name or explicit bézier. */
    easing: easingInputSchema.default("linear"),
  }),
  "keyframe/remove": z.object({ clipId: id, property: animatableProperty, timeUs: us }),
  "keyframe/clear": z.object({
    clipId: id,
    /** Omit to clear every property's keyframes. */
    property: animatableProperty.optional(),
  }),

  // --- Effects (v4) --------------------------------------------------------

  "effect/add": z.object({
    clipId: id,
    /** Registry kind: colorAdjust, blur, chromaKey, or a registered custom kind. */
    kind: z.string().min(1),
    /** Validated against the kind's schema; omitted fields take their defaults. */
    params: z.record(z.string(), z.unknown()).optional(),
    enabled: z.boolean().default(true),
    /** Insertion index in the stack; defaults to the end. */
    index: z.number().int().min(0).optional(),
    /** Supply one for deterministic replay. */
    effectId: id.optional(),
  }),
  "effect/update": z.object({
    clipId: id,
    effectId: id,
    /** Merged onto current params, then re-validated as a whole. */
    params: z.record(z.string(), z.unknown()).optional(),
    enabled: z.boolean().optional(),
  }),
  "effect/remove": z.object({ clipId: id, effectId: id }),
  "effect/reorder": z.object({ clipId: id, effectId: id, index: z.number().int().min(0) }),

  // --- Transitions (v4) ----------------------------------------------------

  "transition/add": z.object({
    /** Supply one for deterministic replay. */
    id: id.optional(),
    /** Registry kind: crossDissolve, dipToBlack, dipToWhite, wipe, slide, or custom. */
    kind: z.string().min(1),
    /** The clip ending at the cut; toClipId starts exactly there, on the same track. */
    fromClipId: id,
    toClipId: id,
    durationUs: positiveUs,
    params: z.record(z.string(), z.unknown()).optional(),
  }),
  "transition/update": z.object({
    transitionId: id,
    durationUs: positiveUs.optional(),
    /** Merged onto current params, then re-validated as a whole. */
    params: z.record(z.string(), z.unknown()).optional(),
  }),
  "transition/remove": z.object({ transitionId: id }),
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
