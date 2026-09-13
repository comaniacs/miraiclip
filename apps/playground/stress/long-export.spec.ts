/**
 * Scenario B — long export with bounded memory, the Gate-2 configuration:
 * STREAMING output (encoded chunks leave the page — nothing accumulates) and
 * CHUNKED audio (the tone fixture gives every clip a real audio track, so the
 * mixer runs for real, one bounded chunk at a time). With both on, the JS
 * heap must stay FLAT after warmup — there is no "honest accumulation" left
 * to excuse growth, so the assertion is a plain spread budget, which a
 * per-frame or per-chunk leak blows through over thousands of frames.
 *
 * STRESS_MINUTES scales the timeline (default 5; the one-hour Gate-2
 * demonstration runs 60).
 */
import { expect, test } from "@playwright/test";
import {
  buildSyntheticTimeline,
  collectConsoleErrors,
  recordMetrics,
} from "./helpers";

const MINUTES = Number(process.env.STRESS_MINUTES ?? 5);

test(`${MINUTES}-minute timeline exports with bounded heap (streaming + chunked audio)`, async ({ page }) => {
  test.setTimeout(Math.max(30, MINUTES * 12) * 60_000);
  const errors = collectConsoleErrors(page);
  // The tone fixture: frame-index video PLUS a 440Hz audio track — every
  // video clip on the timeline contributes audio, so the chunked mixer works
  // through the whole range instead of being skipped.
  await page.goto("/?src=/e2e-tone.webm");
  await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
  await page.evaluate(() => {
    const { project } = (window as never as { __mirai: { project: { dispatch(c: unknown): void } } }).__mirai;
    project.dispatch({ type: "clip/remove", payload: { clipId: "title" } });
  });
  const summary = await buildSyntheticTimeline(page, {
    minutes: MINUTES,
    overlayTracks: 4,
    withEffects: true,
    withTransitions: true,
  });

  const started = Date.now();
  const result = await page.evaluate(async () => {
    const { project, exportProject } = (window as never as {
      __mirai: {
        project: unknown;
        exportProject: (project: unknown, options: unknown) => Promise<Uint8Array>;
      };
    }).__mirai;
    const heap = (): number => {
      (window as never as { gc?: () => void }).gc?.();
      const memory = (performance as never as { memory?: { usedJSHeapSize: number } }).memory;
      return memory ? memory.usedJSHeapSize / 1_048_576 : -1;
    };
    const samples: { frame: number; heapMB: number }[] = [];
    let total = 0;
    let nextSampleAt = 0;
    let audioMixedUsMax = 0;
    // Streaming target: count and DISCARD — the encoded file never lives in
    // the page, exactly how a FileSystemWritableFileStream export behaves.
    let outputBytes = 0;
    const target = new WritableStream<{ type: "write"; data: Uint8Array; position: number }>({
      write(chunk) {
        outputBytes = Math.max(outputBytes, chunk.position + chunk.data.byteLength);
      },
    });
    const resolved = await exportProject(project, {
      format: "webm",
      quality: "draft",
      fps: 24,
      width: 640,
      height: 360,
      target,
      onProgress: ({ framesDone, totalFrames, audioMixedUs }: { framesDone?: number; totalFrames?: number; audioMixedUs?: number }) => {
        if (audioMixedUs !== undefined && audioMixedUs > audioMixedUsMax) audioMixedUsMax = audioMixedUs;
        if (framesDone === undefined || totalFrames === undefined) return;
        total = totalFrames;
        if (framesDone >= nextSampleAt) {
          nextSampleAt = framesDone + Math.max(200, Math.floor(totalFrames / 40));
          samples.push({ frame: framesDone, heapMB: heap() });
        }
      },
    });
    return {
      resolvedBytes: resolved.byteLength,
      outputMB: outputBytes / 1_048_576,
      totalFrames: total,
      samples,
      audioMixedSec: Math.round(audioMixedUsMax / 1_000_000),
    };
  });
  const wallSec = Math.round((Date.now() - started) / 1000);

  expect(result.resolvedBytes).toBe(0); // streamed — nothing retained
  expect(result.outputMB).toBeGreaterThan(0.5);
  expect(result.samples.length).toBeGreaterThan(10);

  // Streaming means the heap has nothing to honestly accumulate: after the
  // warmup fifth (caches, decoder pools, texture atlases fill once) the
  // sampled heap must stay inside a flat budget.
  const settled = result.samples
    .filter((sample) => sample.frame > result.totalFrames / 5)
    .map((sample) => sample.heapMB);
  const spread = Math.max(...settled) - Math.min(...settled);
  const peakHeap = Math.max(...result.samples.map((sample) => sample.heapMB));
  const trace = result.samples.map((sample) => `${sample.frame}:${sample.heapMB.toFixed(0)}MB`).join(" ");
  expect(spread, `settled heap spread ${spread.toFixed(0)}MB — ${trace}`).toBeLessThan(150);
  expect(peakHeap, trace).toBeLessThan(1000);

  expect(errors, errors.join(" | ")).toEqual([]);
  recordMetrics("long-export", {
    minutes: MINUTES,
    clips: summary.clipCount,
    frames: result.totalFrames,
    wallSec,
    encodedFps: Number((result.totalFrames / wallSec).toFixed(1)),
    outputMB: Number(result.outputMB.toFixed(1)),
    streaming: true,
    audioMixedSec: result.audioMixedSec,
    heapPeakMB: Math.round(peakHeap),
    settledHeapSpreadMB: Math.round(spread),
  });
});
