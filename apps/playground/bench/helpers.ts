/**
 * Device-benchmark plumbing (production-target gates 1+4). Everything is
 * measured on ACTUALLY PRESENTED frames: the fixture's pixel oracle decodes
 * which frame is on the canvas, sampled by an IN-PAGE rAF loop (one evaluate
 * per scenario, never a round trip per sample). Results carry the device
 * identity — a number without its device is not a publishable result.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_PATH = path.resolve(HERE, "../bench-results.json");
export const FIXTURE_1080 = path.resolve(HERE, "../public/bench-1080.webm");
export const HAS_1080 = existsSync(FIXTURE_1080);

// ---------------------------------------------------------------------------
// Results: every scenario records under the device it ran on.
// ---------------------------------------------------------------------------

export interface DeviceIdentity {
  gpu: string;
  userAgent: string;
  platform: string;
  hardwareConcurrency: number;
  software: boolean;
  /**
   * Whether WebCodecs claims HARDWARE VP9 1080p decode. A real GPU renderer
   * string does NOT imply hardware decode — Playwright's bundled Chromium
   * often renders on the GPU while decoding VP9 in software, and the two look
   * identical from the gates. Publishable numbers must say which decode path
   * they measured.
   */
  vp9HwDecode: boolean | "unknown";
}

export async function deviceIdentity(page: Page): Promise<DeviceIdentity> {
  const identity = await page.evaluate(async () => {
    let gpu = "unknown";
    try {
      const canvas = document.createElement("canvas");
      const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      if (gl && info) gpu = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
    } catch {
      // identity stays "unknown"
    }
    let vp9HwDecode: boolean | "unknown" = "unknown";
    try {
      const support = await VideoDecoder.isConfigSupported({
        codec: "vp09.00.41.08",
        codedWidth: 1920,
        codedHeight: 1080,
        hardwareAcceleration: "prefer-hardware",
      });
      vp9HwDecode = Boolean(support.supported);
    } catch {
      // stays "unknown"
    }
    return {
      gpu,
      vp9HwDecode,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
    };
  });
  return { ...identity, software: /swiftshader|llvmpipe|software/i.test(identity.gpu) };
}

