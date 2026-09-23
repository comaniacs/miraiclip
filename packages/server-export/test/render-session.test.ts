/**
 * Integration for the persistent render session: one real headless Chromium
 * stays warm across calls and renders stills through the export pipeline.
 * Needs a browser (MIRAICLIP_BROWSER or the well-known path) — skips
 * visibly when none exists, like the export integration.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { createRenderSession, type RenderSession } from "../src/render-session.js";

const CANDIDATES = [
  process.env["MIRAICLIP_BROWSER"],
  "/opt/pw-browsers/chromium",
].filter((p): p is string => p !== undefined && existsSync(p));
const browserPath = CANDIDATES[0];

const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/playground/public",
);

/** PNG header check: signature plus IHDR width/height (big-endian at 16..23). */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function textDoc() {
  const project = createProject({ width: 640, height: 360, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "text", id: "c1", trackId: "t1", text: "STILL", startUs: 0, durationUs: 2_000_000 },
    });
  });
  return project.toJSON();
}

describe.skipIf(browserPath === undefined)("createRenderSession (integration)", () => {
  let session: RenderSession;

  beforeAll(async () => {
    session = await createRenderSession({
      assetsDir: FIXTURE_DIR,
      browser: { executablePath: browserPath!, swiftshader: true },
    });
  }, 60_000);

  afterAll(async () => {
    await session?.close();
  });

  it("renders a still at the composition size, and again at a custom size — same warm page", async () => {
    const doc = textDoc();
    const full = await session.renderStill(doc, { timeUs: 500_000 });
    expect(pngSize(full)).toEqual({ width: 640, height: 360 });

    const thumb = await session.renderStill(doc, { timeUs: 500_000, width: 320, height: 180 });
    expect(pngSize(thumb)).toEqual({ width: 320, height: 180 });
    expect(thumb.length).toBeGreaterThan(0);
  }, 60_000);

  it("renders video clips (assets served through the session's live file map)", async () => {
    const project = createProject({ width: 320, height: 180, fps: 30 });
    project.transaction(() => {
      project.dispatch({
        type: "asset/add",
        payload: { id: "media", kind: "video", src: "e2e-frames.webm", durationUs: 4_000_000 },
      });
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({
        type: "clip/add",
        payload: { kind: "video", id: "main", trackId: "v1", assetId: "media", startUs: 0, durationUs: 4_000_000 },
      });
    });
    const png = await session.renderStill(project.toJSON(), { timeUs: 100_000 });
    expect(pngSize(png)).toEqual({ width: 320, height: 180 });
    // A decoded video frame compresses to far more than a flat background.
    expect(png.length).toBeGreaterThan(1_000);
  }, 60_000);

  it("renders html clips (rasterized in the harness page)", async () => {
    const project = createProject({ width: 320, height: 180, fps: 30 });
    project.transaction(() => {
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({
        type: "clip/add",
        payload: {
          kind: "html", id: "card", trackId: "v1", startUs: 0, durationUs: 1_000_000,
          template: `<div style="width:100%;height:100%;background:{{color}}"></div>`,
          params: { color: "#ff00ff" },
        },
      });
    });
    const png = await session.renderStill(project.toJSON(), { timeUs: 500_000 });
    expect(pngSize(png)).toEqual({ width: 320, height: 180 });
    expect(png.length).toBeGreaterThan(200); // a real card, not an empty frame
  }, 60_000);

  it("a failed render (missing asset file) rejects without wedging the session", async () => {
    const project = createProject({ width: 320, height: 180, fps: 30 });
    project.transaction(() => {
      project.dispatch({
        type: "asset/add",
        payload: { id: "ghost", kind: "video", src: "does-not-exist.webm", durationUs: 1_000_000 },
      });
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({
        type: "clip/add",
        payload: { kind: "video", id: "g1", trackId: "v1", assetId: "ghost", startUs: 0, durationUs: 1_000_000 },
      });
    });
    await expect(session.renderStill(project.toJSON(), { timeUs: 0 })).rejects.toThrow(/no file at/);

    // The queue recovers: the next render succeeds.
    const png = await session.renderStill(textDoc(), { timeUs: 0 });
    expect(pngSize(png)).toEqual({ width: 640, height: 360 });
  }, 60_000);
});
