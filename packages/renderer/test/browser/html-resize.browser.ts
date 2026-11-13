/**
 * A full-frame html clip (no widthPx/heightPx: a page background) after the project is resized
 * (Kagura F6.21): it fills the new size, and a later re-raster (a new color) does too. jsdom has
 * no WebGL or SVG rasters, so this runs in Chromium with the real compositor.
 */
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
import { Compositor, createPixiBackend, createPreviewController } from ${JSON.stringify(join(renderer, "src/index.ts"))};

const TEMPLATE = '<div style="width:100%;height:100%;background:{{color}}"></div>';
function makeProject() {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
  project.dispatch({ type: "clip/add", payload: { kind: "html", id: "bg", trackId: "t1", startUs: 0, durationUs: 5_000_000, template: TEMPLATE, params: { color: "#ff0000" } } });
  return project;
}
/** The canvas's pixels at a 5 × 5 grid of points (inset from the edges), as "r,g,b". */
function sample(canvas) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width; copy.height = canvas.height;
  const g = copy.getContext("2d");
  g.drawImage(canvas, 0, 0);
  const out = [];
  for (let iy = 0; iy < 5; iy++) for (let ix = 0; ix < 5; ix++) {
    const x = Math.round((0.04 + 0.23 * ix) * canvas.width), y = Math.round((0.04 + 0.23 * iy) * canvas.height);
    out.push(Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3).join(","));
  }
  return { size: canvas.width + "x" + canvas.height, colors: [...new Set(out)] };
}
const settle = async (render) => { for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 25)); render(); } };

window.runCompositor = async (output) => {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const project = makeProject();
  const backend = await createPixiBackend({ canvas, width: 1280, height: 720, preserveDrawingBuffer: true });
  const compositor = new Compositor(project, backend, output ? { outputSize: { width: 640, height: 360 } } : {});
  const render = () => compositor.renderAt(1_000_000);
  await settle(render);
  const before = sample(canvas);
  project.dispatch({ type: "project/set-settings", payload: { width: 720, height: 1280 } });
  if (output) backend.setOutputSize(360, 640);
  await settle(render);
  const resized = sample(canvas);
  project.dispatch({ type: "clip/set-property", payload: { clipId: "bg", params: { color: "#0000ff" } } });
  await settle(render);
  const recolored = sample(canvas);
  return { before, resized, recolored };
};

/** The host swaps in a resized copy of the document (a server's version) instead of dispatching. */
window.runReplace = async (how) => {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const project = makeProject();
  const backend = await createPixiBackend({ canvas, width: 1280, height: 720, preserveDrawingBuffer: true });
  const compositor = new Compositor(project, backend);
  const render = () => compositor.renderAt(1_000_000);
  await settle(render);
  const peer = createProject(JSON.parse(JSON.stringify(project.toJSON())));
  peer.dispatch({ type: "project/set-settings", payload: { width: 720, height: 1280 } });
  if (how === "replace") project.replaceDocument(peer.toJSON());
  else { project.store.setState({ doc: peer.toJSON() }); compositor.resync(); }
  await settle(render);
  const resized = sample(canvas);
  project.dispatch({ type: "clip/set-property", payload: { clipId: "bg", params: { color: "#0000ff" } } });
  await settle(render);
  return { resized, recolored: sample(canvas) };
};

window.runPreview = async () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:640px;height:360px";
  document.body.appendChild(canvas);
  const project = makeProject();
  const controller = createPreviewController(project, { isSupported: () => true, devicePixelRatio: () => 1, backend: { preserveDrawingBuffer: true } });
  controller.attach(canvas, { width: 640, height: 360 });
  const render = () => {};
  for (let i = 0; i < 100 && controller.getState().mode !== "live"; i++) await new Promise((r) => setTimeout(r, 25));
  const read = async () => {
    await settle(render);
    return sample(canvas);
  };
  const before = await read();
  project.dispatch({ type: "project/set-settings", payload: { width: 720, height: 1280 } });
  canvas.style.cssText = "width:360px;height:640px";
  controller.resize(360, 640);
  const resized = await read();
  project.dispatch({ type: "clip/set-property", payload: { clipId: "bg", params: { color: "#0000ff" } } });
  const recolored = await read();
  return { mode: controller.getState().mode, error: controller.getState().lastError, before, resized, recolored };
};
`;

async function open() {
  const b = await browser();
  if (!b) return null;
  const bundle = await build({
    stdin: { contents: ENTRY, resolveDir: renderer, loader: "ts" },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    logLevel: "silent",
  });
  const page = await b.newPage({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 1 });
  await page.setContent("<!doctype html><html><body style='margin:0'></body></html>");
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  return page;
}

describe("a full-frame html clip after a project resize", () => {
  it.each([
    ["at composition size", false],
    ["with a smaller output size (a preview)", true],
  ])("fills the new size and re-rasters there (%s)", async (_name, output, ctx) => {
    const page = await open();
    if (!page) return ctx.skip();
    try {
      const r = (await page.evaluate(`window.runCompositor(${output})`)) as Record<string, { size: string; colors: string[] }>;
      expect(r.before).toEqual({ size: output ? "640x360" : "1280x720", colors: ["255,0,0"] });
      expect(r.resized).toEqual({ size: output ? "360x640" : "720x1280", colors: ["255,0,0"] });
      expect(r.recolored).toEqual({ size: output ? "360x640" : "720x1280", colors: ["0,0,255"] });
    } finally {
      await page.close();
    }
  }, 60_000);

  it.each([
    ["replaceDocument", "replace"],
    ["a store-level swap followed by resync()", "resync"],
  ])("fills the new size when the document is swapped by %s", async (_name, how, ctx) => {
    const page = await open();
    if (!page) return ctx.skip();
    try {
      const r = (await page.evaluate(`window.runReplace(${JSON.stringify(how)})`)) as Record<string, { size: string; colors: string[] }>;
      expect(r.resized).toEqual({ size: "720x1280", colors: ["255,0,0"] });
      expect(r.recolored).toEqual({ size: "720x1280", colors: ["0,0,255"] });
    } finally {
      await page.close();
    }
  }, 60_000);

  it("the preview controller's canvas fills the new size too", async (ctx) => {
    const page = await open();
    if (!page) return ctx.skip();
    try {
      const r = (await page.evaluate("window.runPreview()")) as { mode: string; error: string | null } & Record<string, { size: string; colors: string[] }>;
      expect(r.error).toBeNull();
      expect(r.mode).toBe("live");
      expect(r.before.colors).toEqual(["255,0,0"]);
      expect(r.resized).toEqual({ size: "360x640", colors: ["255,0,0"] });
      expect(r.recolored).toEqual({ size: "360x640", colors: ["0,0,255"] });
    } finally {
      await page.close();
    }
  }, 60_000);
});
