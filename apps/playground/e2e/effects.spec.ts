/**
 * Effects e2e — pixel-asserted against synthetic fixtures.
 * e2e-key.webm: a red box (center) on a #00ff00 green screen.
 * e2e-frames.webm: frame-index colors (see golden-frames.spec.ts).
 */
import { expect, test, type Page } from "@playwright/test";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

declare global {
  interface Window {
    __mirai: {
      project: { dispatch(command: unknown): void };
      player: { seek(us: number): void };
      exportProject: (project: unknown, options: unknown) => Promise<Uint8Array>;
    };
  }
}

function pixelAt(page: Page, fx: number, fy: number): Promise<Rgb> {
  return page.evaluate(
    ([x, y]) => {
      const canvas = document.getElementById("stage") as HTMLCanvasElement;
      const probe = document.createElement("canvas");
      probe.width = probe.height = 1;
      const ctx = probe.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(canvas, Math.round(canvas.width * x!), Math.round(canvas.height * y!), 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return { r: r!, g: g!, b: b! };
    },
    [fx, fy],
  );
}

async function load(page: Page, src: string): Promise<void> {
  await page.goto(`/?src=${src}`);
  await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
  await page.evaluate(() => window.__mirai.player.seek(500_000));
}

test("chroma key removes the green screen and keeps the subject", async ({ page }) => {
  await load(page, "/e2e-key.webm");
  // Green background visible before the key. (The video fills the canvas width;
  // sample at 10%/50% = deep in the green area, 50%/50% = inside the red box.)
  await expect.poll(async () => (await pixelAt(page, 0.1, 0.5)).g, { timeout: 5_000 }).toBeGreaterThan(180);

  await page.evaluate(() => {
    window.__mirai.project.dispatch({
      type: "effect/add",
      payload: { clipId: "main", kind: "chromaKey", effectId: "key", params: { color: "#00ff00" } },
    });
  });
  // Keyed: green area becomes transparent → black canvas background shows.
  await expect.poll(async () => {
    const bg = await pixelAt(page, 0.1, 0.5);
    return Math.max(bg.r, bg.g, bg.b);
  }, { timeout: 5_000 }).toBeLessThan(25);
  // The red subject survives, unkeyed.
  const subject = await pixelAt(page, 0.5, 0.5);
  expect(subject.r).toBeGreaterThan(150);
  expect(subject.g).toBeLessThan(80);

  // Disable → the green screen comes back (params update path).
  await page.evaluate(() => {
    window.__mirai.project.dispatch({
      type: "effect/update",
      payload: { clipId: "main", effectId: "key", enabled: false },
    });
  });
  await expect.poll(async () => (await pixelAt(page, 0.1, 0.5)).g, { timeout: 5_000 }).toBeGreaterThan(180);
});

test("colorAdjust: saturation -1 renders grayscale, brightness -1 renders black", async ({ page }) => {
  await load(page, "/e2e-frames.webm");
  // Frame 15 color: r=240, g=0, b=128 — strongly saturated.
  await expect.poll(async () => (await pixelAt(page, 0.5, 0.5)).r, { timeout: 5_000 }).toBeGreaterThan(120);

  await page.evaluate(() => {
    window.__mirai.project.dispatch({
      type: "effect/add",
      payload: { clipId: "main", kind: "colorAdjust", effectId: "c", params: { saturation: -1 } },
    });
  });
  await expect.poll(async () => {
    const p = await pixelAt(page, 0.5, 0.5);
    return Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b); // grayscale → channels converge
  }, { timeout: 5_000 }).toBeLessThan(20);

  await page.evaluate(() => {
    window.__mirai.project.dispatch({
      type: "effect/update",
      payload: { clipId: "main", effectId: "c", params: { saturation: 0, brightness: -1 } },
    });
  });
  await expect.poll(async () => {
    const p = await pixelAt(page, 0.5, 0.5);
    return Math.max(p.r, p.g, p.b);
  }, { timeout: 5_000 }).toBeLessThan(12);
});

test("effects apply in exported files too (same compositor)", async ({ page }) => {
  test.setTimeout(120_000);
  await load(page, "/e2e-key.webm");
  const corner = await page.evaluate(async () => {
    const { project, exportProject } = window.__mirai;
    project.dispatch({
      type: "effect/add",
      payload: { clipId: "main", kind: "chromaKey", effectId: "key", params: { color: "#00ff00" } },
    });
    const bytes = await exportProject(project, { format: "webm", quality: "draft" });
    // Read the exported file back with a native decoder and sample the corner.
    const blob = new Blob([bytes as BlobPart], { type: "video/webm" });
    const video = document.createElement("video");
    video.src = URL.createObjectURL(blob);
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("native decoder rejected the export"));
    });
    video.currentTime = 1;
    await new Promise((resolve) => (video.onseeked = resolve));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0);
    const d = ctx.getImageData(Math.round(canvas.width * 0.1), Math.round(canvas.height * 0.5), 1, 1).data;
    return { r: d[0]!, g: d[1]!, b: d[2]! };
  });
  // The green screen must be keyed out IN THE FILE (black background baked in).
  expect(Math.max(corner.r, corner.g, corner.b)).toBeLessThan(30);
});
