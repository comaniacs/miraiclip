/**
 * A script font draws outside its nominal box (the swash of "A" starts left of the origin, the
 * tail of "g" runs below the line). The text clip's padding now covers that, so the ink the
 * compositor draws is as large as the same text drawn straight on a 2D canvas. Runs in
 * Chromium with the real compositor.
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
import { Compositor, createPixiBackend } from ${JSON.stringify(join(renderer, "src/index.ts"))};
import { glyphOverhangPx } from ${JSON.stringify(join(renderer, "src/text/overhang.ts"))};

const TEXT = "Add a heading";
const SIZE = 110;
const FONT_B64 = ${JSON.stringify(FONT)};
const settle = async (render) => { for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 25)); render(); } };

/** The ink's width and height: the box around every pixel that isn't the black background. */
function ink(canvas) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width; copy.height = canvas.height;
  const g = copy.getContext("2d");
  g.drawImage(canvas, 0, 0);
  const { data, width, height } = g.getImageData(0, 0, copy.width, copy.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

window.run = async () => {
  const bytes = Uint8Array.from(atob(FONT_B64), (c) => c.charCodeAt(0));
  const face = new FontFace("PassionsConflict", bytes.buffer);
  await face.load();
  document.fonts.add(face);

  // The same text straight onto a 2D canvas.
  const ref = document.createElement("canvas");
  ref.width = 1280; ref.height = 720;
  const r = ref.getContext("2d");
  r.fillStyle = "#000"; r.fillRect(0, 0, 1280, 720);
  r.fillStyle = "#fff"; r.font = SIZE + "px PassionsConflict"; r.textBaseline = "alphabetic";
  r.fillText(TEXT, 300, 400);
  const reference = ink(ref);

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
  project.dispatch({ type: "clip/add", payload: { kind: "text", id: "tx", trackId: "t1", startUs: 0, durationUs: 5_000_000, text: TEXT, fontFamily: "PassionsConflict", fontSizePx: SIZE, color: "#ffffff" } });
  const backend = await createPixiBackend({ canvas, width: 1280, height: 720, preserveDrawingBuffer: true });
  const compositor = new Compositor(project, backend);
  const render = () => compositor.renderAt(1_000_000);
  await settle(render);
  return {
    reference,
    drawn: ink(canvas),
    overhang: glyphOverhangPx({ fontFamily: "PassionsConflict", fontSize: SIZE, fill: "#fff" }, TEXT),
    plain: glyphOverhangPx({ fontFamily: "sans-serif", fontSize: SIZE, fill: "#fff" }, "Hello"),
  };
};
`;

describe("glyphs that overhang the font's box", () => {
  it("are drawn whole, not cut at the text's canvas", async () => {
    const b = await browser();
    if (!b) return;
    const bundle = await build({
      stdin: { contents: ENTRY, resolveDir: renderer, loader: "ts" },
      bundle: true, write: false, format: "iife", platform: "browser", logLevel: "silent",
    });
    const page = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
    await page.setContent("<!doctype html><html><body style='margin:0'></body></html>");
    await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
    const out = await page.evaluate(() => (window as unknown as { run: () => Promise<any> }).run());
    await page.close();
    expect(out.overhang).toBeGreaterThan(15);
    expect(out.plain).toBeLessThan(out.overhang);
    expect(Math.abs(out.drawn.w - out.reference.w)).toBeLessThanOrEqual(4);
    expect(Math.abs(out.drawn.h - out.reference.h)).toBeLessThanOrEqual(4);
  });
});
