/**
 * Kind registries — the extension seam. Built-in effect, transition, and
 * clip kinds are pre-registered here with their Zod param schemas, which is
 * what puts them in the AI command catalog and validates their commands.
 * `register*Kind` lets consumers add custom kinds (the renderer's factory
 * registries are the rendering half of the same seam).
 */
import { z } from "zod";
import type { TrackKind } from "./types.js";
import { EFFECT_CATALOG, type EffectParamInfo } from "./effect-catalog.js";

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

/** A catalog param → its Zod schema (the catalog is the single source of truth). */
function catalogParamSchema(p: EffectParamInfo): z.ZodType {
  if (p.type === "color") {
    return z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default(p.default);
  }
  const n = z.number().min(p.min).max(p.max);
  return (p.format === "int" ? n.int() : n).default(p.default);
}

// The rest of the effect library: schemas derived from EFFECT_CATALOG.
for (const info of EFFECT_CATALOG) {
  if (effectSchemas.has(info.kind)) continue; // hand-written above (colorAdjust, blur, chromaKey)
  effectSchemas.set(
    info.kind,
    z.object(Object.fromEntries(info.params.map((p) => [p.key, catalogParamSchema(p)]))),
  );
}

/**
 * How a registration treats a kind that is already registered:
 * - the SAME schema/registration object again is always a no-op (idempotent —
 *   a plugin loaded twice, a module evaluated twice under HMR);
 * - `replace: true` swaps in the new one (hot reload of a changed kind);
 * - otherwise a different definition throws, so two libraries can't silently
 *   fight over one name. Built-in kinds can never be replaced.
 */
export interface RegisterOptions {
  replace?: boolean;
}

const builtinEffectKinds = new Set<string>();

function registerInto<T>(
  map: Map<string, T>,
  builtins: ReadonlySet<string>,
  what: string,
  kind: string,
  value: T,
  options: RegisterOptions | undefined,
): void {
  const existing = map.get(kind);
  if (existing === undefined) {
    map.set(kind, value);
    return;
  }
  if (existing === value) return; // idempotent
  if (builtins.has(kind)) throw new Error(`"${kind}" is a built-in ${what} kind and can't be replaced`);
  if (!options?.replace) throw new Error(`${what} kind "${kind}" is already registered`);
  map.set(kind, value);
}

function unregisterFrom(map: Map<string, unknown>, builtins: ReadonlySet<string>, what: string, kind: string): boolean {
  if (builtins.has(kind)) throw new Error(`"${kind}" is a built-in ${what} kind and can't be unregistered`);
  return map.delete(kind);
}

/** Register a custom effect kind's param schema (renderer registers its filter separately). */
export function registerEffectKind(kind: string, paramsSchema: z.ZodType, options?: RegisterOptions): void {
  registerInto(effectSchemas, builtinEffectKinds, "effect", kind, paramsSchema, options);
}

/** Remove a custom effect kind (plugin unload, tenant cleanup in a warm worker). Returns whether it existed. */
export function unregisterEffectKind(kind: string): boolean {
  return unregisterFrom(effectSchemas, builtinEffectKinds, "effect", kind);
}

for (const kind of effectSchemas.keys()) builtinEffectKinds.add(kind);

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

const builtinTransitionKinds = new Set<string>(transitionSchemas.keys());

export function registerTransitionKind(kind: string, paramsSchema: z.ZodType, options?: RegisterOptions): void {
  registerInto(transitionSchemas, builtinTransitionKinds, "transition", kind, paramsSchema, options);
}

/** Remove a custom transition kind. Returns whether it existed. */
export function unregisterTransitionKind(kind: string): boolean {
  return unregisterFrom(transitionSchemas, builtinTransitionKinds, "transition", kind);
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
  options?: RegisterOptions,
): void {
  if (BUILTIN_CLIP_KINDS.has(kind)) throw new Error(`"${kind}" is a built-in clip kind`);
  registerInto(clipKinds, BUILTIN_CLIP_KINDS, "clip", kind, registration, options);
}

/** Remove a custom clip kind. Clips of that kind stay in documents as data. Returns whether it existed. */
export function unregisterClipKind(kind: string): boolean {
  return unregisterFrom(clipKinds, BUILTIN_CLIP_KINDS, "clip", kind);
}

export function clipKindRegistration(kind: string): ClipKindRegistration | undefined {
  return clipKinds.get(kind);
}

export function isBuiltinClipKind(kind: string): boolean {
  return BUILTIN_CLIP_KINDS.has(kind);
}
