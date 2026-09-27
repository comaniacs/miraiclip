/**
 * Core typography → Pixi text style. Pure, so preview, browser/worker export,
 * stills, and server export all derive identical styles from the document.
 *
 * Absent fields add NO keys: Pixi then applies its own defaults, which is
 * exactly how clips rendered before typography existed (golden frames hold).
 */
import { TYPOGRAPHY_DEFAULTS, type CaptionStyle, type TextClip, type Typography } from "@miraiclip/core";

/** The subset of Pixi's TextStyleOptions this module writes. */
export interface PixiTypographyStyle {
  fontFamily: string;
  fontSize: number;
  fill: string;
  fontWeight?: "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  fontStyle?: "normal" | "italic";
  /** Pixels (core stores a multiple of font size). */
  lineHeight?: number;
  /** Pixels (core stores em). */
  letterSpacing?: number;
  align?: "left" | "center" | "right";
}

function applyTypography(style: PixiTypographyStyle, t: Typography, fontSizePx: number): void {
  if (t.fontWeight !== undefined) style.fontWeight = String(t.fontWeight) as NonNullable<PixiTypographyStyle["fontWeight"]>;
  if (t.fontStyle !== undefined) style.fontStyle = t.fontStyle;
  if (t.lineHeight !== undefined) style.lineHeight = t.lineHeight * fontSizePx;
  if (t.letterSpacing !== undefined) style.letterSpacing = t.letterSpacing * fontSizePx;
}

export function textClipStyle(clip: TextClip): PixiTypographyStyle {
  const style: PixiTypographyStyle = {
    fontFamily: clip.fontFamily,
    fontSize: clip.fontSizePx,
    fill: clip.color,
  };
  applyTypography(style, clip, clip.fontSizePx);
  if (clip.textAlign !== undefined) style.align = clip.textAlign;
  return style;
}

/**
 * One caption word's style. `lineHeight` is deliberately NOT set on the word
 * (each word is a single line) — it drives the layout's line stacking instead,
 * via `captionMetrics`.
 */
export function captionWordStyle(style: CaptionStyle, fontSizePx: number): PixiTypographyStyle {
  const out: PixiTypographyStyle = { fontFamily: style.fontFamily, fontSize: fontSizePx, fill: style.color };
  const { lineHeight: _layoutOnly, ...wordTypography } = style;
  applyTypography(out, wordTypography, fontSizePx);
  return out;
}

/** Layout metrics for a caption block at a given font size. */
export function captionMetrics(style: CaptionStyle, fontSizePx: number): { lineHeightPx: number; spaceWidthPx: number } {
  const lineHeight = style.lineHeight ?? TYPOGRAPHY_DEFAULTS.captionLineHeight;
  // Letter spacing applies to the space glyph too (as in CSS), so word gaps widen with it.
  const spacingPx = (style.letterSpacing ?? 0) * fontSizePx;
  return { lineHeightPx: fontSizePx * lineHeight, spaceWidthPx: fontSizePx * 0.33 + spacingPx };
}

/** `@font-face` descriptors for a font asset — only what the asset declares. */
export function fontFaceDescriptors(asset: { weight?: number; style?: string }): { weight?: string; style?: string } {
  const d: { weight?: string; style?: string } = {};
  if (asset.weight !== undefined) d.weight = String(asset.weight);
  if (asset.style !== undefined) d.style = asset.style;
  return d;
}
