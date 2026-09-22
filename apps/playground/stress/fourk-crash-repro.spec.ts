/**
 * Field-crash repro: a ~4-minute 4K-source timeline (captions + animated text
 * + transitions + same-asset PiPs) exported the way the PLAYGROUND does it —
 * buffered output (no streaming target), source fps, composition size — while
 * the harness watches what the page cannot see: per-process Chrome memory at
 * the OS level, sampled alongside frame progress and the JS heap.
 *
 * Reported failure (2026-09-13, reference laptop, renderer 0.4.0): a 257s 4K
 * export with captions/text/animations/transitions pegged the CPU at 100%,
 * then the SYSTEM restarted — the signature of unified/GPU memory exhaustion
 * (kernel panic), which `performance.memory` never registers. The prior
 * software-GL shared-image leak was concluded "real GPUs unaffected" from
 * CI-class runs only; this harness is how that claim gets tested at scale.
 *
 * The watchdog ABORTS the export (AbortSignal) before the machine is at risk:
 *   - total Chrome RSS above REPRO_MAX_GB (default 10), or
 *   - no frame progress for REPRO_STALL_SEC (default 180).
 * Either abort fails the test with the full memory/progress curve — the curve
 * IS the diagnostic. A clean run records the same curve as the healthy
 * baseline in stress-results.json.
 *
 * Needs the local 4K fixture: bash stress/make-4k-fixture.sh
 * Run: pnpm --filter miraiclip-playground repro:4k
 * Knobs: REPRO_SECONDS (timeline length, default 257), REPRO_MAX_GB,
 *        REPRO_STALL_SEC, REPRO_QUALITY (default "standard").
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { buildSyntheticTimeline, collectConsoleErrors, recordMetrics } from "./helpers";

const run = promisify(execFile);
// Knobs shape the repro to the reported config:
//   REPRO_FIXTURE  — file in public/ to load (default e2e-4k.webm)
//   REPRO_BARE=1   — single full-length clip only (no synthetic overlays)
//   REPRO_WORKER=1 — export through the WORKER (exportProjectViaWorker)
//   REPRO_STREAM=1 — streamed output into a discard target (save-picker shape)
//   REPRO_FPS      — output fps; "source" (default) = no override
const FIXTURE = process.env.REPRO_FIXTURE ?? "e2e-4k.webm";
const FIXTURE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../public/${FIXTURE}`);
const SECONDS = Number(process.env.REPRO_SECONDS ?? 257);
const MAX_GB = Number(process.env.REPRO_MAX_GB ?? 10);
const STALL_SEC = Number(process.env.REPRO_STALL_SEC ?? 180);
const QUALITY = process.env.REPRO_QUALITY ?? "standard";
const BARE = Boolean(process.env.REPRO_BARE);
const WORKER = Boolean(process.env.REPRO_WORKER);
const STREAM = Boolean(process.env.REPRO_STREAM);
const FPS = process.env.REPRO_FPS ?? "source";

interface ChromeMem {
  totalMB: number;
  gpuMB: number;
  maxRendererMB: number;
  processes: number;
}

/**
 * Sum Chrome's resident memory at the OS level via `ps` (macOS + Linux).
 * RSS understates macOS IOSurface/GPU allocations, but a runaway still shows
 * as steady growth here — and growth-until-restart is what we're hunting.
 */
async function chromeMem(executableHint: string): Promise<ChromeMem> {
  const { stdout } = await run("ps", ["-axo", "rss=,command="]);
  let totalKB = 0;
  let gpuKB = 0;
  let maxRendererKB = 0;
  let processes = 0;
  for (const line of stdout.split("\n")) {
    const match = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (!match) continue;
    const command = match[2]!;
    const isChrome =
      /chromium|chrome/i.test(command) &&
      (command.includes("--type=") || (executableHint !== "" && command.includes(executableHint)));
    if (!isChrome) continue;
    const kb = Number(match[1]);
    processes++;
    totalKB += kb;
    if (command.includes("--type=gpu-process")) gpuKB += kb;
    if (command.includes("--type=renderer")) maxRendererKB = Math.max(maxRendererKB, kb);
  }
  return {
    totalMB: Math.round(totalKB / 1024),
    gpuMB: Math.round(gpuKB / 1024),
    maxRendererMB: Math.round(maxRendererKB / 1024),
    processes,
  };
}

