/**
 * Shutter motion blur — the pure planning half.
 *
 * A film camera's shutter is open for a fraction of each frame
 * (`shutterAngle / 360`); everything that moves during that time smears. We
 * reproduce it by rendering the composition at several instants inside the
 * open shutter and averaging them (the averaging lives in
 * `frame-accumulator.ts`). This file decides WHEN to sample and HOW MANY
 * times; it has no DOM and no GPU, so every rule is unit-testable.
 */
import { frameToUs, toFrameRate, type FrameRate } from "@miraiclip/core";
import type { Us } from "../media/types.js";

export interface MotionBlurOptions {
  /** Degrees of the 360° frame the shutter stays open (default 180, the film standard). 0 turns blur off. */
  shutterAngle?: number;
  /** Fewest sub-samples for a frame that moves at all (default 4). */
  minSamples?: number;
  /** Most sub-samples for one frame (default 32). */
  maxSamples?: number;
  /**
   * The largest gap, in output pixels, allowed between a moving edge in one
   * sub-sample and the next (default 6). Smaller is smoother and slower.
   */
  gapPx?: number;
}

export interface ResolvedMotionBlur {
  shutterAngle: number;
  minSamples: number;
  maxSamples: number;
  gapPx: number;
}

export const MOTION_BLUR_DEFAULTS: ResolvedMotionBlur = { shutterAngle: 180, minSamples: 4, maxSamples: 32, gapPx: 6 };

/** Validate and fill defaults. Throws a readable error for nonsense so a bad option never silently exports unblurred. */
export function resolveMotionBlur(options: MotionBlurOptions | undefined): ResolvedMotionBlur | null {
  if (!options) return null;
  const r = { ...MOTION_BLUR_DEFAULTS };
  const num = (name: string, v: unknown, min: number, max: number, integer = false): number => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
      throw new Error(`motionBlur.${name} must be ${integer ? "an integer" : "a number"} from ${min} to ${max}`);
    }
    return v;
  };
  if (options.shutterAngle !== undefined) r.shutterAngle = num("shutterAngle", options.shutterAngle, 0, 360);
  if (options.minSamples !== undefined) r.minSamples = num("minSamples", options.minSamples, 2, 64, true);
  if (options.maxSamples !== undefined) r.maxSamples = num("maxSamples", options.maxSamples, 2, 64, true);
  if (options.gapPx !== undefined) r.gapPx = num("gapPx", options.gapPx, 0.5, 64);
  if (r.maxSamples < r.minSamples) throw new Error("motionBlur.maxSamples must be at least minSamples");
  return r.shutterAngle === 0 ? null : r;
}

/** How long the shutter is open for a frame of `frameDurationUs`, in whole µs. */
export function shutterUs(frameDurationUs: Us, shutterAngle: number): Us {
  return Math.round((frameDurationUs * shutterAngle) / 360);
}

/**
 * The instants to render for one output frame: `count` times spread evenly
 * across the open shutter, centred on `centerUs` (the frame's temporal
 * midpoint, where an unblurred export samples). Whole microseconds, and the
 * offsets from the centre mirror exactly (offset i = −offset N−1−i), so a
 * 29.97 or 23.976 project blurs symmetrically instead of leaning toward one
 * side by a microsecond of rounding.
 */
export function shutterSampleTimes(centerUs: Us, openUs: Us, count: number): Us[] {
  if (count <= 1 || openUs <= 0) return [centerUs];
  const times: Us[] = [];
  for (let i = 0; i < count; i++) {
    const exact = ((2 * i + 1 - count) * openUs) / (2 * count);
    const offset = Math.sign(exact) * Math.round(Math.abs(exact));
    times.push(centerUs + offset);
  }
  return times;
}

/**
 * How many sub-samples a frame needs, from the farthest any point on screen
 * travels during the open shutter. Under half a pixel the frame is a hold and
 * renders once; otherwise one sample per `gapPx` of travel, within bounds.
 */
export function sampleCountFor(motionPx: number, options: ResolvedMotionBlur): number {
  if (!(motionPx >= 0.5)) return 1;
  const wanted = Math.ceil(motionPx / options.gapPx) + 1;
  return Math.min(options.maxSamples, Math.max(options.minSamples, wanted));
}

/**
 * Keep only the sub-sample times on the same side of every hard cut as the
 * frame's centre, so a cut is never smeared into a dissolve. `cutsUs` are the
 * instants where the picture changes abruptly (a clip boundary without a
 * transition, a `tl.cut`): a time at or after a cut belongs to the "after"
 * side. The centre time always survives, so the result is never empty.
 */
export function clipTimesToCuts(times: readonly Us[], centerUs: Us, cutsUs: readonly Us[]): Us[] {
  const sideOf = (t: Us): number => cutsUs.reduce((n, c) => (t >= c ? n + 1 : n), 0);
  const centerSide = sideOf(centerUs);
  const kept = times.filter((t) => sideOf(t) === centerSide);
  return kept.length > 0 ? kept : [centerUs];
}

/** Frame-rate convenience for callers that have a ratio rather than a frame window. */
export function frameDurationUs(rate: number | FrameRate): Us {
  return frameToUs(1, toFrameRate(rate));
}
