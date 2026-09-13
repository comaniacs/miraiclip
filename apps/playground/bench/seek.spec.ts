/**
 * Gate 4 — seek latency, measured to the CORRECT frame being PRESENTED
 * (a moved playhead over a stale frame is not a completed seek).
 *
 * Warm: repeated seeks within an already-open asset. Cold: the first seek
 * into a never-opened asset (demuxer open + decoder init included; later
 * colds also pay pipeline-cap eviction). Rapid: overlapping seeks must
 * coalesce — the LAST target wins and stale completions never overwrite it.
 *
 * Production targets (reported): warm p95 ≤150ms / p99 ≤300ms; cold p95
 * ≤500ms. Hard gates are correctness + completion; latency is the recorded
 * distribution against the device identity.
 */
import { expect, test } from "@playwright/test";
import {
  HAS_1080,
  assertPixelOracle,
  deviceIdentity,
  percentile,
  presentedState,
  recordBench,
  timedSeek,
} from "./helpers";

const SRC = HAS_1080 ? "/bench-1080.webm" : "/e2e-frames.webm";
const MAIN_US = HAS_1080 ? 58_000_000 : 4_000_000;
const FPS = 30;

test("warm, cold, and rapid seeks land on the correct presented frame", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  await page.goto(`/?src=${SRC}`);
  await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
  await assertPixelOracle(page); // this decode path must read fixture colors exactly
  const device = await deviceIdentity(page);
  // Software GL decodes a 1s 1080p GOP in seconds, not milliseconds — the
  // baseline needs headroom; a real device that needs it has a real problem.
  const SEEK_TIMEOUT = device.software ? 60_000 : 15_000;

  // Timeline: the main clip over [0, MAIN_US), then six never-opened assets
  // (cache-busted URLs → six distinct pipelines) in 2s regions after it.
  const COLD_ASSETS = 6;
  await page.evaluate(
    ([mainUs, coldAssets, src]) => {
      const { project } = (window as never as {
        __mirai: { project: { dispatch(c: unknown): void; transaction(fn: () => void): void } };
      }).__mirai;
      project.transaction(() => {
        project.dispatch({ type: "clip/remove", payload: { clipId: "title" } });
        project.dispatch({ type: "clip/trim", payload: { clipId: "main", trimStartUs: 0, durationUs: mainUs } });
        for (let i = 0; i < (coldAssets as number); i++) {
          project.dispatch({
            type: "asset/add",
            payload: { id: `cold-${i}`, kind: "video", src: `${src}?bench-cold=${i}`, durationUs: 4_000_000 },
          });
          project.dispatch({
            type: "clip/add",
            payload: {
              kind: "video", id: `coldclip-${i}`, trackId: "v1", assetId: `cold-${i}`,
              startUs: (mainUs as number) + i * 2_000_000, durationUs: 2_000_000,
            },
          });
        }
      });
    },
    [MAIN_US, COLD_ASSETS, SRC] as const,
  );
  // Open the main asset (paused first frame) before warm measurement. This is
  // a cold open (demuxer + decoder init included), reported separately below.
  const first = await timedSeek(page, 100_000, Math.floor((100_000 * FPS) / 1_000_000), SEEK_TIMEOUT);
  if (first <= 0) {
    // Timed out — say what the canvas is ACTUALLY doing, so a device-run
    // failure report carries the diagnosis with it.
    const diag = await presentedState(page);
    expect(
      first,
      `initial seek never presented the target frame (canvas shows frame ${diag.shown}, player clock ${diag.clockUs}µs, wanted frame 3 at 100000µs)`,
    ).toBeGreaterThan(0);
  }

  // Warm: 40 deterministic pseudo-random targets inside the open asset.
  let lcg = 1234;
  const rand = (): number => ((lcg = (lcg * 1103515245 + 12345) % 2 ** 31), lcg / 2 ** 31);
  const warm: number[] = [];
  const WARM_SEEKS = device.software ? 12 : 40;
  for (let i = 0; i < WARM_SEEKS; i++) {
    const targetUs = Math.floor(rand() * (MAIN_US - 400_000)) + 100_000;
    const ms = await timedSeek(page, targetUs, Math.floor((targetUs * FPS) / 1_000_000), SEEK_TIMEOUT);
    expect(ms, `warm seek to ${targetUs}µs timed out`).toBeGreaterThan(0);
    warm.push(ms);
  }
  const warmSorted = [...warm].sort((a, b) => a - b);

  // Cold: the FIRST seek into each never-opened asset. Targets are STAGGERED
  // per asset (media 0.4s + i·0.5s) so each expects a DIFFERENT frame — the
  // cold assets are copies of one file, and identical expected frames let the
  // canvas's leftover content read as an instant false completion.
  const cold: number[] = [];
  for (let i = 0; i < COLD_ASSETS; i++) {
    const intoUs = 400_000 + i * 250_000; // stays inside the 2s clip for all six
    const targetUs = MAIN_US + i * 2_000_000 + intoUs;
    const ms = await timedSeek(page, targetUs, Math.floor((intoUs * FPS) / 1_000_000), SEEK_TIMEOUT);
    expect(ms, `cold seek into asset ${i} timed out`).toBeGreaterThan(0);
    cold.push(ms);
  }
  const coldSorted = [...cold].sort((a, b) => a - b);

  // Rapid overlapping seeks: fire 15 at ~60ms cadence without awaiting; the
  // LAST target must win — a stale completion overwriting it fails here.
  const rapidTargets: number[] = [];
  for (let i = 0; i < 15; i++) rapidTargets.push(Math.floor(rand() * (MAIN_US - 400_000)) + 100_000);
  await page.evaluate(
    async ([targets]) => {
      const player = (window as never as { __mirai: { player: { seek(us: number): void } } }).__mirai.player;
      for (const target of targets as number[]) {
        player.seek(target);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    },
    [rapidTargets] as const,
  );
  const lastTarget = rapidTargets.at(-1)!;
  const settled = await timedSeek(page, lastTarget, Math.floor((lastTarget * FPS) / 1_000_000), SEEK_TIMEOUT);
  expect(settled, "rapid-seek storm never settled on the LAST target").toBeGreaterThan(0);
  // Hold: nothing stale overwrites it afterwards.
  await page.waitForTimeout(750);
  const held = await timedSeek(page, lastTarget, Math.floor((lastTarget * FPS) / 1_000_000), device.software ? 5_000 : 1_000);
  expect(held, "a stale seek completion overwrote the settled frame").toBeGreaterThan(0);

  recordBench("seek-latency", device, {
    fixture: SRC,
    initialColdOpenMs: first,
    warmSeeks: warm.length,
    warmP50Ms: percentile(warmSorted, 0.5),
    warmP95Ms: percentile(warmSorted, 0.95),
    warmP99Ms: percentile(warmSorted, 0.99),
    warmMaxMs: warmSorted.at(-1),
    coldSeeks: cold.length,
    coldP50Ms: percentile(coldSorted, 0.5),
    coldMaxMs: coldSorted.at(-1),
    coldAllMs: cold,
    rapidSettledMs: settled,
    targets: { warmP95: 150, warmP99: 300, coldP95: 500 },
  });

  // Loose sanity floor: an unbounded seek path shows up as seconds, not ms.
  expect(percentile(warmSorted, 0.95)).toBeLessThan(device.software ? 60_000 : 5_000);
});
