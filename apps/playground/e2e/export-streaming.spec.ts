/**
 * Gate-2 export paths: chunked audio mixing and the streaming output target.
 * Chunked audio must be indistinguishable from the whole-timeline mix (chunk
 * boundaries are the risk: a misaligned chunk shifts audio, a seam clicks);
 * a streamed export must reassemble into a file a native decoder accepts,
 * with the resolved promise carrying no bytes.
 */
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __mirai: {
      project: unknown;
      exportProject: (project: unknown, options: unknown) => Promise<Uint8Array>;
    };
  }
}

test("chunked audio mix is seamless and matches the whole-timeline mix", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/?src=/e2e-tone.webm"); // 440Hz tone fixture
  await page.waitForFunction(() => window.__mirai);

  const result = await page.evaluate(async () => {
    const { project, exportProject } = window.__mirai;
    // 4s timeline: 1s chunks exercise three interior boundaries; the default
    // (60s) mixes it whole — the reference.
    const chunked = await exportProject(project, { format: "webm", quality: "draft", audioChunkSeconds: 1 });
    const whole = await exportProject(project, { format: "webm", quality: "draft" });

    const ctx = new AudioContext();
    const decode = async (bytes: Uint8Array) =>
      ctx.decodeAudioData((bytes.buffer as ArrayBuffer).slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const a = await decode(chunked);
    const b = await decode(whole);
    const dataA = a.getChannelData(0);
    const dataB = b.getChannelData(0);

    // Whole-file RMS through the chunked path (unity gain, nothing dropped).
    const rmsOver = (data: Float32Array, from: number, to: number) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += data[i]! * data[i]!;
      return Math.sqrt(sum / (to - from));
    };
    const sr = a.sampleRate;
    const rms = rmsOver(dataA, Math.floor(sr * 1), Math.floor(sr * 3));

    // Seam check: the largest sample-to-sample step anywhere. A 440Hz tone at
    // amplitude 0.125 moves at most ~0.0072 per 48kHz sample; a boundary
    // click approaches the full amplitude.
    let maxStep = 0;
    for (let i = 1; i < dataA.length; i++) {
      const step = Math.abs(dataA[i]! - dataA[i - 1]!);
      if (step > maxStep) maxStep = step;
    }

    // Chunked vs whole: RMS per half-second window must agree — a shifted or
    // silent chunk moves whole windows.
    const windows: number[] = [];
    const compareLen = Math.min(dataA.length, dataB.length);
    for (let w = 0; (w + 1) * sr * 0.5 <= compareLen; w++) {
      const from = Math.floor(w * sr * 0.5);
      const to = Math.floor((w + 1) * sr * 0.5);
      windows.push(Math.abs(rmsOver(dataA, from, to) - rmsOver(dataB, from, to)));
    }
    await ctx.close();
    return { durationA: a.duration, rms, maxStep, maxWindowDiff: Math.max(...windows), windows: windows.length };
  });

  expect(Math.abs(result.durationA - 4)).toBeLessThan(0.2);
  expect(Math.abs(result.rms - 0.0885), `rms=${result.rms}`).toBeLessThan(0.02);
  expect(result.maxStep, `max sample step ${result.maxStep} — a chunk-boundary click`).toBeLessThan(0.05);
  expect(result.windows).toBeGreaterThanOrEqual(7);
  expect(result.maxWindowDiff, "chunked vs whole per-window RMS").toBeLessThan(0.01);
});

test("a streamed export reassembles into a decodable file and resolves empty", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?src=/e2e-frames.webm");
  await page.waitForFunction(() => window.__mirai);

  const result = await page.evaluate(async () => {
    const { project, exportProject } = window.__mirai;
    // Positioned writes into a growing buffer — the same contract a
    // FileSystemWritableFileStream implements against a real file.
    let file = new Uint8Array(0);
    let writes = 0;
    const target = new WritableStream<{ type: "write"; data: Uint8Array; position: number }>({
      write(chunk) {
        writes++;
        const end = chunk.position + chunk.data.byteLength;
        if (end > file.byteLength) {
          const grown = new Uint8Array(end);
          grown.set(file);
          file = grown;
        }
        file.set(chunk.data, chunk.position);
      },
    });
    const resolved = await exportProject(project, { format: "webm", quality: "draft", target });

    const blob = new Blob([file as BlobPart], { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("native decoder rejected the streamed file"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    video.currentTime = 1.501; // frame 45: r=208 g=32 b=128
    await new Promise((resolve) => (video.onseeked = resolve));
    ctx.drawImage(video, 0, 0);
    const [r, g, b] = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    URL.revokeObjectURL(url);
    return {
      resolvedBytes: resolved.byteLength,
      fileBytes: file.byteLength,
      writes,
      duration: video.duration,
      r: r!,
      g: g!,
      b: b!,
    };
  });

  expect(result.resolvedBytes).toBe(0); // the bytes went to the stream
  expect(result.fileBytes).toBeGreaterThan(10_000);
  expect(result.writes).toBeGreaterThan(0);
  expect(Math.abs(result.duration - 4)).toBeLessThan(0.15);
  const TOLERANCE = 16;
  const label = JSON.stringify(result);
  expect(Math.abs(result.r - 208), label).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(result.g - 32), label).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(result.b - 128), label).toBeLessThanOrEqual(TOLERANCE);
});
