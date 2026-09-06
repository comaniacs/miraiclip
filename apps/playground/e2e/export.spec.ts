/**
 * Closed-loop export tests: export the golden-frame fixture through the full
 * pipeline (decode → composite → encode → mux), then verify the produced file
 * with an INDEPENDENT decoder — a native <video> element and
 * `decodeAudioData` — so a bug in our stack can't hide by round-tripping
 * through itself. WebM/VP9 (Playwright's Chromium has no H.264 encoder).
 */
import { expect, test, type Page } from "@playwright/test";

const TOLERANCE = 16; // yuv420 + VP9 draft-quality encode round trip

declare global {
  interface Window {
    __mirai: {
      project: unknown;
      exportProject: (project: unknown, options: unknown) => Promise<Uint8Array>;
    };
    __exported?: Uint8Array;
  }
}

async function runExport(page: Page, src: string): Promise<number> {
  await page.goto(`/?src=${src}`);
  await page.waitForFunction(() => window.__mirai);
  return page.evaluate(async () => {
    const { project, exportProject } = window.__mirai;
    window.__exported = await exportProject(project, { format: "webm", quality: "draft" });
    return window.__exported.byteLength;
  });
}

test("exported video is frame-accurate when read back by a native decoder", async ({ page }) => {
  test.setTimeout(120_000);
  const byteLength = await runExport(page, "/e2e-frames.webm");
  expect(byteLength).toBeGreaterThan(10_000);

  const results = await page.evaluate(async () => {
    const blob = new Blob([window.__exported! as BlobPart], { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("native decoder rejected the exported file"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const sample = async (timeSec: number) => {
      video.currentTime = timeSec;
      await new Promise((resolve) => (video.onseeked = resolve));
      ctx.drawImage(video, 0, 0);
      const [r, g, b] = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      return { r: r!, g: g!, b: b! };
    };
    const out = {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      pixels: [] as { t: number; r: number; g: number; b: number }[],
    };
    for (const t of [0.501, 1.501, 3.501]) out.pixels.push({ t, ...(await sample(t)) });
    URL.revokeObjectURL(url);
    return out;
  });

  expect(results.width).toBe(1280); // exported at project resolution
  expect(results.height).toBe(720);
  expect(Math.abs(results.duration - 4)).toBeLessThan(0.15);
  for (const pixel of results.pixels) {
    const frame = Math.floor(pixel.t * 30);
    const want = { r: (frame * 16) % 256, g: 16 * Math.floor(frame / 16), b: 128 };
    const label = `t=${pixel.t} frame=${frame} got=${JSON.stringify(pixel)}`;
    expect(Math.abs(pixel.r - want.r), label).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(pixel.g - want.g), label).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(pixel.b - want.b), label).toBeLessThanOrEqual(TOLERANCE);
  }
});

test("range export rebases timestamps to the range start", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?src=/e2e-frames.webm");
  await page.waitForFunction(() => window.__mirai);
  const result = await page.evaluate(async () => {
    const { project, exportProject } = window.__mirai;
    const bytes = await exportProject(project, {
      format: "webm",
      quality: "draft",
      range: { startUs: 1_000_000, endUs: 3_000_000 }, // source 1s → 3s
    });
    const blob = new Blob([bytes as BlobPart], { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("native decoder rejected the range export"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    video.currentTime = 0.501; // output 0.5s = source 1.5s = source frame 45
    await new Promise((resolve) => (video.onseeked = resolve));
    ctx.drawImage(video, 0, 0);
    const [r, g, b] = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    URL.revokeObjectURL(url);
    return { duration: video.duration, r: r!, g: g!, b: b! };
  });
  expect(Math.abs(result.duration - 2)).toBeLessThan(0.15);
  // Source frame 45: r=(45·16)%256=208, g=16·⌊45/16⌋=32, b=128.
  const label = JSON.stringify(result);
  expect(Math.abs(result.r - 208), label).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(result.g - 32), label).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(result.b - 128), label).toBeLessThanOrEqual(TOLERANCE);
});

test("exported audio survives the round trip (mix → encode → native decode)", async ({ page }) => {
  test.setTimeout(120_000);
  await runExport(page, "/e2e-tone.webm"); // fixture with a 440Hz tone
  const audio = await page.evaluate(async () => {
    const ctx = new AudioContext();
    const buffer = await ctx.decodeAudioData(
      (window.__exported!.buffer as ArrayBuffer).slice(0),
    );
    const data = buffer.getChannelData(0);
    // RMS over the middle 2 seconds — a silent/missing track would be ~0.
    const start = Math.floor(buffer.sampleRate * 1);
    const end = Math.floor(buffer.sampleRate * 3);
    let sum = 0;
    for (let i = start; i < end; i++) sum += data[i]! * data[i]!;
    await ctx.close();
    return { duration: buffer.duration, rms: Math.sqrt(sum / (end - start)) };
  });
  expect(Math.abs(audio.duration - 4)).toBeLessThan(0.2);
  // Fidelity, not just presence: the fixture's tone measures RMS ≈ 0.0885
  // (ffmpeg sine, amplitude 0.125). The mix must pass it through at unity
  // gain — a dropped chunk, double-schedule, or wrong gain all move this.
  expect(Math.abs(audio.rms - 0.0885)).toBeLessThan(0.02);
});
