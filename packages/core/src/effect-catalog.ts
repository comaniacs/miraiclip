/**
 * The built-in effect library: every built-in effect kind's name, category
 * and params, as plain data. One declaration feeds three consumers:
 *
 * - validation — each entry's param schema is derived from it (see registry.ts),
 *   so `effect/add` / `effect/update` validate and fill defaults;
 * - the AI command catalog — kinds and ranges reach LLM tools;
 * - editor UIs — labels, categories, slider ranges and display hints for
 *   property panels and effect pickers (`EFFECT_CATALOG`, `getEffectInfo`).
 *
 * The renderer draws every kind listed here (its shaders are keyed by `kind`).
 * Length params (`length: true`) are fractions of COMPOSITION HEIGHT — never
 * pixels — so a scaled preview and a full-resolution export look identical.
 */

export type EffectCategory = "color" | "film" | "stylize" | "glitch" | "light" | "distort" | "frame";

export const EFFECT_CATEGORIES: readonly { id: EffectCategory; label: string }[] = [
  { id: "color", label: "Color" },
  { id: "film", label: "Film" },
  { id: "stylize", label: "Stylize" },
  { id: "glitch", label: "Glitch & Retro" },
  { id: "light", label: "Blur & Light" },
  { id: "distort", label: "Distort" },
  { id: "frame", label: "Frame & Key" },
];

/** How a UI should display a number param's value. */
export type EffectParamFormat = "percent" | "int" | "deg" | "stops" | "decimal";

export type EffectParamInfo =
  | {
      key: string;
      label: string;
      type: "number";
      min: number;
      max: number;
      step: number;
      default: number;
      format?: EffectParamFormat;
      /** A length: fraction of composition height (resolution-independent). */
      length?: true;
    }
  | { key: string; label: string; type: "color"; /** `#rrggbb` */ default: string };

export interface EffectInfo {
  kind: string;
  label: string;
  category: EffectCategory;
  params: readonly EffectParamInfo[];
}

const num = (
  key: string,
  label: string,
  min: number,
  max: number,
  def: number,
  step: number,
  format?: EffectParamFormat,
): EffectParamInfo => ({ key, label, type: "number", min, max, step, default: def, ...(format ? { format } : {}) });
const len = (key: string, label: string, min: number, max: number, def: number): EffectParamInfo => ({
  key,
  label,
  type: "number",
  min,
  max,
  step: 0.0005,
  default: def,
  format: "percent",
  length: true,
});
const color = (key: string, label: string, def: string): EffectParamInfo => ({ key, label, type: "color", default: def });
/** The standard 0–1 intensity (blend with the unaffected image). */
const I = (def = 1): EffectParamInfo => num("intensity", "Intensity", 0, 1, def, 0.01, "percent");
/** Static effects that look random take a seed (effects have no time input). */
const seed: EffectParamInfo = num("seed", "Seed", 0, 100, 7, 1, "int");