export function recordBench(scenario: string, device: DeviceIdentity, data: Record<string, unknown>): void {
  let all: Record<string, unknown> = {};
  try {
    all = JSON.parse(readFileSync(RESULTS_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    // first scenario of the run
  }
  all[scenario] = { ...data, device, at: new Date().toISOString() };
  mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  writeFileSync(RESULTS_PATH, JSON.stringify(all, null, 2) + "\n");
  console.log(`[bench:${scenario}]`, JSON.stringify(data));
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]!;
}

// ---------------------------------------------------------------------------
// The Standard workload (scaled to the fixture in use): a base video owning
// the canvas center, two picture-in-picture videos (3 simultaneously visible
// sources), karaoke captions, an animated text overlay, and audio via a row
// of tone clips — all off-center so the pixel oracle stays exact.
//
// The PiPs deliberately reuse the base clip's ASSET at different trims: three
// concurrent positions in one file is the harder real-world shape (PiP zoom
// of the same footage), and it exercises the renderer's per-clip dedicated
// pipeline upgrade — on a single shared pipeline this workload wedges.
// ---------------------------------------------------------------------------

export async function buildStandardWorkload(page: Page, options: { src: string; durationUs: number }): Promise<void> {
  await page.goto(`/?src=${options.src}`);
  await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
  await page.evaluate(
    ([durationUs]) => {
      const { project } = (window as never as {
        __mirai: { project: { dispatch(c: unknown): void; transaction(fn: () => void): void } };
      }).__mirai;
      project.transaction(() => {
        project.dispatch({ type: "clip/remove", payload: { clipId: "title" } });
        // The scaffold's "main" clip spans the asset — stretch it to the range.
        project.dispatch({ type: "clip/trim", payload: { clipId: "main", trimStartUs: 0, durationUs } });
        project.dispatch({ type: "asset/add", payload: { id: "tone", kind: "video", src: "/e2e-tone.webm", durationUs: 4_000_000 } });
        for (let t = 0; t < 2; t++) {
          const trackId = `bench-pip-${t}`;
          project.dispatch({ type: "track/add", payload: { id: trackId, kind: "video" } });
          for (let start = 0, i = 0; start + 3_000_000 <= (durationUs as number); start += 3_000_000, i++) {
            project.dispatch({
              type: "clip/add",
              payload: {
                kind: "video", id: `pip-${t}-${i}`, trackId, assetId: "media",
                startUs: start, durationUs: 3_000_000, trimStartUs: (i % 8) * 400_000,
                transform: { x: 0.12 + 0.76 * t, y: 0.14, scale: 0.18 },
              },
            });
          }
        }
        const overlay = "bench-overlay";
        project.dispatch({ type: "track/add", payload: { id: overlay, kind: "video" } });
        for (let start = 0, i = 0; start + 4_000_000 <= (durationUs as number); start += 4_000_000, i++) {
          // Audio contribution: a corner tone clip, plus captions and an
          // animated label alternating on the same track.
          if (i % 2 === 0) {
            project.dispatch({
              type: "clip/add",
              payload: {
                kind: "video", id: `tone-${i}`, trackId: overlay, assetId: "tone",
                startUs: start, durationUs: 4_000_000,
                transform: { x: 0.88, y: 0.85, scale: 0.1 },
              },
            });
          } else {
            project.dispatch({
              type: "clip/add",
              payload: {
                kind: "caption", id: `cap-${i}`, trackId: overlay, startUs: start, durationUs: 3_500_000,
                words: ["bench", "standard", "workload", String(i)].map((text, w) => ({
                  text, startUs: w * 800_000, durationUs: 800_000,
                })),
                style: { preset: "karaoke", fontSizeFrac: 0.035 },
                transform: { x: 0.5, y: 0.88 },
              },
            });
            const labelId = `label-${i}`;
            project.dispatch({
              type: "clip/add",
              payload: {
                kind: "text", id: labelId, trackId: overlay, startUs: start, durationUs: 3_000_000,
                text: `scene ${i}`, fontSizePx: 28, color: "#e8e8ec",
                transform: { x: 0.2, y: 0.85, opacity: 0.9 },
              },
            });
            project.dispatch({ type: "keyframe/set", payload: { clipId: labelId, property: "x", timeUs: 0, value: 0.2 } });
            project.dispatch({ type: "keyframe/set", payload: { clipId: labelId, property: "x", timeUs: 3_000_000, value: 0.35 } });
          }
        }
      });
    },
    [options.durationUs] as const,
  );
}

// ---------------------------------------------------------------------------
// In-page samplers (functions are serialized into the page — keep them
// dependency-free). The pixel decode extends the e2e formula with blue high
// bits (bench-1080); the 4s fixtures read identically (b≈128 → high bits 0).
// ---------------------------------------------------------------------------

/** Injected: sample (presented frame, player clock) every rAF for `ms`. */
export function samplePresentation(page: Page, ms: number): Promise<{ tMs: number; clockUs: number; shown: number }[]> {
  return page.evaluate(async (durationMs) => {
    const canvas = document.getElementById("stage") as HTMLCanvasElement;
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    const ctx = probe.getContext("2d", { willReadFrequently: true })!;
    const shownFrame = (): number => {
      ctx.drawImage(canvas, canvas.width / 2, canvas.height / 2, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return Math.max(0, Math.round((b! - 128) / 16)) * 256 + Math.round(g! / 16) * 16 + Math.round(r! / 16);
    };
    const player = (window as never as { __mirai: { player: { timeUs: number } } }).__mirai.player;
    const samples: { tMs: number; clockUs: number; shown: number }[] = [];
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (): void => {
        const tMs = performance.now() - start;
        samples.push({ tMs, clockUs: player.timeUs, shown: shownFrame() });
        if (tMs < durationMs) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return samples;
  }, ms);
}

/**
 * Fail fast if the pixel oracle can't read this device's decode path. Colors
 * survive decode only when encoder and decoder agree on the YUV↔RGB matrix —
 * a stale fixture generated without colorspace tags decodes ~8-15 off per
 * channel under a hardware decoder, flipping 16-step quanta (frame N reads as
 * N+272). Run it parked on frame 0 right after load: a mismatch fails in ~1s
 * with the measured channels instead of poisoning every seek with timeouts.
 */
export async function assertPixelOracle(page: Page): Promise<void> {
  const probe = await page.evaluate(async () => {
    const canvas = document.getElementById("stage") as HTMLCanvasElement;
    const probeCanvas = document.createElement("canvas");
    probeCanvas.width = probeCanvas.height = 1;
    const ctx = probeCanvas.getContext("2d", { willReadFrequently: true })!;
    const read = (): { r: number; g: number; b: number; shown: number } => {
      ctx.drawImage(canvas, canvas.width / 2, canvas.height / 2, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const shown = Math.max(0, Math.round((b! - 128) / 16)) * 256 + Math.round(g! / 16) * 16 + Math.round(r! / 16);
      return { r: r!, g: g!, b: b!, shown };
    };
    // Parked on frame 0 at load; software decode of the first 1080p frame can
    // take a while, so poll generously — a color mismatch is stable and will
    // still fail, just after the window instead of instantly.
    const deadline = performance.now() + 30_000;
    let last = read();
    while (performance.now() < deadline) {
      last = read();
      if (last.shown === 0) return { ok: true, ...last };
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    }
    return { ok: false, ...last };
  });
  if (!probe.ok) {
    throw new Error(
      `pixel oracle mismatch: parked frame 0 reads as frame ${probe.shown} ` +
        `(rgb ${probe.r},${probe.g},${probe.b} — frame 0 should read r≈0, g≈0, b≈128). ` +
        `This device's decoder disagrees with the fixture's color conversion. ` +
        `Regenerate the fixture with the colorspace-tagged script: ` +
        `bash apps/playground/bench/make-bench-fixture.sh`,
    );
  }
}

/** Diagnostic snapshot: what frame the canvas shows and where the clock is. */
export function presentedState(page: Page): Promise<{ shown: number; clockUs: number }> {
  return page.evaluate(() => {
    const canvas = document.getElementById("stage") as HTMLCanvasElement;
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    const ctx = probe.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(canvas, canvas.width / 2, canvas.height / 2, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const shown = Math.max(0, Math.round((b! - 128) / 16)) * 256 + Math.round(g! / 16) * 16 + Math.round(r! / 16);
    const player = (window as never as { __mirai: { player: { timeUs: number } } }).__mirai.player;
    return { shown, clockUs: player.timeUs };
  });
}

/**
 * Injected: seek and poll every rAF until the CORRECT target frame is
 * presented (±1 frame). A moved playhead over a stale frame is NOT a
 * completed seek. `expectedFrame` is the fixture frame the target maps to
 * (caller owns the timeline→media math). Returns ms-to-correct-frame, or -1
 * on timeout.
 */
export function timedSeek(page: Page, targetUs: number, expectedFrame: number, timeoutMs = 15_000): Promise<number> {
  return page.evaluate(
    async ([target, expected, timeout]) => {
      const canvas = document.getElementById("stage") as HTMLCanvasElement;
      const probe = document.createElement("canvas");
      probe.width = probe.height = 1;
      const ctx = probe.getContext("2d", { willReadFrequently: true })!;
      const shownFrame = (): number => {
        ctx.drawImage(canvas, canvas.width / 2, canvas.height / 2, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return Math.max(0, Math.round((b! - 128) / 16)) * 256 + Math.round(g! / 16) * 16 + Math.round(r! / 16);
      };
      const player = (window as never as { __mirai: { player: { seek(us: number): void } } }).__mirai.player;
      const start = performance.now();
      player.seek(target as number);
      return await new Promise<number>((resolve) => {
        const poll = (): void => {
          const elapsed = performance.now() - start;
          // Floor at 0.1ms: an instant match must stay distinguishable from
          // the -1 timeout sentinel (a 0 once failed a >0 success gate).
          if (Math.abs(shownFrame() - (expected as number)) <= 1) resolve(Math.max(0.1, Math.round(elapsed * 10) / 10));
          else if (elapsed > (timeout as number)) resolve(-1);
          else requestAnimationFrame(poll);
        };
        poll();
      });
    },
    [targetUs, expectedFrame, timeoutMs] as const,
  );
}
