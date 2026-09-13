/**
 * Gate 1 — presentation quality on the Standard workload (1080p30 sources,
 * three simultaneously visible videos, captions, transforms, audio).
 * Everything derives from ACTUALLY PRESENTED frames via the pixel oracle,
 * sampled every rAF in-page.
 *
 * Production targets (reported, not hard-gated — the gates here are sanity
 * floors; the recorded distribution against the device identity is the
 * deliverable): timing error p95 ≤1 frame / p99 ≤2; missed deadlines <0.1%;
 * zero unexplained stalls >100ms; warm play-start p95 ≤150ms.
 *
 * Needs the locally generated 1080p fixture: bash bench/make-bench-fixture.sh
 */
import { expect, test } from "@playwright/test";
import {
  HAS_1080,
  assertPixelOracle,
  buildStandardWorkload,
  deviceIdentity,
  percentile,
  recordBench,
  samplePresentation,
} from "./helpers";

const FPS = 30;

test.describe(() => {
  test.skip(!HAS_1080, "bench-1080.webm not present — run bench/make-bench-fixture.sh");

  test("standard-workload playback: presented-frame timing distribution", async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await buildStandardWorkload(page, { src: "/bench-1080.webm", durationUs: 58_000_000 });
    await assertPixelOracle(page); // this decode path must read fixture colors exactly
    const device = await deviceIdentity(page);

    // Warm play-start latency: play() → the presented frame ADVANCES (≥2
    // frames past the parked frame — one step could be the pending paint).
    await page.evaluate(() => (window as never as { __mirai: { player: { seek(us: number): void } } }).__mirai.player.seek(0));
    await page.waitForTimeout(1_500); // settle: parked on frame 0
    const playStartMs = await page.evaluate(async () => {
      const canvas = document.getElementById("stage") as HTMLCanvasElement;
      const probe = document.createElement("canvas");
      probe.width = probe.height = 1;
      const ctx = probe.getContext("2d", { willReadFrequently: true })!;
      const shownFrame = (): number => {
        ctx.drawImage(canvas, canvas.width / 2, canvas.height / 2, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return Math.max(0, Math.round((b! - 128) / 16)) * 256 + Math.round(g! / 16) * 16 + Math.round(r! / 16);
      };
      const parked = shownFrame();
      const player = (window as never as { __mirai: { player: { play(): void } } }).__mirai.player;
      const start = performance.now();
      player.play();
      return await new Promise<number>((resolve) => {
        const poll = (): void => {
          const elapsed = performance.now() - start;
          if (shownFrame() >= parked + 2) resolve(Math.round(elapsed * 10) / 10);
          else if (elapsed > 5_000) resolve(-1);
          else requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      });
    });

    // 40s of playback, sampled every rAF against the player's clock.
    const samples = await samplePresentation(page, 40_000);
    await page.evaluate(() => (window as never as { __mirai: { player: { pause(): void } } }).__mirai.player.pause());
    // Software GL pays ~100ms per 1080p canvas readback — and with three
    // dedicated decode lanes live (the PiP workload), a SwiftShader rAF runs
    // ~400ms. The floor only proves the sampler isn't wedged; a real GPU
    // samples at display rate (thousands in 40s).
    expect(samples.length).toBeGreaterThan(device.software ? 40 : 100);

    // Timing error: presented frame vs the frame the clock calls for.
    const lags = samples.map((s) => Math.abs(Math.floor((s.clockUs * FPS) / 1_000_000) - s.shown));
    const sortedLags = [...lags].sort((a, b) => a - b);
    const missed = lags.filter((lag) => lag > 1).length;

    // Stalls: the presented frame not changing while the clock advances
    // beyond 100ms. Distinct from lag — a stall is the SAME pixels lingering.
    let stallCount = 0;
    let longestStallMs = 0;
    let runStart = 0;
    const closeRun = (endIndex: number): void => {
      const heldMs = samples[endIndex]!.tMs - samples[runStart]!.tMs;
      const clockAdvancedMs = (samples[endIndex]!.clockUs - samples[runStart]!.clockUs) / 1_000;
      if (heldMs > 100 && clockAdvancedMs > 100) {
        stallCount++;
        longestStallMs = Math.max(longestStallMs, heldMs);
      }
    };
    for (let i = 1; i < samples.length; i++) {
      if (samples[i]!.shown !== samples[runStart]!.shown) {
        closeRun(i - 1);
        runStart = i;
      }
    }
    closeRun(samples.length - 1);

    // Presented cadence: distinct-frame changes per second of playback.
    let changes = 0;
    for (let i = 1; i < samples.length; i++) if (samples[i]!.shown !== samples[i - 1]!.shown) changes++;
    const playedSec = (samples.at(-1)!.tMs - samples[0]!.tMs) / 1_000;
    const presentedFps = changes / playedSec;

    const result = {
      workload: "standard-1080p30 (3 visible videos + captions + transforms + audio)",
      samples: samples.length,
      playedSec: Number(playedSec.toFixed(1)),
      playStartMs,
      lagP50Frames: percentile(sortedLags, 0.5),
      lagP95Frames: percentile(sortedLags, 0.95),
      lagP99Frames: percentile(sortedLags, 0.99),
      lagMaxFrames: sortedLags.at(-1),
      missedDeadlinePct: Number(((missed / lags.length) * 100).toFixed(2)),
      stallsOver100ms: stallCount,
      longestStallMs: Math.round(longestStallMs),
      presentedFps: Number(presentedFps.toFixed(1)),
      targets: { lagP95: 1, lagP99: 2, missedPct: 0.1, stalls: 0, playStartP95Ms: 150 },
    };
    recordBench("presentation-standard", device, result);

    // Sanity floors only — a wedged player fails; a slow device reports.
    // Software GL cannot decode 1080p×3 in realtime at all (the CI baseline
    // records ~1.3 presented fps) — there the floor is just "not wedged".
    expect(playStartMs).toBeGreaterThan(0);
    expect(presentedFps).toBeGreaterThan(device.software ? 0.2 : 5);
    if (!device.software) expect(percentile(sortedLags, 0.5)).toBeLessThan(FPS * 2);
  });
});
