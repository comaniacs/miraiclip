/**
 * html clips end to end: a template rasterizes (SVG foreignObject → data: URL
 * → laundered canvas texture) and composites over the video — live, through
 * param updates, and baked into exported files. Solid template colors make
 * the assertions pixel-level and GPU-independent, like the golden frames.
 */
import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __mirai: {
      project: { dispatch(command: unknown): void };
      player: { seek(us: number): void };
      exportProject: (project: unknown, options: unknown) => Promise<Uint8Array>;
      exportProjectViaWorker: (options: unknown) => Promise<Uint8Array>;
    };
  }
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function centerPixel(page: Page): Promise<Rgb> {
  return page.evaluate(() => {
    const canvas = document.getElementById("stage") as HTMLCanvasElement;
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    const ctx = probe.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(canvas, canvas.width / 2, canvas.height / 2, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r: r!, g: g!, b: b! };
  });
}

const near = (pixel: Rgb, want: Rgb, tolerance: number) =>
  Math.abs(pixel.r - want.r) <= tolerance &&
  Math.abs(pixel.g - want.g) <= tolerance &&
  Math.abs(pixel.b - want.b) <= tolerance;

/** A full-frame solid card whose color comes from a param. */
const TEMPLATE = `<div style="width:100%;height:100%;background:{{color}}"></div>`;

function addHtmlClip(page: Page, color: string): Promise<void> {
  return page.evaluate((clipColor) => {
    window.__mirai.project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "card", trackId: "overlay", startUs: 0, durationUs: 2_000_000,
        template: `<div style="width:100%;height:100%;background:{{color}}"></div>`,
        params: { color: clipColor },
      },
    });
    window.__mirai.player.seek(500_000);
  }, color);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/?src=/e2e-frames.webm");
  await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
});

test("an html clip rasterizes and composites over the video, live", async ({ page }) => {
  await addHtmlClip(page, "#ff00ff");
  await expect
    .poll(async () => near(await centerPixel(page), { r: 255, g: 0, b: 255 }, 4), {
      timeout: 5_000,
      message: "magenta html card never presented",
    })
    .toBe(true);
});

test("a param change re-rasters the template in place", async ({ page }) => {
  await addHtmlClip(page, "#ff00ff");
  await expect
    .poll(async () => near(await centerPixel(page), { r: 255, g: 0, b: 255 }, 4), { timeout: 5_000 })
    .toBe(true);

  await page.evaluate(() => {
    window.__mirai.project.dispatch({
      type: "clip/set-property",
      payload: { clipId: "card", params: { color: "#00ff88" } },
    });
    window.__mirai.player.seek(500_000 + 1); // re-present
  });
  await expect
    .poll(async () => near(await centerPixel(page), { r: 0, g: 255, b: 136 }, 4), {
      timeout: 5_000,
      message: "param update never re-rastered",
    })
    .toBe(true);
});

test("html clips are baked into exported files from frame 0 (readiness-gated)", async ({ page }) => {
  test.setTimeout(120_000);
  const sampled = await page.evaluate(async () => {
    const { project, exportProject } = window.__mirai;
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "card", trackId: "overlay", startUs: 0, durationUs: 2_000_000,
        template: `<div style="width:100%;height:100%;background:{{color}}"></div>`,
        params: { color: "#ff00ff" },
      },
    });
    // Export starts immediately — whenReady() must hold frame 0 for the raster.
    const bytes = await exportProject(project, {
      format: "webm",
      quality: "draft",
      range: { startUs: 0, endUs: 1_000_000 },
    });
    const blob = new Blob([bytes as BlobPart], { type: "video/webm" });
    const video = document.createElement("video");
    video.src = URL.createObjectURL(blob);
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("native decoder rejected the export"));
    });
    video.currentTime = 0; // the very first frame
    await new Promise((resolve) => (video.onseeked = resolve));
    await new Promise((resolve) => {
      (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => void })
        .requestVideoFrameCallback?.(() => resolve(undefined));
      setTimeout(resolve, 500);
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0);
    const d = ctx.getImageData(Math.round(canvas.width / 2), Math.round(canvas.height / 2), 1, 1).data;
    return { r: d[0]!, g: d[1]!, b: d[2]! };
  });
  const encodeTolerance = 22; // draft VP9 round-trip
  expect(near(sampled, { r: 255, g: 0, b: 255 }, encodeTolerance), JSON.stringify(sampled)).toBe(true);
});

test("html clips export through the WORKER (pre-rastered on main, bitmaps transferred)", async ({ page }) => {
  test.setTimeout(120_000);
  const sampled = await page.evaluate(async () => {
    const { project, exportProjectViaWorker } = window.__mirai;
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "card", trackId: "overlay", startUs: 0, durationUs: 2_000_000,
        template: `<div style="width:100%;height:100%;background:{{color}}"></div>`,
        params: { color: "#ff00ff" },
      },
    });
    // The worker has no DOM: exportViaWorker rasterizes on THIS thread and
    // transfers the bitmap — the export must still bake the card from frame 0.
    const bytes = await exportProjectViaWorker({
      format: "webm",
      quality: "draft",
      range: { startUs: 0, endUs: 1_000_000 },
    });
    const blob = new Blob([bytes as BlobPart], { type: "video/webm" });
    const video = document.createElement("video");
    video.src = URL.createObjectURL(blob);
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("native decoder rejected the worker export"));
    });
    video.currentTime = 0;
    await new Promise((resolve) => (video.onseeked = resolve));
    await new Promise((resolve) => {
      (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => void })
        .requestVideoFrameCallback?.(() => resolve(undefined));
      setTimeout(resolve, 500);
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0);
    const d = ctx.getImageData(Math.round(canvas.width / 2), Math.round(canvas.height / 2), 1, 1).data;
    return { r: d[0]!, g: d[1]!, b: d[2]! };
  });
  const encodeTolerance = 22; // draft VP9 round-trip
  expect(near(sampled, { r: 255, g: 0, b: 255 }, encodeTolerance), JSON.stringify(sampled)).toBe(true);
});
