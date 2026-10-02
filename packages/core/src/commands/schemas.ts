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

export const keyframeAnchor = z.enum(["start", "end"]);

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

// --- Typography (optional everywhere; absent = TYPOGRAPHY_DEFAULTS) ---------
// No `.default()`s: parsing must not write keys nobody set, so existing
// documents serialize byte-identically and describeProject stays compact.

/** CSS weight, 100–900 in steps of 100 (static faces; variable-font ranges are a later addition). */
export const fontWeightSchema = z.number().int().min(100).max(900).multipleOf(100);
export const fontStyleSchema = z.enum(["normal", "italic"]);
export const textAlignSchema = z.enum(["left", "center", "right"]);
/** Multiple of font size. */
export const lineHeightSchema = z.number().gt(0).max(5);
/** em — scales with font size, so preview and export agree at any density. */
export const letterSpacingSchema = z.number().min(-0.5).max(2);

export const typographyFields = {
  /** 100–900 in steps of 100 (default 400). */
  fontWeight: fontWeightSchema.optional(),
  /** Default "normal". */
  fontStyle: fontStyleSchema.optional(),
  /** Multiple of font size (default: font's natural line height; captions 1.3). */
  lineHeight: lineHeightSchema.optional(),
  /** em (default 0). */
  letterSpacing: letterSpacingSchema.optional(),
};

/** set-property shape: `null` clears a field back to its default. */
const typographyPatchFields = {
  fontWeight: fontWeightSchema.nullable().optional(),
  fontStyle: fontStyleSchema.nullable().optional(),
  lineHeight: lineHeightSchema.nullable().optional(),
  letterSpacing: letterSpacingSchema.nullable().optional(),
};

// Optional caption decorations — absent keys keep documents byte-identical.
const captionDecorationFields = {
  /** Box behind the whole caption block. */
  backgroundColor: z.string(),
  /** `word`: show only the active word (word-by-word). Default `block`. */
  display: z.enum(["block", "word"]),
  /** Case transform when drawing; the words keep their text. */
  textTransform: z.enum(["uppercase", "lowercase"]),
  /** Outline color; width = strokeWidthFrac × font size. */
  strokeColor: z.string(),
  strokeWidthFrac: z.number().min(0).max(0.3),
  /** Drop shadow / glow (offset 0 = glow). Fractions of font size. */
  shadowColor: z.string(),
  shadowBlurFrac: z.number().min(0).max(1),
  shadowOffsetFrac: z.number().min(0).max(0.5),
  /** Rounded box behind each emphasized word. */
  activeBackgroundColor: z.string(),
};
type DecorationKey = keyof typeof captionDecorationFields;
const optionalDecorations = Object.fromEntries(
  Object.entries(captionDecorationFields).map(([k, v]) => [k, v.optional()]),
) as { [K in DecorationKey]: z.ZodOptional<(typeof captionDecorationFields)[K]> };
const clearableDecorations = Object.fromEntries(
  Object.entries(captionDecorationFields).map(([k, v]) => [k, v.nullable().optional()]),
) as { [K in DecorationKey]: z.ZodOptional<z.ZodNullable<(typeof captionDecorationFields)[K]>> };

export const captionStyleSchema = z.object({
  preset: z.enum(["plain", "highlight", "karaoke", "pop", "reveal"]).default("highlight"),
  fontFamily: z.string().default("sans-serif"),
  /** Fraction of composition height (resolution-independent). */
  fontSizeFrac: z.number().gt(0).max(0.5).default(0.06),
  color: z.string().default("#ffffff"),
  highlightColor: z.string().default("#ffd400"),
  ...optionalDecorations,
  ...typographyFields,
});

/**
 * clip/set-property `style`: partial merge; typography fields and the
 * optional decorations (background, outline, shadow, …) accept `null` to clear.
 */
export const captionStylePatchSchema = z.object({
  preset: z.enum(["plain", "highlight", "karaoke", "pop", "reveal"]).optional(),
  fontFamily: z.string().optional(),
  fontSizeFrac: z.number().gt(0).max(0.5).optional(),
  color: z.string().optional(),
  highlightColor: z.string().optional(),
  ...clearableDecorations,
  ...typographyPatchFields,
});

// ---------------------------------------------------------------------------
// Payload schemas — one per built-in command.
// ---------------------------------------------------------------------------

