/**
 * Scenario C — asset churn past the decoder cap.
 * 20 distinct assets (the fixture under 20 cache-busting URLs → 20 demuxers,
 * 20 pipelines) on one sequential timeline, with the MediaManager capped at 4
 * active pipelines: playing across cuts and scrub-storming the whole range
 * forces constant LRU eviction and re-acquisition. The invariant: tracking
 * recovers after every jump and nothing errors — eviction must never wedge a
 * pipeline or leak decoders.
 */
import { expect, test } from "@playwright/test";
import { MAX_LAG_FRAMES, collectConsoleErrors, lagFrames, loadFixture, recordMetrics, shownFrame } from "./helpers";

const ASSETS = 20;
const CLIP_US = 2_000_000;
const PERIOD_FRAMES = 60; // 2s clips × 30fps
// The wrap-aware distance on a 60-frame period maxes out at 30 — a tolerance
// at or above that would pass anything, so cap it below the period's half.
const CHURN_TOLERANCE = Math.min(MAX_LAG_FRAMES, 25);

test("20-asset timeline survives playback across cuts and a scrub storm", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const errors = collectConsoleErrors(page);
  await loadFixture(page);

  await page.evaluate(
    ([assets, clipUs]) => {
      const { project } = (window as never as {
        __mirai: { project: { dispatch(c: unknown): void; transaction(fn: () => void): void } };
      }).__mirai;
      project.transaction(() => {
        // The demo clip from the scaffold occupies v1[0..4s) — remove it.
        project.dispatch({ type: "clip/remove", payload: { clipId: "main" } });
        for (let i = 0; i < (assets as number); i++) {
          project.dispatch({
            type: "asset/add",
            payload: { id: `asset-${i}`, kind: "video", src: `/e2e-frames.webm?churn=${i}`, durationUs: 4_000_000 },
          });
          project.dispatch({
            type: "clip/add",
            payload: {
              kind: "video", id: `churn-${i}`, trackId: "v1", assetId: `asset-${i}`,
              startUs: i * (clipUs as number), durationUs: clipUs as number,
            },
          });
        }
      });
    },
    [ASSETS, CLIP_US] as const,
  );

  const expectedAt = (timelineUs: number): number =>
    Math.floor(((timelineUs % CLIP_US) * 30) / 1_000_000);

  // Play across the first 5 cuts (each cut = a new asset's pipeline). The
  // hard gate is PROGRESS — the shown frame keeps changing as pipelines are
  // opened, evicted, and re-acquired (a wedged or permanently black player
  // repeats one value). Frame-level tracking under software decode runs a
  // steady ~20 frames behind realtime, so the hit rate is recorded as a
  // metric rather than gated tightly; the paused probes below are the exact
  // correctness check.
  await page.evaluate(() => (window as never as { __mirai: { player: { play(): void } } }).__mirai.player.play());
  let trackingHits = 0;
  const shownValues = new Set<number>();
  const playSamples = 24;
  for (let i = 0; i < playSamples; i++) {
    await page.waitForTimeout(500);
    const clockUs = await page.evaluate(
      () => (window as never as { __mirai: { player: { timeUs: number } } }).__mirai.player.timeUs,
    );
    const shown = await shownFrame(page);
    shownValues.add(shown);
    if (lagFrames(shown, expectedAt(clockUs), PERIOD_FRAMES) <= CHURN_TOLERANCE) trackingHits++;
  }
  expect(shownValues.size, "distinct shown frames across 24 samples").toBeGreaterThanOrEqual(8);
  await page.evaluate(() => (window as never as { __mirai: { player: { pause(): void } } }).__mirai.player.pause());

  // Scrub storm: 30 deterministic pseudo-random jumps across all 20 assets.
  const started = Date.now();
  let seed = 42;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
  for (let i = 0; i < 30; i++) {
    const target = Math.floor(rand() * (ASSETS * CLIP_US - 200_000));
    await page.evaluate(
      ([us]) => (window as never as { __mirai: { player: { seek(us: number): void } } }).__mirai.player.seek(us as number),
      [target] as const,
    );
    await page.waitForTimeout(150); // scrub cadence: next jump before decode settles
  }
  const stormSec = Number(((Date.now() - started) / 1000).toFixed(1));

  // After the storm: three paused probes must land on the exact frame.
  for (const targetUs of [1_100_000, 21_100_000, 37_100_000]) {
    await page.evaluate(
      ([us]) => (window as never as { __mirai: { player: { seek(us: number): void } } }).__mirai.player.seek(us as number),
      [targetUs] as const,
    );
    await expect
      .poll(async () => Math.abs((await shownFrame(page)) - expectedAt(targetUs)), { timeout: 15_000 })
      .toBeLessThanOrEqual(1);
  }

  expect(errors, errors.join(" | ")).toEqual([]);
  recordMetrics("asset-churn", {
    assets: ASSETS,
    decoderCap: 4,
    playbackHitRate: Number((trackingHits / playSamples).toFixed(3)),
    lagToleranceFrames: CHURN_TOLERANCE,
    distinctShownFrames: shownValues.size,
    stormSeeks: 30,
    stormSec,
  });
});
