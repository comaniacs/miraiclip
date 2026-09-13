/**
 * Scenario D — export throughput benchmark.
 * A fixed 60s composition (video chain + effects + transitions + captions on
 * 4 overlay tracks) exported at 640×360/30fps: 1800 frames, timed. The gate
 * is a conservative floor (STRESS_MIN_FPS, default 5 — swiftshader CI is the
 * worst case); the real value is the recorded number, tracked run over run
 * and quoted on the Production Readiness page.
 *
 * When apps/playground/public/e2e-4k.webm exists (generate locally with
 * stress/make-4k-fixture.sh — too big to commit), a second benchmark runs
 * the 4K→1080p path.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
  buildSyntheticTimeline,
  collectConsoleErrors,
  loadFixture,
  recordMetrics,
} from "./helpers";

const MIN_FPS = Number(process.env.STRESS_MIN_FPS ?? 5);

async function timedExport(
  page: import("@playwright/test").Page,
  options: Record<string, unknown>,
): Promise<{ wallSec: number; frames: number; outputMB: number; fps: number }> {
  const started = Date.now();
  const result = await page.evaluate(async (exportOptions) => {
    const { project, exportProject } = (window as never as {
      __mirai: { project: unknown; exportProject: (p: unknown, o: unknown) => Promise<Uint8Array> };
    }).__mirai;
    let frames = 0;
    const bytes = await exportProject(project, {
      ...(exportOptions as Record<string, unknown>),
      onProgress: ({ framesDone }: { framesDone?: number }) => {
        if (framesDone !== undefined) frames = framesDone;
      },
    });
    return { frames, outputMB: bytes.byteLength / 1_048_576 };
  }, options as never);
  const wallSec = (Date.now() - started) / 1000;
  return {
    wallSec: Number(wallSec.toFixed(1)),
    frames: result.frames,
    outputMB: Number(result.outputMB.toFixed(1)),
    fps: Number((result.frames / wallSec).toFixed(1)),
  };
}

test("60s composition export throughput stays above the floor", async ({ page }) => {
  test.setTimeout(30 * 60_000);
  const errors = collectConsoleErrors(page);
  await loadFixture(page);
  const summary = await buildSyntheticTimeline(page, {
    minutes: 1,
    overlayTracks: 4,
    withEffects: true,
    withTransitions: true,
  });

  const run = await timedExport(page, { format: "webm", quality: "draft", fps: 30, width: 640, height: 360 });
  expect(run.frames).toBeGreaterThanOrEqual(1750);
  expect(run.fps, `encoded ${run.frames} frames in ${run.wallSec}s`).toBeGreaterThanOrEqual(MIN_FPS);
  expect(errors, errors.join(" | ")).toEqual([]);
  recordMetrics("throughput-640x360", {
    clips: summary.clipCount,
    frames: run.frames,
    wallSec: run.wallSec,
    encodedFps: run.fps,
    outputMB: run.outputMB,
    floorFps: MIN_FPS,
  });
});

const FOUR_K = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/e2e-4k.webm");
test.describe(() => {
  test.skip(!existsSync(FOUR_K), "e2e-4k.webm not present — run stress/make-4k-fixture.sh for the 4K benchmark");

  test("4K source → 1080p export throughput (local fixture)", async ({ page }) => {
    test.setTimeout(60 * 60_000);
    await page.goto("/?src=/e2e-4k.webm");
    await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
    const run = await timedExport(page, { format: "webm", quality: "standard", fps: 30, width: 1920, height: 1080 });
    expect(run.frames).toBeGreaterThan(0);
    recordMetrics("throughput-4k-to-1080p", run);
  });
});
