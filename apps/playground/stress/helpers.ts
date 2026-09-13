/**
 * Shared plumbing for the stress tier: the synthetic-timeline builder, heap
 * sampling, canvas probes (same frame-index-color technique as the e2e
 * suite), and the metrics file the Production Readiness docs page quotes.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const FIXTURE_FPS = 30;
export const FIXTURE_DURATION_US = 4_000_000; // e2e-frames.webm: 4s, frame N = color(N)

/**
 * Playback-tracking tolerance, in fixture frames. Sized for software
 * rendering (SwiftShader CI decodes well behind realtime — a steady ~20-25
 * frame decode-behind is the environment, not a bug); on real hardware the
 * golden e2e holds 12. A stall, wedge, or blackout blows through any
 * tolerance, which is what these gates exist to catch — the recorded
 * hit-rate/lag metrics are what to watch run over run.
 */
export const MAX_LAG_FRAMES = Number(process.env.STRESS_MAX_LAG_FRAMES ?? 30);

/**
 * Wrap-aware frame distance on a repeating clip chain: the expected frame is
 * a sawtooth over each clip (period = clip length in frames), so a plain
 * |shown − expected| misreads samples taken just after a cut.
 */
export function lagFrames(shown: number, expected: number, periodFrames: number): number {
  const raw = Math.abs(shown - expected) % periodFrames;
  return Math.min(raw, periodFrames - raw);
}

// ---------------------------------------------------------------------------
// Metrics: each scenario appends its numbers; the file is the artifact the
// nightly job uploads and the docs page quotes.
// ---------------------------------------------------------------------------

const RESULTS_PATH = path.resolve(HERE, "../stress-results.json");

export function recordMetrics(scenario: string, data: Record<string, unknown>): void {
  let all: Record<string, unknown> = {};
  try {
    all = JSON.parse(readFileSync(RESULTS_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    // first scenario of the run
  }
  all[scenario] = { ...data, at: new Date().toISOString() };
  mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  writeFileSync(RESULTS_PATH, JSON.stringify(all, null, 2) + "\n");
  console.log(`[stress:${scenario}]`, JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Page plumbing
// ---------------------------------------------------------------------------

export async function loadFixture(page: Page): Promise<void> {
  await page.goto("/?src=/e2e-frames.webm");
  await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
  // The default demo document (main clip + title) is replaced by each
  // scenario's synthetic timeline; remove the overlay title up front.
  await page.evaluate(() => {
    const { project } = (window as never as { __mirai: { project: { dispatch(c: unknown): void } } }).__mirai;
    project.dispatch({ type: "clip/remove", payload: { clipId: "title" } });
  });
}

/** Force GC (when exposed) and read the precise JS heap, in MB. */
export async function heapMB(page: Page): Promise<number> {
  return page.evaluate(() => {
    (window as never as { gc?: () => void }).gc?.();
    const memory = (performance as never as { memory?: { usedJSHeapSize: number } }).memory;
    return memory ? Math.round(memory.usedJSHeapSize / 1_048_576) : -1;
  });
}

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.includes("favicon") && !text.includes("404")) {
      errors.push(text);
    }
  });
  return errors;
}

/** Center pixel of the canvas → fixture frame index (see golden-frames.spec). */
export async function shownFrame(page: Page): Promise<number> {
  const pixel = await page.evaluate(() => {
    const canvas = document.getElementById("stage") as HTMLCanvasElement;
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    const ctx = probe.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(canvas, canvas.width / 2, canvas.height / 2, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r: r!, g: g!, b: b! };
  });
  return Math.round(pixel.g / 16) * 16 + Math.round(pixel.r / 16);
}

// ---------------------------------------------------------------------------
// Synthetic timelines
// ---------------------------------------------------------------------------

export interface SyntheticOptions {
  /** Total timeline length. */
  minutes: number;
  /** Overlay tracks on top of the base video chain (each gets text/captions/animated clips). */
  overlayTracks: number;
  /** Sprinkle colorAdjust/blur effects onto some base clips. */
  withEffects?: boolean;
  /** Add transitions across some base-chain cuts (clips get trim headroom for it). */
  withTransitions?: boolean;
}

export interface SyntheticSummary {
  clipCount: number;
  transitionCount: number;
  durationUs: number;
}

/**
 * Build a dense timeline out of the 4s fixture:
 * - v1: a contiguous chain of full-frame video clips of the SAME asset. With
 *   transitions enabled, clips play media [0.5s..3.5s) (0.5s handles each
 *   side); without, the full 4s. The chain keeps the canvas center owned by
 *   the fixture, so frame-index probes stay exact.
 * - overlay tracks: staggered small text clips (animated), karaoke captions,
 *   and scaled-down video clips positioned OFF-center.
 */
