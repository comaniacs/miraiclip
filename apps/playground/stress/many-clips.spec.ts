/**
 * Scenario A — many-clip timeline, live playback.
 * ~140 clips across 10 tracks (video chain + animated text + karaoke captions
 * + picture-in-picture videos + sprinkled effects). The invariant is the same
 * one the golden e2e proves for one clip: whatever the player's clock says,
 * the frame on screen covers it — no re-seek storms, no stalls, no drift as
 * the compositor churns through overlapping clips.
 */
import { expect, test } from "@playwright/test";
import {
  MAX_LAG_FRAMES,
  buildSyntheticTimeline,
  collectConsoleErrors,
  expectedFrame,
  heapMB,
  lagFrames,
  loadFixture,
  recordMetrics,
  shownFrame,
} from "./helpers";

const PERIOD_FRAMES = 90; // 3s base clips × 30fps

test("140-clip timeline plays with the frame tracking the clock", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const errors = collectConsoleErrors(page);
  await loadFixture(page);
  const summary = await buildSyntheticTimeline(page, {
    minutes: 2,
    overlayTracks: 9,
    withEffects: true,
    withTransitions: true,
  });
  expect(summary.clipCount).toBeGreaterThanOrEqual(120);

  const heapBefore = await heapMB(page);
  await page.evaluate(() => (window as never as { __mirai: { player: { play(): void } } }).__mirai.player.play());

  // 30s of playback, sampled every 500ms against the PLAYER's clock.
  interface Sample { clock: number; shown: number; lag: number }
  const samples: Sample[] = [];
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(500);
    const clockUs = await page.evaluate(
      () => (window as never as { __mirai: { player: { timeUs: number } } }).__mirai.player.timeUs,
    );
    const shown = await shownFrame(page);
    const lag = lagFrames(shown, expectedFrame(clockUs, true), PERIOD_FRAMES);
    samples.push({ clock: Math.round(clockUs / 1000), shown, lag });
  }

  // Clock actually ran ~30s (± scheduling slack on loaded CI machines).
  const ranMs = samples.at(-1)!.clock - samples[0]!.clock;
  expect(ranMs).toBeGreaterThan(20_000);

  // The frame on screen keeps moving: a wedged pipeline or a black canvas
  // repeats one value; healthy playback shows dozens of distinct frames.
  const distinctShown = new Set(samples.map((sample) => sample.shown)).size;
  expect(distinctShown, "shown-frame values across 60 samples").toBeGreaterThanOrEqual(15);

  // Tracking: ≥90% of samples within MAX_LAG_FRAMES (dissolve windows blend
  // two fixture colors and clip boundaries have decode catch-up — those
  // samples are legal outliers; a stall or storm fails wholesale).
  const good = samples.filter((sample) => sample.lag <= MAX_LAG_FRAMES).length;
  const trace = samples.map((sample) => `${sample.shown}@${sample.clock}`).join(" ");
  expect(good / samples.length, trace).toBeGreaterThanOrEqual(0.9);

  // Seek deep into the timeline and confirm tracking resumes.
  await page.evaluate(
    () => (window as never as { __mirai: { player: { seek(us: number): void } } }).__mirai.player.seek(90_000_000),
  );
  await expect
    .poll(async () => {
      const clockUs = await page.evaluate(
        () => (window as never as { __mirai: { player: { timeUs: number } } }).__mirai.player.timeUs,
      );
      return lagFrames(await shownFrame(page), expectedFrame(clockUs, true), PERIOD_FRAMES);
    }, { timeout: 10_000 })
    .toBeLessThanOrEqual(MAX_LAG_FRAMES);

  const heapAfter = await heapMB(page);
  expect(errors, errors.join(" | ")).toEqual([]);
  // Lag distribution, not just the median: p95 is what a smoothness claim
  // would need, so record it run over run even though the gate is looser.
  const sortedLags = [...samples].sort((a, b) => a.lag - b.lag);
  recordMetrics("many-clips-playback", {
    clips: summary.clipCount,
    transitions: summary.transitionCount,
    tracks: 10,
    playedSec: Math.round(ranMs / 1000),
    trackingHitRate: Number((good / samples.length).toFixed(3)),
    lagToleranceFrames: MAX_LAG_FRAMES,
    medianLagFrames: sortedLags[Math.floor(samples.length / 2)]!.lag,
    lagP95Frames: sortedLags[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)]!.lag,
    maxLagFrames: Math.max(...samples.map((sample) => sample.lag)),
    distinctShownFrames: distinctShown,
    heapBeforeMB: heapBefore,
    heapAfterMB: heapAfter,
  });
});
