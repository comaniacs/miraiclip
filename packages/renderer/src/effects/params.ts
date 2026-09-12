/**
 * Pure parameter math for the built-in effects — headless-testable, shared by
 * the Pixi filter layer. Length-denoting params arrive normalized to
 * composition units (core's schemas enforce it); conversion to pixels happens
 * here against the COMPOSITION size, which both preview and export render at —
 * that identity is what keeps a blur looking the same in both.
 */

export interface ColorAdjustParams {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
}

export interface BlurParams {
  amount: number;
}

export interface ChromaKeyParams {
  color: string;
  similarity: number;
  smoothness: number;
  spill: number;
}

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, value));

/** Defensive read of colorAdjust params (core validated them; clamp anyway). */
export function readColorAdjust(params: Record<string, unknown>): ColorAdjustParams {
  return {
    brightness: clamp(Number(params["brightness"] ?? 0), -1, 1),
    contrast: clamp(Number(params["contrast"] ?? 0), -1, 1),
    saturation: clamp(Number(params["saturation"] ?? 0), -1, 1),
    hue: clamp(Number(params["hue"] ?? 0), -180, 180),
  };
}

/**
 * Map -1..1 adjustments onto the multipliers Pixi's ColorMatrixFilter takes:
 * brightness/saturation scale around 1 (0 → unchanged, -1 → none, 1 → doubled)
 * and contrast takes its own -1..1 style amount (0.x range is usable).
 */
export function colorAdjustSteps(params: Record<string, unknown>): {
  brightness: number;
  contrast: number;
  saturation: number;
  hueDeg: number;
} {
  const p = readColorAdjust(params);
  return {
    brightness: 1 + p.brightness,
    contrast: p.contrast,
    saturation: p.saturation, // ColorMatrixFilter.saturate takes -1..1 around 0
    hueDeg: p.hue,
  };
}

/** Blur amount (fraction of composition height) → pixel strength at render size. */
export function blurStrengthPx(params: Record<string, unknown>, compositionHeightPx: number): number {
  const amount = clamp(Number(params["amount"] ?? 0), 0, 0.25);
  return amount * compositionHeightPx;
}

/** "#rrggbb" → normalized [r, g, b]; invalid input falls back to green-screen green. */
export function hexToRgbNorm(hex: unknown): [number, number, number] {
  const match = typeof hex === "string" ? /^#([0-9a-fA-F]{6})$/.exec(hex) : null;
  const value = match ? parseInt(match[1]!, 16) : 0x00ff00;
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

/** RGB → the chroma plane (Cb, Cr) used for key distance (BT.601, range-free). */
export function rgbToChroma(r: number, g: number, b: number): [number, number] {
  return [-0.169 * r - 0.331 * g + 0.5 * b, 0.5 * r - 0.419 * g - 0.081 * b];
}

export interface ChromaKeyUniforms {
  keyChroma: [number, number];
  similarity: number;
  smoothness: number;
  spill: number;
}

/** Chroma-key params → shader uniforms (key color reduced to its chroma vector). */
export function chromaKeyUniforms(params: Record<string, unknown>): ChromaKeyUniforms {
  const [r, g, b] = hexToRgbNorm(params["color"]);
  const [cb, cr] = rgbToChroma(r, g, b);
  return {
    keyChroma: [cb, cr],
    // similarity is a distance threshold in chroma space; 0.4 default keys a
    // typical green screen. Scaled: max chroma distance is ~0.75.
    similarity: clamp(Number(params["similarity"] ?? 0.4), 0, 1) * 0.4,
    smoothness: clamp(Number(params["smoothness"] ?? 0.1), 0, 1) * 0.4 + 1e-5,
    spill: clamp(Number(params["spill"] ?? 0.1), 0, 1),
  };
}