/** Every built-in effect kind, grouped by category (catalog order = picker order). */
export const EFFECT_CATALOG: readonly EffectInfo[] = [
  // Color
  { kind: "colorAdjust", label: "Color Adjust", category: "color", params: [num("brightness", "Brightness", -1, 1, 0, 0.01, "percent"), num("contrast", "Contrast", -1, 1, 0, 0.01, "percent"), num("saturation", "Saturation", -1, 1, 0, 0.01, "percent"), num("hue", "Hue", -180, 180, 0, 1, "deg")] },
  { kind: "mono", label: "Black & White", category: "color", params: [I()] },
  { kind: "invert", label: "Invert", category: "color", params: [I()] },
  { kind: "warm", label: "Warm", category: "color", params: [I()] },
  { kind: "cool", label: "Cool", category: "color", params: [I()] },
  { kind: "hueShift", label: "Hue Shift", category: "color", params: [num("hue", "Hue", -180, 180, 90, 1, "deg")] },
  { kind: "vibrance", label: "Vibrance", category: "color", params: [num("amount", "Amount", 0, 1, 0.5, 0.01, "percent")] },
  { kind: "exposure", label: "Exposure", category: "color", params: [num("stops", "Exposure", -2, 2, 0.5, 0.05, "stops")] },
  { kind: "contrastCurve", label: "Contrast Curve", category: "color", params: [I(0.7)] },
  { kind: "gamma", label: "Gamma", category: "color", params: [num("gamma", "Gamma", 0.3, 3, 1.4, 0.01, "decimal")] },
  { kind: "channelSwap", label: "Channel Swap", category: "color", params: [I()] },
  { kind: "duotone", label: "Duotone", category: "color", params: [I(), color("shadow", "Shadows", "#1e1b4b"), color("highlight", "Highlights", "#f472b6")] },
  { kind: "gradientMap", label: "Gradient Map", category: "color", params: [I(), color("dark", "Dark", "#0f172a"), color("mid", "Mid", "#e11d48"), color("light", "Light", "#fde68a")] },
  { kind: "colorPop", label: "Color Pop", category: "color", params: [I(), color("color", "Keep color", "#ef4444"), num("tolerance", "Tolerance", 0.01, 0.5, 0.08, 0.01, "percent")] },
  { kind: "solarize", label: "Solarize", category: "color", params: [I(), num("threshold", "Threshold", 0, 1, 0.5, 0.01, "percent")] },
  { kind: "threshold", label: "Threshold", category: "color", params: [num("threshold", "Threshold", 0, 1, 0.5, 0.01, "percent")] },
  { kind: "posterize", label: "Posterize", category: "color", params: [num("levels", "Levels", 2, 12, 4, 1, "int")] },

  // Film
  { kind: "sepia", label: "Sepia", category: "film", params: [I()] },
  { kind: "vintage", label: "Vintage", category: "film", params: [I(0.8)] },
  { kind: "polaroid", label: "Polaroid", category: "film", params: [I()] },
  { kind: "kodachrome", label: "Kodachrome", category: "film", params: [I()] },
  { kind: "technicolor", label: "Technicolor", category: "film", params: [I()] },
  { kind: "thermal", label: "Thermal", category: "film", params: [I()] },
  { kind: "grain", label: "Film Grain", category: "film", params: [I(0.3)] },
  { kind: "tealOrange", label: "Teal & Orange", category: "film", params: [I()] },
  { kind: "noir", label: "Noir", category: "film", params: [I()] },
  { kind: "bleachBypass", label: "Bleach Bypass", category: "film", params: [I()] },
  { kind: "crossProcess", label: "Cross Process", category: "film", params: [I()] },
  { kind: "faded", label: "Faded", category: "film", params: [I()] },
  { kind: "matte", label: "Matte", category: "film", params: [I()] },
  { kind: "goldenHour", label: "Golden Hour", category: "film", params: [I()] },
  { kind: "moonlight", label: "Moonlight", category: "film", params: [I()] },
  { kind: "cyberpunk", label: "Cyberpunk", category: "film", params: [I()] },
  { kind: "vaporwave", label: "Vaporwave", category: "film", params: [I()] },
  { kind: "cyanotype", label: "Cyanotype", category: "film", params: [I()] },
  { kind: "infrared", label: "Infrared", category: "film", params: [I()] },
  { kind: "lomo", label: "Lomo", category: "film", params: [I()] },
  { kind: "nightVision", label: "Night Vision", category: "film", params: [I()] },

  // Stylize
  { kind: "pixelate", label: "Pixelate", category: "stylize", params: [len("size", "Block size", 0.0023, 0.0338, 0.0113)] },
  { kind: "halftone", label: "Halftone", category: "stylize", params: [len("size", "Dot size", 0.0023, 0.0281, 0.0068)] },
  { kind: "dotMatrix", label: "LED Matrix", category: "stylize", params: [len("size", "Cell size", 0.0023, 0.0281, 0.0068)] },
  { kind: "crosshatch", label: "Crosshatch", category: "stylize", params: [len("spacing", "Spacing", 0.0011, 0.0113, 0.0034)] },
  { kind: "neonEdges", label: "Neon Edges", category: "stylize", params: [I(), color("color", "Color", "#22d3ee")] },
  { kind: "sketch", label: "Pencil Sketch", category: "stylize", params: [I()] },
  { kind: "emboss", label: "Emboss", category: "stylize", params: [I()] },
  { kind: "sharpen", label: "Sharpen", category: "stylize", params: [num("amount", "Amount", 0, 2, 0.8, 0.01, "decimal")] },
  { kind: "toon", label: "Cartoon", category: "stylize", params: [I()] },
  { kind: "oilPaint", label: "Oil Paint", category: "stylize", params: [len("brush", "Brush", 0.0003, 0.0034, 0.0008)] },
  { kind: "hexPixelate", label: "Hex Mosaic", category: "stylize", params: [len("size", "Cell size", 0.0023, 0.0338, 0.0101)] },
  { kind: "retro8bit", label: "8-Bit", category: "stylize", params: [len("size", "Pixel size", 0.0017, 0.0225, 0.0068)] },
  { kind: "dither", label: "Dither", category: "stylize", params: [I(), num("levels", "Levels", 2, 8, 3, 1, "int"), len("scale", "Scale", 0.0003, 0.0034, 0.0008)] },
  { kind: "frostedGlass", label: "Frosted Glass", category: "stylize", params: [len("amount", "Amount", 0.0006, 0.0113, 0.0034)] },

  // Glitch & Retro
  { kind: "rgbSplit", label: "RGB Split", category: "glitch", params: [len("amount", "Offset", 0, 0.0169, 0.0045)] },
  { kind: "scanlines", label: "Scanlines", category: "glitch", params: [I(0.5), len("spacing", "Spacing", 0.0011, 0.0113, 0.0023)] },
  { kind: "crt", label: "CRT", category: "glitch", params: [num("curve", "Curvature", 0, 1, 0.5, 0.01, "percent")] },
  { kind: "vhs", label: "VHS", category: "glitch", params: [I(0.6), seed] },
  { kind: "glitch", label: "Glitch", category: "glitch", params: [I(0.5), seed] },
  { kind: "tvStatic", label: "TV Static", category: "glitch", params: [I(0.35), seed] },
  { kind: "lensFringe", label: "Lens Fringe", category: "glitch", params: [num("amount", "Amount", 0, 0.05, 0.008, 0.0005, "percent")] },

  // Blur & Light
  { kind: "blur", label: "Blur", category: "light", params: [len("amount", "Amount", 0, 0.25, 0.02)] },
  { kind: "vignette", label: "Vignette", category: "light", params: [I(0.6), num("size", "Size", 0, 1, 0.5, 0.01, "percent")] },
  { kind: "glow", label: "Glow", category: "light", params: [I(0.6), len("radius", "Radius", 0.0011, 0.0225, 0.0068), num("threshold", "Threshold", 0, 1, 0.55, 0.01, "percent")] },
  { kind: "dreamy", label: "Dreamy", category: "light", params: [I(0.6), len("radius", "Softness", 0.0011, 0.0225, 0.0068)] },
  { kind: "tiltShift", label: "Tilt Shift", category: "light", params: [len("blur", "Blur", 0.0011, 0.0169, 0.0056), num("focus", "Focus line", 0, 1, 0.5, 0.01, "percent"), num("band", "Focus band", 0, 1, 0.25, 0.01, "percent")] },
  { kind: "zoomBlur", label: "Zoom Blur", category: "light", params: [num("amount", "Amount", 0, 0.3, 0.08, 0.005, "percent")] },
  { kind: "motionBlur", label: "Motion Blur", category: "light", params: [len("distance", "Distance", 0, 0.045, 0.0113), num("angle", "Angle", -180, 180, 0, 1, "deg")] },
  { kind: "colorVignette", label: "Color Vignette", category: "light", params: [I(0.8), color("color", "Color", "#7c3aed"), num("size", "Size", 0, 1, 0.5, 0.01, "percent")] },
  { kind: "lightLeak", label: "Light Leak", category: "light", params: [I(0.8), color("color", "Color", "#ff7a18")] },

  // Distort
  { kind: "fisheye", label: "Fisheye", category: "distort", params: [num("strength", "Strength", 0, 1.5, 0.6, 0.01, "percent")] },
  { kind: "pinch", label: "Pinch", category: "distort", params: [num("strength", "Strength", 0, 1.5, 0.6, 0.01, "percent")] },
  { kind: "swirl", label: "Swirl", category: "distort", params: [num("angle", "Angle", -720, 720, 180, 1, "deg"), num("radius", "Radius", 0.05, 1, 0.5, 0.01, "percent")] },
  { kind: "wave", label: "Wave", category: "distort", params: [num("amplitude", "Amplitude", 0, 0.05, 0.015, 0.001, "percent"), num("frequency", "Frequency", 1, 30, 8, 0.5, "decimal")] },
  { kind: "ripple", label: "Ripple", category: "distort", params: [num("amplitude", "Amplitude", 0, 0.03, 0.01, 0.001, "percent"), num("frequency", "Frequency", 2, 60, 20, 1, "int")] },
  { kind: "mirrorX", label: "Mirror ↔", category: "distort", params: [] },
  { kind: "mirrorY", label: "Mirror ↕", category: "distort", params: [] },
  { kind: "kaleidoscope", label: "Kaleidoscope", category: "distort", params: [num("segments", "Segments", 2, 16, 6, 1, "int"), num("rotation", "Rotation", -180, 180, 0, 1, "deg")] },

  // Frame & Key
  { kind: "chromaKey", label: "Green Screen", category: "frame", params: [color("color", "Key color", "#00ff00"), num("similarity", "Similarity", 0, 1, 0.4, 0.01, "percent"), num("smoothness", "Smoothness", 0, 1, 0.1, 0.01, "percent"), num("spill", "Spill", 0, 1, 0.1, 0.01, "percent")] },
  { kind: "letterbox", label: "Letterbox", category: "frame", params: [num("size", "Bar height", 0, 0.3, 0.12, 0.005, "percent")] },
  { kind: "roundedCorners", label: "Rounded Corners", category: "frame", params: [num("radius", "Radius", 0, 0.5, 0.08, 0.005, "percent")] },
];

const byKind = new Map(EFFECT_CATALOG.map((e) => [e.kind, e]));

/** Editor/UI metadata for a built-in effect kind (undefined for custom kinds). */
export function getEffectInfo(kind: string): EffectInfo | undefined {
  return byKind.get(kind);
}

/** A kind's default params — what `effect/add` fills in when params are omitted. */
export function defaultEffectParams(kind: string): Record<string, number | string> | undefined {
  const info = byKind.get(kind);
  return info && Object.fromEntries(info.params.map((p) => [p.key, p.default]));
}
