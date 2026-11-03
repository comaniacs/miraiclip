/**
 * A text clip's box while it types (Typewriter, Kagura F6.17): always the whole text, never the
 * typed part, and never stretched by the mask. jsdom has no real text layout or Pixi, so this runs in
 * Chromium with the real compositor (bundled for the page with esbuild).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { afterAll, describe, expect, it } from "vitest";
import { browser } from "./harness.js";

const here = dirname(fileURLToPath(import.meta.url));
const renderer = join(here, "../..");

afterAll(async () => (await browser())?.close());

const ENTRY = `
import { createProject } from "@miraiclip/core";
import { Compositor, createPixiBackend } from ${JSON.stringify(join(renderer, "src/index.ts"))};

window.run = async (decoration) => {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const project = createProject({ width: 1080, height: 1920, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
  project.dispatch({ type: "clip/add", payload: { kind: "text", id: "c", trackId: "t1", startUs: 0, durationUs: 5_000_000, text: "Add a heading\\nsecond line", fontSizePx: 118, ...decoration } });
  const backend = await createPixiBackend({ canvas, width: 1080, height: 1920 });
  const compositor = new Compositor(project, backend);
  const box = (t) => {
    compositor.renderAt(t);
    const b = compositor.getClipBounds("c", t);
    return b && { w: Math.round(b.widthPx), h: Math.round(b.heightPx), cx: Math.round(b.centerXPx), cy: Math.round(b.centerYPx) };
  };
  const plain = box(1_000_000);
  project.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "reveal", timeUs: 0, value: 0 } });
  project.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "reveal", timeUs: 1_500_000, value: 1 } });
  const typing = {};
  for (const t of [0, 300_000, 700_000, 1_200_000, 2_000_000]) typing[t] = box(t);
  return { plain, typing };
};
`;

describe("text bounds while typing", () => {
  it.each([
    ["plain text", {}],
    ["with an outline and a shadow", { strokeColor: "#ff0000", strokeWidthFrac: 0.05, shadowColor: "#000000", shadowBlurFrac: 0.3, shadowOffsetFrac: 0.1 }],
  ])("%s: the box is the whole text at every moment, with no Pixi warnings", async (_name, decoration, ctx) => {
    const b = await browser();
    if (!b) return ctx.skip();
    const dir = mkdtempSync(join(tmpdir(), "miraiclip-bounds-"));
    try {
      writeFileSync(join(dir, "entry.js"), ENTRY);
      await build({ entryPoints: [join(dir, "entry.js")], bundle: true, format: "iife", outfile: join(dir, "bundle.js"), platform: "browser", logLevel: "error", nodePaths: [join(renderer, "node_modules")] });
      writeFileSync(join(dir, "page.html"), `<!doctype html><body><script src="bundle.js"></script></body>`);
      const page = await b.newPage();
      const warnings: string[] = [];
      page.on("console", (m) => {
        if (/deprecat/i.test(m.text())) warnings.push(m.text());
      });
      await page.goto(`file://${join(dir, "page.html")}`);
      const { plain, typing } = await page.evaluate((d) => (window as unknown as { run(d: unknown): Promise<{ plain: unknown; typing: Record<string, unknown> }> }).run(d), decoration);
      await page.close();
      expect(plain).toMatchObject({ w: expect.any(Number) });
      expect((plain as { w: number }).w).toBeLessThan(1080);
      for (const [t, box] of Object.entries(typing)) expect(box, `at ${t}µs`).toEqual(plain);
      expect(warnings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
