/**
 * Kind registries — the extension seam. Built-in effect, transition, and
 * clip kinds are pre-registered here with their Zod param schemas, which is
 * what puts them in the AI command catalog and validates their commands.
 * `register*Kind` lets consumers add custom kinds (the renderer's factory
 * registries are the rendering half of the same seam).
 */
import { z } from "zod";
import type { TrackKind } from "./types.js";

// ---------------------------------------------------------------------------
// Effects — length-denoting params are normalized to composition units
// (fractions of composition height), NEVER absolute pixels: a scaled preview
// and a full-resolution export must render identically.
// ---------------------------------------------------------------------------

const effectSchemas = new Map<string, z.ZodType>();

export const builtinEffectParamSchemas = {
  colorAdjust: z.object({
    /** -1..1, 0 = unchanged. */
    brightness: z.number().min(-1).max(1).default(0),
    contrast: z.number().min(-1).max(1).default(0),
    saturation: z.number().min(-1).max(1).default(0),
    /** Degrees around the color wheel. */
    hue: z.number().min(-180).max(180).default(0),
  }),
  blur: z.object({
    /** Blur radius as a fraction of composition height (resolution-independent). */
    amount: z.number().min(0).max(0.25).default(0.02),
  }),
  chromaKey: z.object({
    /** Key color, hex. */
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#00ff00"),
    /** How close a pixel must be to the key color to become transparent. */
    similarity: z.number().min(0).max(1).default(0.4),
    /** Edge softness of the key. */
    smoothness: z.number().min(0).max(1).default(0.1),
    /** How much green spill to suppress on kept pixels. */
    spill: z.number().min(0).max(1).default(0.1),
  }),
} as const;

for (const [kind, schema] of Object.entries(builtinEffectParamSchemas)) {
  effectSchemas.set(kind, schema);
}

/** Register a custom effect kind's param schema (renderer registers its filter separately). */
export function registerEffectKind(kind: string, paramsSchema: z.ZodType): void {
  if (effectSchemas.has(kind)) throw new Error(`effect kind "${kind}" is already registered`);
  effectSchemas.set(kind, paramsSchema);
}

export function effectParamsSchema(kind: string): z.ZodType | undefined {
  return effectSchemas.get(kind);
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

const transitionSchemas = new Map<string, z.ZodType>();

const direction = z.enum(["left", "right", "up", "down"]).default("left");

export const builtinTransitionParamSchemas = {
  crossDissolve: z.object({}),
  dipToBlack: z.object({}),
  dipToWhite: z.object({}),
  wipe: z.object({ direction }),
  slide: z.object({ direction }),
} as const;

for (const [kind, schema] of Object.entries(builtinTransitionParamSchemas)) {
  transitionSchemas.set(kind, schema);
}

export function registerTransitionKind(kind: string, paramsSchema: z.ZodType): void {
  if (transitionSchemas.has(kind))
    throw new Error(`transition kind "${kind}" is already registered`);
  transitionSchemas.set(kind, paramsSchema);
}

export function transitionParamsSchema(kind: string): z.ZodType | undefined {
  return transitionSchemas.get(kind);
}

// ---------------------------------------------------------------------------
// Custom clip kinds — a registered kind's payload lives under the clip's
// `props`, validated by its schema; the registration declares which track
// kinds accept it. Built-in kinds (video/audio/image/text/caption) are
// handled by clip/add's discriminated union, not this table.
// ---------------------------------------------------------------------------

export interface ClipKindRegistration {
  propsSchema: z.ZodType;
  trackKinds: readonly TrackKind[];
}

const clipKinds = new Map<string, ClipKindRegistration>();

const BUILTIN_CLIP_KINDS = new Set(["video", "audio", "image", "text", "caption", "html"]);

export function registerClipKind(
  kind: string,
  registration: ClipKindRegistration,
): void {
  if (BUILTIN_CLIP_KINDS.has(kind)) throw new Error(`"${kind}" is a built-in clip kind`);
  if (clipKinds.has(kind)) throw new Error(`clip kind "${kind}" is already registered`);
  clipKinds.set(kind, registration);
}

export function clipKindRegistration(kind: string): ClipKindRegistration | undefined {
  return clipKinds.get(kind);
}

export function isBuiltinClipKind(kind: string): boolean {
  return BUILTIN_CLIP_KINDS.has(kind);
}