// --- Asset provenance (optional) -------------------------------------------
export const assetSourceSchema = z.object({
  provider: z.string().min(1),
  id: z.string(),
  url: z.string().url().optional(),
});
export const assetLicenseSchema = z.object({
  id: z.string().min(1),
  url: z.string().url().optional(),
  commercial: z.boolean(),
  attributionRequired: z.boolean(),
});
const fadeUs = z.number().int().min(0);

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
    /** Font assets: this face's weight (default 400). Load one asset per weight/style. */
    weight: fontWeightSchema.optional(),
    /** Font assets: this face's style (default "normal"). */
    style: fontStyleSchema.optional(),
    /** Font assets: a variable font's weight axis range, e.g. [100, 900] (min ≤ max). */
    weightRange: z.tuple([fontWeightSchema, fontWeightSchema]).refine(([a, b]) => a <= b, "weightRange min must be ≤ max").optional(),
    /** Display name (e.g. a stock track's title). */
    name: z.string().min(1).optional(),
    /** Provenance: where the asset came from. */
    source: assetSourceSchema.optional(),
    /** The terms it may be used under. */
    license: assetLicenseSchema.optional(),
    /** Credit line to show when the license requires it. */
    attribution: z.string().min(1).optional(),
  }),
  "asset/remove": z.object({ id }),
  "asset/set-property": z.object({
    id,
    /** Each field: a value sets it, `null` clears it. */
    name: z.string().min(1).nullable().optional(),
    source: assetSourceSchema.nullable().optional(),
    license: assetLicenseSchema.nullable().optional(),
    attribution: z.string().min(1).nullable().optional(),
  }),

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
    /** Hide the track's clips from rendering (false clears it). */
    hidden: z.boolean().optional(),
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
      /** Linear fade-in from the clip's start. */
      fadeInUs: fadeUs.optional(),
      /** Linear fade-out to the clip's end. */
      fadeOutUs: fadeUs.optional(),
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
      /** Linear fade-in from the clip's start. */
      fadeInUs: fadeUs.optional(),
      /** Linear fade-out to the clip's end. */
      fadeOutUs: fadeUs.optional(),
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
      ...typographyFields,
      /** Alignment of lines within the block (default "left"); independent of the anchor. */
      textAlign: textAlignSchema.optional(),
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
    /** Video/audio clips: edge fades; `null` removes. */
    fadeInUs: fadeUs.nullable().optional(),
    fadeOutUs: fadeUs.nullable().optional(),
    text: z.string().optional(),
    fontFamily: z.string().optional(),
    fontSizePx: z.number().positive().optional(),
    color: z.string().optional(),
    /** Text clips. `null` clears back to the default. */
    ...typographyPatchFields,
    /** Text clips. `null` clears back to the default. */
    textAlign: textAlignSchema.nullable().optional(),
    /** Caption clips: partial style update, merged onto the clip's style; typography fields accept `null` to clear. */
    style: captionStylePatchSchema.optional(),
    /** Caption clips: replace the words (clip-relative timing, e.g. after a transcript edit or translation). */
    words: z.array(captionWordSchema).min(1).optional(),
  }),

  // --- Animation (v4) ------------------------------------------------------

  "keyframe/set": z.object({
    clipId: id,
    property: animatableProperty,
    /** Clip-relative time (0 = the clip's visible start; with anchor "end", time back from the visible end). */
    timeUs: us,
    /** "end" measures timeUs back from the clip's end, so the keyframe follows trims of the end. Default "start". */
    anchor: keyframeAnchor.optional(),
    value: z.number(),
    /** Curve from this keyframe to the next. Preset name or explicit bézier. */
    easing: easingInputSchema.default("linear"),
  }),
  "keyframe/remove": z.object({ clipId: id, property: animatableProperty, timeUs: us, anchor: keyframeAnchor.optional() }),
  "keyframe/clear": z.object({
    clipId: id,
    /** Omit to clear every property's keyframes. */
    property: animatableProperty.optional(),
  }),

  // --- Effects (v4) --------------------------------------------------------

  "effect/add": z.object({
    clipId: id,
    /** Registry kind: any built-in in EFFECT_CATALOG (colorAdjust, blur, chromaKey, sepia, vignette, …) or a registered custom kind. */
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
