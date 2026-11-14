/**
 * Vector PDF support (Kagura B7.13a): `describeStillText` reports each text clip's lines
 * where the compositor draws them, and `renderProjectStill({ omitClipIds })` draws a page
 * without them. Checked in Chromium: the lines drawn straight on a 2D canvas with the
 * described matrix cover the same pixels as the compositor's own text.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { afterAll, describe, expect, it } from "vitest";
import { browser } from "./harness.js";

const here = dirname(fileURLToPath(import.meta.url));
const renderer = join(here, "../..");
const FONT = readFileSync(join(here, "../fixtures/fonts/PassionsConflict-Regular.ttf")).toString("base64");

afterAll(async () => (await browser())?.close());

const ENTRY = `
import { createProject } from "@miraiclip/core";
import { describeStillText, renderProjectStill } from ${JSON.stringify(join(renderer, "src/index.ts"))};

const FONT_B64 = ${JSON.stringify(FONT)};
const W = 1280, H = 720;

async function pixels(blob) {
  const bmp = await createImageBitmap(blob);
  const c = new OffscreenCanvas(W, H);
  const g = c.getContext("2d");
  g.drawImage(bmp, 0, 0);
  return g.getImageData(0, 0, W, H).data;
}
function inkBox(data) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4] > 128) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { x0, y0, x1, y1, n };
}

window.run = async () => {
  const bytes = Uint8Array.from(atob(FONT_B64), (c) => c.charCodeAt(0));
  const face = new FontFace("PassionsConflict", bytes.buffer);
  await face.load();
  document.fonts.add(face);

  const make = () => {
    const p = createProject({ width: W, height: H, fps: 30 });
    p.dispatch({ type: "track/add", payload: { id: "bg", kind: "video" } });
    p.dispatch({ type: "track/add", payload: { id: "t", kind: "video" } });
    p.dispatch({ type: "track/add", payload: { id: "top", kind: "video" } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "title", trackId: "t", startUs: 0, durationUs: 5e6, text: "Summer menu\\nis here", fontFamily: "PassionsConflict", fontSizePx: 90, color: "#ffffff", textAlign: "center", letterSpacing: 0.02, transform: { x: 0.35, y: 0.4, scale: 1.2, rotation: -8, opacity: 1 } } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "under", trackId: "t", startUs: 0, durationUs: 5e6, text: "Covered", fontFamily: "sans-serif", fontSizePx: 60, color: "#ffffff", transform: { x: 0.8, y: 0.8, scale: 1, rotation: 0, opacity: 1 } } });
    p.dispatch({ type: "clip/add", payload: { kind: "html", id: "patch", trackId: "top", startUs: 0, durationUs: 5e6, template: "<div style='width:120px;height:60px;background:#333'></div>", params: {}, widthPx: 120, heightPx: 60, transform: { x: 0.8, y: 0.8, scale: 1, rotation: 0, opacity: 1 } } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "glow", trackId: "t", startUs: 0, durationUs: 5e6, text: "Glow", fontFamily: "sans-serif", fontSizePx: 40, color: "#ffffff", shadowColor: "#ff0000", transform: { x: 0.8, y: 0.15, scale: 1, rotation: 0, opacity: 1 } } });
    return p;
  };

  const project = make();
  const desc = await describeStillText(project, { timeUs: 1e6 });
  const title = desc.texts.find((t) => t.clipId === "title");

  // The compositor's own text, alone on black.
  const only = await pixels(await renderProjectStill(project, { timeUs: 1e6, omitClipIds: ["under", "patch", "glow"] }));
  // Nothing but the background once the text is left out.
  const none = await pixels(await renderProjectStill(project, { timeUs: 1e6, omitClipIds: ["title", "under", "patch", "glow"] }));
  // The described lines, drawn straight on a canvas.
  const c = new OffscreenCanvas(W, H);
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.setTransform(...title.matrix);
  g.font = title.fontSizePx + "px " + title.fontFamily;
  g.letterSpacing = title.letterSpacingPx + "px";
  g.fillStyle = title.color;
  g.textBaseline = "alphabetic";
  for (const l of title.lines) g.fillText(l.text, l.xPx, l.baselinePx);
  const drawn = g.getImageData(0, 0, W, H).data;

  return {
    lines: title.lines.map((l) => l.text),
    reasons: Object.fromEntries(desc.texts.map((t) => [t.clipId, t.rasterReasons])),
    compositor: inkBox(only),
    described: inkBox(drawn),
    none: inkBox(none),
  };
};
`;

describe("still text for vector PDFs", () => {
  it("describes text where the canvas draws it, says what must stay raster, and draws a page without it", async () => {
    const b = await browser();
    if (!b) return;
    const bundle = await build({
      stdin: { contents: ENTRY, resolveDir: renderer, loader: "ts" },
      bundle: true, write: false, format: "iife", platform: "browser", logLevel: "silent",
    });
    const page = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    await page.setContent("<!doctype html><html><body style='margin:0'></body></html>");
    await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
    const out = await page.evaluate(() => (window as unknown as { run: () => Promise<any> }).run());
    await page.close();
    expect(out.lines).toEqual(["Summer menu", "is here"]);
    expect(out.reasons).toEqual({ title: [], under: ["covered"], glow: ["shadow"] });
    expect(out.none.n).toBe(0);
    expect(out.compositor.n).toBeGreaterThan(1000);
    for (const k of ["x0", "y0", "x1", "y1"] as const) {
      expect(Math.abs(out.described[k] - out.compositor[k]), k).toBeLessThanOrEqual(3);
    }
    expect(Math.abs(out.described.n - out.compositor.n) / out.compositor.n).toBeLessThan(0.08);
  });
});