interface ReproState {
  frames: number;
  total: number;
  phase: string;
  done: boolean;
  error: string;
  bytes: number;
}

test.describe(() => {
  test.skip(!existsSync(FIXTURE_PATH), `${FIXTURE} not present — generate it first (see stress/make-4k-fixture.sh)`);

  test(`${SECONDS}s workload (${FIXTURE}) exports without runaway process memory`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(`/?src=/${FIXTURE}`);
    await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
    await page.evaluate(() => {
      const { project } = (window as never as { __mirai: { project: { dispatch(c: unknown): void } } }).__mirai;
      project.dispatch({ type: "clip/remove", payload: { clipId: "title" } });
    });
    const summary = BARE
      ? await page.evaluate((seconds) => {
          // The reported shape: ONE full-length clip of the loaded source.
          const { project } = (window as never as {
            __mirai: { project: { dispatch(c: unknown): void; getState(): { doc: { clips: Record<string, { durationUs: number }> } } } };
          }).__mirai;
          const durationUs = Math.round(seconds * 1_000_000);
          project.dispatch({ type: "clip/trim", payload: { clipId: "main", trimStartUs: 0, durationUs } });
          return { clipCount: 1, transitionCount: 0, durationUs };
        }, SECONDS)
      : await buildSyntheticTimeline(page, {
          minutes: SECONDS / 60,
          overlayTracks: 4, // captions + animated text + same-asset 4K PiPs
          withEffects: true,
          withTransitions: true,
        });

    // Kick the export WITHOUT awaiting — the poll loop below owns the clock.
    // Options mirror the playground's Export button exactly: buffered output
    // (no target), no fps override (source fps), no size override
    // (composition size), abortable.
    await page.evaluate(
      ([quality, useWorker, useStream, fpsSetting]) => {
        const w = window as never as {
          __mirai: {
            project: unknown;
            exportProject: (p: unknown, o: unknown) => Promise<Uint8Array>;
            exportProjectViaWorker: (o: unknown) => Promise<Uint8Array>;
          };
          __repro: ReproState & { abort: () => void };
        };
        const controller = new AbortController();
        const state: ReproState & { abort: () => void } = {
          frames: 0,
          total: 0,
          phase: "starting",
          done: false,
          error: "",
          bytes: 0,
          abort: () => controller.abort(),
        };
        w.__repro = state;
        let streamedBytes = 0;
        const options: Record<string, unknown> = {
          format: "webm",
          quality,
          signal: controller.signal,
          ...(fpsSetting === "source" ? {} : { fps: Number(fpsSetting) }),
          // Streamed shape (what the save picker produces) with a discard
          // sink, so output bytes never accumulate anywhere.
          ...(useStream
            ? {
                target: new WritableStream<{ data: Uint8Array; position: number }>({
                  write(chunk) {
                    streamedBytes = Math.max(streamedBytes, chunk.position + chunk.data.byteLength);
                  },
                }),
              }
            : {}),
          onProgress: (p: { phase?: string; framesDone?: number; totalFrames?: number }) => {
            if (p.framesDone !== undefined) state.frames = p.framesDone;
            if (p.totalFrames !== undefined) state.total = p.totalFrames;
            if (p.phase) state.phase = p.phase;
          },
        };
        const exportPromise = useWorker
          ? w.__mirai.exportProjectViaWorker(options)
          : w.__mirai.exportProject(w.__mirai.project, options);
        void exportPromise
          .then((bytes) => {
            state.bytes = bytes.byteLength || streamedBytes;
            state.done = true;
          })
          .catch((error: unknown) => {
            state.error = String(error);
            state.done = true;
          });
      },
      [QUALITY, WORKER, STREAM, FPS] as const,
    );

    const executableHint = path.dirname(process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium");
    const samples: { t: number; frame: number; heapMB: number; chromeMB: number; gpuMB: number; rendererMB: number }[] = [];
    const started = Date.now();
    let aborted: "no" | "memory" | "stall" = "no";
    let lastProgressFrame = -1;
    let lastProgressAt = Date.now();
    let state: ReproState = { frames: 0, total: 0, phase: "starting", done: false, error: "", bytes: 0 };

    // Generous cap: 4K decode under software GL crawls; the stall watchdog is
    // what catches a wedge, not this ceiling.
    test.setTimeout(3 * 60 * 60_000);

    while (!state.done) {
      await page.waitForTimeout(2_000);
      state = await page.evaluate(() => {
        const w = window as never as { __repro: ReproState; gc?: () => void };
        return { ...w.__repro };
      });
      const heapMB = await page.evaluate(() => {
        (window as never as { gc?: () => void }).gc?.();
        const memory = (performance as never as { memory?: { usedJSHeapSize: number } }).memory;
        return memory ? Math.round(memory.usedJSHeapSize / 1_048_576) : -1;
      });
      const mem = await chromeMem(executableHint);
      samples.push({
        t: Math.round((Date.now() - started) / 1000),
        frame: state.frames,
        heapMB,
        chromeMB: mem.totalMB,
        gpuMB: mem.gpuMB,
        rendererMB: mem.maxRendererMB,
      });

      if (state.frames !== lastProgressFrame) {
        lastProgressFrame = state.frames;
        lastProgressAt = Date.now();
      }
      const stalled = !state.done && Date.now() - lastProgressAt > STALL_SEC * 1_000;
      const overBudget = mem.totalMB > MAX_GB * 1024;
      if (stalled || overBudget) {
        aborted = overBudget ? "memory" : "stall";
        await page.evaluate(() => (window as never as { __repro: { abort: () => void } }).__repro.abort());
        // Give the abort a moment to unwind, then stop sampling either way.
        await page.waitForTimeout(5_000);
        state = await page.evaluate(() => ({ ...(window as never as { __repro: ReproState }).__repro }));
        break;
      }
    }

    // Thin the curve for the ledger (keep first/last and ~120 evenly spaced).
    const keepEvery = Math.max(1, Math.floor(samples.length / 120));
    const curve = samples.filter((_, i) => i % keepEvery === 0 || i === samples.length - 1);
    const peak = samples.reduce(
      (acc, s) => ({
        chromeMB: Math.max(acc.chromeMB, s.chromeMB),
        gpuMB: Math.max(acc.gpuMB, s.gpuMB),
        rendererMB: Math.max(acc.rendererMB, s.rendererMB),
        heapMB: Math.max(acc.heapMB, s.heapMB),
      }),
      { chromeMB: 0, gpuMB: 0, rendererMB: 0, heapMB: 0 },
    );
    recordMetrics("fourk-crash-repro", {
      seconds: SECONDS,
      quality: QUALITY,
      fixture: FIXTURE,
      bare: BARE,
      worker: WORKER,
      streamed: STREAM,
      fps: FPS,
      clips: summary.clipCount,
      transitions: summary.transitionCount,
      software: Boolean(process.env.REPRO_SOFTWARE),
      aborted,
      framesReached: state.frames,
      totalFrames: state.total,
      lastPhase: state.phase,
      exportError: state.error || undefined,
      outputMB: state.bytes ? Number((state.bytes / 1_048_576).toFixed(1)) : 0,
      wallSec: Math.round((Date.now() - started) / 1000),
      peak,
      curve,
    });

    const trace = curve
      .map((s) => `${s.t}s f${s.frame} js${s.heapMB} chrome${s.chromeMB} gpu${s.gpuMB}`)
      .join(" | ");
    expect(
      aborted,
      `export aborted by the ${aborted} watchdog at frame ${state.frames}/${state.total} (phase ${state.phase}) — ${trace}`,
    ).toBe("no");
    expect(state.error, trace).toBe("");
    expect(state.bytes, "export produced no output").toBeGreaterThan(0);
    expect(errors, errors.join(" | ")).toEqual([]);
  });
});
