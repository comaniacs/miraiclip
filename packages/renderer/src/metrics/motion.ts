/**
 * Motion metrics: how much a piece of video moves, measured on small
 * greyscale frames. They catch the two ways motion graphics go wrong: frames
 * that hold still too long (a slideshow), and isolated jumps (a hard change
 * with calm on both sides, which reads as a glitch or a cut nobody hid).
 *
 * The measure is the mean absolute luma change between consecutive frames, on
 * a 0–255 scale, sampled at 192 px wide and 10 frames per second. Thresholds
 * were calibrated on films at that size and rate (decoded video, whose luma is
 * limited range), so frames rendered here are converted to the same range by
 * `lumaFrame`.
 */

/** A frame for measuring: luma in video (limited) range, 16–235, one value per pixel. */
export type LumaFrame = Float32Array;

/** The sample size and rate the thresholds are calibrated for. */
export const MOTION_SAMPLE = { width: 192, fps: 10 } as const;

/** Luma (BT.601) of RGBA pixels, in limited range like decoded video. */
export function lumaFrame(rgba: Uint8ClampedArray | Uint8Array): LumaFrame {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    const y = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
    out[j] = 16 + (y * 219) / 255;
  }
  return out;
}

/** Mean absolute difference between two frames of the same size (0–255). */
export function frameChange(a: LumaFrame, b: LumaFrame): number {
  if (a.length !== b.length) throw new Error(`frames differ in size (${a.length} vs ${b.length} pixels)`);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
  return a.length ? sum / a.length : 0;
}

/** The changes between consecutive frames: n frames give n − 1 steps. */
export function changeSeries(frames: readonly LumaFrame[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < frames.length; i++) out.push(frameChange(frames[i - 1]!, frames[i]!));
  return out;
}

export interface MotionOptions {
  /** A step moves when its change is above this (0–255). Default 0.6. */
  moving?: number;
  /** A run of still steps longer than this (seconds) is a hold. Default 0.8. */
  holdSeconds?: number;
  /** A step this big (0–255) with both neighbours under a third of it is a jump. Default 18. */
  jump?: number;
  /** Seconds at the very end allowed to hold (an end card). Default 0. */
  endHoldSeconds?: number;
  /** Added to every time reported (the series' start within a longer film). Default 0. */
  offsetSeconds?: number;
}

export interface MotionReport {
  /** Length covered by the series, in seconds. */
  seconds: number;
  /** Share of steps with visible change (0–1). */
  density: number;
  /** Median change per step (0–255). */
  medianChange: number;
  /** Runs without visible change longer than `holdSeconds`. */
  holds: { from: number; to: number }[];
  /** Times of isolated big changes. */
  jumps: number[];
}

/**
 * Measure a change series (from `changeSeries`, at `fps` frames per second).
 * Step i is the change from frame i to frame i + 1, timed at frame i.
 */
export function motionMetrics(changes: readonly number[], fps: number = MOTION_SAMPLE.fps, options: MotionOptions = {}): MotionReport {
  const moving = options.moving ?? 0.6;
  const holdSeconds = options.holdSeconds ?? 0.8;
  const jump = options.jump ?? 18;
  const endHold = options.endHoldSeconds ?? 0;
  const offset = options.offsetSeconds ?? 0;
  const n = changes.length;
  const seconds = (n + 1) / fps;
  const round = (t: number) => Math.round((t + offset) * 100) / 100;

  const holds: { from: number; to: number }[] = [];
  let run = 0;
  const close = (end: number) => {
    const from = (end - run) / fps;
    const to = end / fps;
    // A hold reaching the end is allowed up to endHoldSeconds; only the excess counts.
    const allowed = end === n ? endHold : 0;
    if (to - from - allowed > holdSeconds) holds.push({ from: round(from), to: round(Math.max(from, to - allowed)) });
    run = 0;
  };
  for (let i = 0; i < n; i++) {
    if (changes[i]! > moving) {
      if (run) close(i);
    } else run++;
  }
  if (run) close(n);

  const jumps: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    const c = changes[i]!;
    if (c > jump && changes[i - 1]! < c / 3 && changes[i + 1]! < c / 3) jumps.push(round(i / fps));
  }

  const sorted = [...changes].sort((a, b) => a - b);
  const medianChange = n ? (n % 2 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2) : 0;
  const density = n ? changes.filter((c) => c > moving).length / n : 0;
  return { seconds: Math.round(seconds * 100) / 100, density: Math.round(density * 1000) / 1000, medianChange: Math.round(medianChange * 100) / 100, holds, jumps };
}

export interface MotionTargets {
  density: number;
  medianChange: number;
  /** Longest allowed hold, seconds. */
  holdSeconds: number;
}

/**
 * Targets by pace: motion graphics, documentary-paced films (stills with slow moves), and a continuous shot
 * (always moving; the only stillness allowed is declared with `tl.rest`, which `motionFindings` exempts).
 */
export const MOTION_TARGETS: Record<"motion" | "documentary" | "shot", MotionTargets> = {
  motion: { density: 0.85, medianChange: 1.5, holdSeconds: 0.8 },
  documentary: { density: 0.6, medianChange: 0.6, holdSeconds: 2 },
  shot: { density: 0.92, medianChange: 1.2, holdSeconds: 0.5 },
};

export interface MotionFindingsOptions {
  /** Declared dead-still stretches (`tl.rest`), in the same seconds as the report. Holds inside them are not findings. */
  rests?: readonly { from: number; to: number }[];
}

export interface MotionFinding {
  kind: "density" | "change" | "hold" | "jump";
  /** When it happens, for holds and jumps (seconds). */
  from?: number;
  to?: number;
  message: string;
}

/** What falls short of the targets, as findings with times. */
export function motionFindings(report: MotionReport, targets: MotionTargets, options: MotionFindingsOptions = {}): MotionFinding[] {
  const out: MotionFinding[] = [];
  const rests = options.rests ?? [];
  for (const h of report.holds) {
    // The part of the hold a declared rest does not cover is what counts.
    let spans = [{ from: h.from, to: h.to }];
    for (const r of rests) {
      spans = spans.flatMap((x) => {
        if (r.to <= x.from || r.from >= x.to) return [x];
        const left = r.from > x.from ? [{ from: x.from, to: r.from }] : [];
        const right = r.to < x.to ? [{ from: r.to, to: x.to }] : [];
        return [...left, ...right];
      });
    }
    for (const x of spans) {
      if (x.to - x.from > targets.holdSeconds) out.push({ kind: "hold", from: x.from, to: x.to, message: `nothing moves ${x.from.toFixed(1)}–${x.to.toFixed(1)} s` });
    }
  }
  if (report.density < targets.density) out.push({ kind: "density", message: `${Math.round(report.density * 100)}% of the time something visibly moves (target ${Math.round(targets.density * 100)}%)` });
  if (report.medianChange < targets.medianChange) out.push({ kind: "change", message: `motion is faint: median change ${report.medianChange.toFixed(2)} per frame (target ${targets.medianChange})` });
  for (const t of report.jumps) out.push({ kind: "jump", from: t, message: `a hard jump at ${t.toFixed(1)} s with calm on both sides` });
  return out;
}
