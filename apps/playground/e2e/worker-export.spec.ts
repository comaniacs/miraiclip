/**
 * Worker export: the SAME pipeline running off the main thread. Verifies
 * (1) the output is frame-accurate and carries audio at unity gain — audio
 * crosses the thread boundary as raw PCM (AudioBuffer is window-only), so
 * this closes the loop on the AudioSampleSource path and its running
 * timestamps; (2) the MAIN thread keeps ticking while the export runs — the
 * whole point of the worker; (3) abort crosses the boundary.
 */
import { expect, test, type Page } from "@playwright/test";

const TOLERANCE = 16; // yuv420 + VP9 draft-quality encode round trip

declare global {
  interface Window {
    __mirai: {
      project: { dispatch(command: unknown): void };
      exportProjectViaWorker: (options: unknown) => Promise<Uint8Array>;
    };
    __exported?: Uint8Array;
  }
}

async function load(page: Page, src: string): Promise<void> {
  await page.goto(`/?src=${src}`);
  await page.waitForFunction(() => window.__mirai);
}

test("worker export is frame-accurate with unity audio, and main stays responsive", async ({ page }) => {
  test.setTimeout(180_000);
  await load(page, "/e2e-tone.webm");

  const run = await page.evaluate(async () => {
    // Main-thread responsiveness probe: rAF gaps WHILE the worker exports.
    // The same export on the main thread starves rAF into export-length gaps.
    const gaps: number[] = [];
    let last = performance.now();
    let sampling = true;
    const tick = (): void => {
      const now = performance.now();
      gaps.push(now - last);
      last = now;
      if (sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const bytes = await window.__mirai.exportProjectViaWorker({ format: "webm", quality: "draft" });
    sampling = false;
    window.__exported = bytes;
    const sorted = [...gaps].sort((a, b) => a - b);
    return {
      byteLength: bytes.byteLength,
      rafSamples: sorted.length,
      rafGapP50: sorted[Math.floor(sorted.length / 2)]!,
      rafGapP95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!,
    };
  });
  expect(run.byteLength).toBeGreaterThan(10_000);
  expect(run.rafSamples).toBeGreaterThan(50);
  // Main-thread export starves these gaps to hundreds of ms; a free main
  // thread ticks at display cadence even under SwiftShader.
  expect(run.rafGapP50, `rAF p50 ${run.rafGapP50}ms p95 ${run.rafGapP95}ms`).toBeLessThan(100);

  // Frame accuracy, read back with a native decoder (independent of our stack).
  const pixels = await page.evaluate(async () => {
    const blob = new Blob([window.__exported! as BlobPart], { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("native decoder rejected the worker export"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const out = { duration: video.duration, width: video.videoWidth, samples: [] as { t: number; r: number; g: number; b: number }[] };
    for (const t of [0.501, 1.501, 3.501]) {
      video.currentTime = t;
      await new Promise((resolve) => (video.onseeked = resolve));
      ctx.drawImage(video, 0, 0);
      const [r, g, b] = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      out.samples.push({ t, r: r!, g: g!, b: b! });
    }
    URL.revokeObjectURL(url);
    return out;
  });
  expect(pixels.width).toBe(1280);
  expect(Math.abs(pixels.duration - 4)).toBeLessThan(0.15);
  for (const pixel of pixels.samples) {
    const frame = Math.floor(pixel.t * 30);
    const want = { r: (frame * 16) % 256, g: 16 * Math.floor(frame / 16), b: 128 };
    const label = `t=${pixel.t} frame=${frame} got=${JSON.stringify(pixel)}`;
    expect(Math.abs(pixel.r - want.r), label).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(pixel.g - want.g), label).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(pixel.b - want.b), label).toBeLessThanOrEqual(TOLERANCE);
  }

  // Audio at unity through the PCM boundary: the fixture's tone is RMS ≈
  // 0.0885 — a dropped/shifted/duplicated PCM chunk moves this.
  const audio = await page.evaluate(async () => {
    const ctx = new AudioContext();
    const buffer = await ctx.decodeAudioData((window.__exported!.buffer as ArrayBuffer).slice(0));
    const data = buffer.getChannelData(0);
    const start = Math.floor(buffer.sampleRate * 1);
    const end = Math.floor(buffer.sampleRate * 3);
    let sum = 0;
    for (let i = start; i < end; i++) sum += data[i]! * data[i]!;
    await ctx.close();
    return { duration: buffer.duration, rms: Math.sqrt(sum / (end - start)) };
  });
  expect(Math.abs(audio.duration - 4)).toBeLessThan(0.2);
  expect(Math.abs(audio.rms - 0.0885)).toBeLessThan(0.02);
});

test("worker export streams through a target (relayed chunks reassemble frame-accurately)", async ({ page }) => {
  test.setTimeout(180_000);
  await load(page, "/e2e-frames.webm");
  const result = await page.evaluate(async () => {
    // The worker can't receive a stream (FileSystemWritableFileStream is not
    // transferable) — chunks relay through main. Collect them here exactly
    // like a file writable would receive them, then reassemble.
    const parts: { data: Uint8Array; position: number }[] = [];
    const target = new WritableStream<{ type: "write"; data: Uint8Array; position: number }>({
      write(chunk) {
        parts.push({ data: chunk.data, position: chunk.position });
      },
    });
    const resolved = await window.__mirai.exportProjectViaWorker({ format: "webm", quality: "draft", target });
    let size = 0;
    for (const part of parts) size = Math.max(size, part.position + part.data.byteLength);
    const bytes = new Uint8Array(size);
    for (const part of parts) bytes.set(part.data, part.position); // later writes win (header patches)
    window.__exported = bytes;
    return { resolvedBytes: resolved.byteLength, chunks: parts.length, size };
  });
  expect(result.resolvedBytes).toBe(0); // streamed — nothing retained in the worker
  expect(result.chunks).toBeGreaterThan(0);
  expect(result.size).toBeGreaterThan(10_000);

  const readback = await page.evaluate(async () => {
    const blob = new Blob([window.__exported! as BlobPart], { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("native decoder rejected the streamed worker export"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    video.currentTime = 1.501; // frame 45
    await new Promise((resolve) => (video.onseeked = resolve));
    ctx.drawImage(video, 0, 0);
    const [r, g, b] = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    URL.revokeObjectURL(url);
    return { duration: video.duration, r: r!, g: g!, b: b! };
  });
  expect(Math.abs(readback.duration - 4)).toBeLessThan(0.15);
  // Frame 45: r=(45·16)%256=208, g=16·⌊45/16⌋=32, b=128.
  const label = JSON.stringify(readback);
  expect(Math.abs(readback.r - 208), label).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(readback.g - 32), label).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(readback.b - 128), label).toBeLessThanOrEqual(TOLERANCE);
});

test("worker export aborts across the boundary", async ({ page }) => {
  test.setTimeout(120_000);
  await load(page, "/e2e-frames.webm");
  const result = await page.evaluate(async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1_500); // mid-export
    try {
      await window.__mirai.exportProjectViaWorker({ format: "webm", quality: "draft", signal: controller.signal });
      return { outcome: "resolved" };
    } catch (error) {
      return { outcome: "rejected", name: (error as Error).name };
    }
  });
  expect(result).toEqual({ outcome: "rejected", name: "ExportAbortedError" });
});