export async function buildSyntheticTimeline(
  page: Page,
  options: SyntheticOptions,
): Promise<SyntheticSummary> {
  return page.evaluate((opts: SyntheticOptions) => {
    const { project } = (window as never as {
      __mirai: { project: { dispatch(c: unknown): void; transaction(fn: () => void): void; getState(): { doc: { clips: Record<string, unknown>; transitions: Record<string, unknown> } } } };
    }).__mirai;
    const durationUs = Math.round(opts.minutes * 60_000_000);
    const baseLenUs = opts.withTransitions ? 3_000_000 : 4_000_000;
    const trimUs = opts.withTransitions ? 500_000 : 0;

    project.transaction(() => {
      // Base chain on v1 (track exists from the playground scaffold).
      const baseClips: string[] = [];
      for (let start = 0, i = 0; start < durationUs; start += baseLenUs, i++) {
        const id = `base-${i}`;
        project.dispatch({
          type: "clip/add",
          payload: {
            kind: "video", id, trackId: "v1", assetId: "media",
            startUs: start, durationUs: Math.min(baseLenUs, durationUs - start), trimStartUs: trimUs,
          },
        });
        baseClips.push(id);
        if (opts.withEffects && i % 5 === 2) {
          project.dispatch({
            type: "effect/add",
            payload: { clipId: id, kind: "colorAdjust", params: { contrast: 0.15, saturation: 0.2 } },
          });
        }
      }
      if (opts.withTransitions) {
        // Every 7th cut gets a dissolve (dedicated decode lanes under load).
        for (let i = 6; i < baseClips.length - 1; i += 7) {
          project.dispatch({
            type: "transition/add",
            payload: {
              kind: "crossDissolve", fromClipId: baseClips[i]!, toClipId: baseClips[i + 1]!,
              durationUs: 600_000,
            },
          });
        }
      }

      // Overlay tracks: text (animated), captions, and small offset videos.
      for (let t = 0; t < opts.overlayTracks; t++) {
        const trackId = `stress-t${t}`;
        project.dispatch({ type: "track/add", payload: { id: trackId, kind: "video" } });
        const stagger = (t + 1) * 700_000;
        const stepUs = 10_000_000; // one clip per 10s per track
        for (let start = stagger, i = 0; start < durationUs - 3_000_000; start += stepUs, i++) {
          const flavor = (t + i) % 3;
          if (flavor === 0) {
            const id = `txt-${t}-${i}`;
            project.dispatch({
              type: "clip/add",
              payload: {
                kind: "text", id, trackId, startUs: start, durationUs: 3_000_000,
                text: `layer ${t} clip ${i}`, fontSizePx: 24, color: "#e8e8ec",
                transform: { x: 0.15 + 0.14 * t, y: 0.08 + 0.07 * t, opacity: 0.85 },
              },
            });
            project.dispatch({ type: "keyframe/set", payload: { clipId: id, property: "opacity", timeUs: 0, value: 0 } });
            project.dispatch({ type: "keyframe/set", payload: { clipId: id, property: "opacity", timeUs: 500_000, value: 0.85 } });
            project.dispatch({ type: "keyframe/set", payload: { clipId: id, property: "opacity", timeUs: 2_500_000, value: 0.85 } });
            project.dispatch({ type: "keyframe/set", payload: { clipId: id, property: "opacity", timeUs: 3_000_000, value: 0 } });
          } else if (flavor === 1) {
            project.dispatch({
              type: "clip/add",
              payload: {
                kind: "caption", id: `cap-${t}-${i}`, trackId, startUs: start, durationUs: 3_000_000,
                words: ["stress", "layer", String(t), "clip", String(i)].map((text, w) => ({
                  text, startUs: w * 600_000, durationUs: 600_000,
                })),
                style: { preset: "karaoke", fontSizeFrac: 0.035 },
                transform: { x: 0.5, y: 0.86 - 0.05 * (t % 3) },
              },
            });
          } else {
            // Small picture-in-picture video, off-center so the base chain
            // keeps owning the center pixel.
            project.dispatch({
              type: "clip/add",
              payload: {
                kind: "video", id: `pip-${t}-${i}`, trackId, assetId: "media",
                startUs: start, durationUs: 2_000_000,
                transform: { x: 0.85, y: 0.15 + 0.1 * (t % 4), scale: 0.15 },
              },
            });
          }
        }
      }
    });

    const doc = project.getState().doc;
    return {
      clipCount: Object.keys(doc.clips).length,
      transitionCount: Object.keys(doc.transitions).length,
      durationUs,
    };
  }, options);
}

/** Expected fixture frame at a timeline position on the base chain. */
export function expectedFrame(timelineUs: number, withTransitions: boolean): number {
  const baseLenUs = withTransitions ? 3_000_000 : 4_000_000;
  const trimUs = withTransitions ? 500_000 : 0;
  const mediaUs = trimUs + (timelineUs % baseLenUs);
  return Math.floor((mediaUs * FIXTURE_FPS) / 1_000_000);
}
