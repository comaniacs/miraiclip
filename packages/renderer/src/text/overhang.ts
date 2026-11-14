import type { PixiTypographyStyle } from "./typography.js";

/**
 * Pixi draws a text clip onto a canvas sized from the font's nominal metrics (the advance widths
 * and the line's ascent and descent). Script and display faces draw outside that box: a swash
 * starts left of the origin, a tail runs past the advance, a descender dips below the line. That
 * part was cut off. This measures how far the real glyphs reach past the box, in px, so the
 * text's padding can cover it.
 *
 * It asks the 2D canvas for the glyphs' actual bounding boxes, so it needs the font to be loaded
 * (the caller measures again whenever the clip updates) and a canvas to measure on; without one
 * (Node) it answers 0 and nothing changes. Faces that stay inside their box answer 0 too, so
 * documents that never needed it keep their layout and golden frames.
 */
let ctx: { font: string; letterSpacing?: string; measureText(t: string): TextMetrics } | null | undefined;

function context() {
  if (ctx !== undefined) return ctx;
  try {
    ctx =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(1, 1).getContext("2d")
        : typeof document !== "undefined"
          ? document.createElement("canvas").getContext("2d")
          : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

export function glyphOverhangPx(style: PixiTypographyStyle, text: string): number {
  const c = context();
  if (!c || !text) return 0;
  const weight = style.fontWeight ?? "400";
  const slant = style.fontStyle === "italic" ? "italic " : "";
  const family = style.fontFamily.includes(",") || style.fontFamily.includes('"') ? style.fontFamily : `"${style.fontFamily}"`;
  c.font = `${slant}${weight} ${style.fontSize}px ${family}`;
  if (style.letterSpacing && "letterSpacing" in c) c.letterSpacing = `${style.letterSpacing}px`;
  let over = 0;
  for (const line of text.split("\n")) {
    if (!line) continue;
    const m = c.measureText(line);
    over = Math.max(
      over,
      m.actualBoundingBoxLeft, // glyphs left of the origin
      m.actualBoundingBoxRight - m.width, // glyphs past the advance
      m.actualBoundingBoxDescent - m.fontBoundingBoxDescent,
      m.actualBoundingBoxAscent - m.fontBoundingBoxAscent,
    );
  }
  return over > 0.5 ? Math.ceil(over) : 0;
}
