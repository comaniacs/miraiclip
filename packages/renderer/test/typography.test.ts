import { describe, expect, it } from "vitest";
import { createProject, type CaptionClip, type ProjectDocument, type TextClip } from "@miraiclip/core";
import { loadFontAssets, type FontEnv } from "../src/captions/fonts.js";
import { captionMetrics, captionWordStyle, textClipStyle } from "../src/text/typography.js";

function docWith(build: (p: ReturnType<typeof createProject>) => void): ProjectDocument {
  const project = createProject({ width: 1000, height: 1000, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
  build(project);
  return project.getState().doc;
}

const textClip = (extra: Record<string, unknown> = {}) =>
  docWith((p) =>
    p.dispatch({
      type: "clip/add",
      payload: { kind: "text", id: "t", trackId: "v1", startUs: 0, durationUs: 1_000_000, text: "A\nB", fontSizePx: 40, ...extra },
    } as never),
  ).clips["t"] as TextClip;

const captionClip = (style: Record<string, unknown> = {}) =>
  docWith((p) =>
    p.dispatch({
      type: "clip/add",
      payload: {
        kind: "caption", id: "c", trackId: "v1", startUs: 0, durationUs: 1_000_000,
        words: [{ text: "hi", startUs: 0, durationUs: 500_000 }], style,
      },
    } as never),
  ).clips["c"] as CaptionClip;

describe("text clip style", () => {
  it("untouched clips produce exactly the pre-typography style (no extra keys)", () => {
    expect(textClipStyle(textClip())).toEqual({ fontFamily: "sans-serif", fontSize: 40, fill: "#ffffff" });
  });

  it("maps weight/style/align and converts lineHeight (× size) and letterSpacing (em) to px", () => {
    const style = textClipStyle(
      textClip({ fontWeight: 700, fontStyle: "italic", lineHeight: 1.5, letterSpacing: 0.1, textAlign: "center" }),
    );
    expect(style).toEqual({
      fontFamily: "sans-serif", fontSize: 40, fill: "#ffffff",
      fontWeight: "700", fontStyle: "italic", lineHeight: 60, letterSpacing: 4, align: "center",
    });
  });

  it("negative letter spacing tightens", () => {
    expect(textClipStyle(textClip({ letterSpacing: -0.05 })).letterSpacing).toBe(-2);
  });
});

describe("caption styles", () => {
  it("default metrics match the pre-typography layout (1.3 line height, 0.33em space)", () => {
    const clip = captionClip();
    // Same expressions the layout used before (fontSize × 1.3, × 0.33) — bit-identical.
    expect(captionMetrics(clip.style, 50)).toEqual({ lineHeightPx: 50 * 1.3, spaceWidthPx: 50 * 0.33 });
    expect(captionWordStyle(clip.style, 50)).toEqual({ fontFamily: "sans-serif", fontSize: 50, fill: "#ffffff" });
  });

  it("weight/style/spacing reach every word; lineHeight drives layout, not the word", () => {
    const clip = captionClip({ fontWeight: 900, fontStyle: "italic", lineHeight: 1.1, letterSpacing: 0.2 });
    const word = captionWordStyle(clip.style, 50);
    expect(word).toMatchObject({ fontWeight: "900", fontStyle: "italic", letterSpacing: 10 });
    expect("lineHeight" in word).toBe(false);
    const metrics = captionMetrics(clip.style, 50);
    expect(metrics.lineHeightPx).toBeCloseTo(55);
    expect(metrics.spaceWidthPx).toBeCloseTo(26.5);
  });
});

describe("font faces with descriptors", () => {
  it("passes weight/style to FontFace and loads each face of a family separately", async () => {
    const doc = docWith((p) => {
      p.dispatch({ type: "asset/add", payload: { id: "r", kind: "font", src: "/typo-R.woff2", family: "Typo" } });
      p.dispatch({ type: "asset/add", payload: { id: "b", kind: "font", src: "/typo-B.woff2", family: "Typo", weight: 700 } });
      p.dispatch({ type: "asset/add", payload: { id: "i", kind: "font", src: "/typo-I.woff2", family: "Typo", style: "italic" } });
    });
    const created: unknown[] = [];
    const env: FontEnv = {
      available: true,
      createFace: (family, src, descriptors) => {
        created.push({ family, src, descriptors });
        return { load: () => Promise.resolve() };
      },
      addFace: () => {},
    };
    expect(await loadFontAssets(doc, env)).toBe(true);
    expect(created).toEqual([
      { family: "Typo", src: "/typo-R.woff2", descriptors: {} },
      { family: "Typo", src: "/typo-B.woff2", descriptors: { weight: "700" } },
      { family: "Typo", src: "/typo-I.woff2", descriptors: { style: "italic" } },
    ]);
  });
});
