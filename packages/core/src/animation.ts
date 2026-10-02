/**
 * Keyframe evaluation — pure math, shared by every consumer (preview
 * compositor, audio engine, export, thumbnails), which is what guarantees an
 * animated composition looks and sounds the same everywhere.
 */
import type {
  AnimatableProperty,
  Clip,
  Easing,
  EasingPreset,
  Keyframe,
  Us,
} from "./types.js";

/** Named presets, stored expanded — CSS cubic-bezier() control points. */
export const EASING_PRESETS: Record<EasingPreset, Easing> = {
  linear: { kind: "bezier", x1: 0, y1: 0, x2: 1, y2: 1 },
  hold: { kind: "hold" },
  easeIn: { kind: "bezier", x1: 0.42, y1: 0, x2: 1, y2: 1 },
  easeOut: { kind: "bezier", x1: 0, y1: 0, x2: 0.58, y2: 1 },
  easeInOut: { kind: "bezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
};

/** Accepts a preset name or an explicit easing; returns the stored form. */
export function resolveEasing(input: EasingPreset | Easing | undefined): Easing {
  if (input === undefined) return EASING_PRESETS.linear;
  if (typeof input === "string") return EASING_PRESETS[input];
  return input;
}

/**
 * CSS-convention cubic bézier: control points map input progress x∈[0,1] to
 * eased progress y. Solve x(t)=progress for t (Newton with bisection
 * fallback), then evaluate y(t).
 */
export function cubicBezierProgress(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number,
): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  // Fast path: the identity curve.
  if (x1 === y1 && x2 === y2) return progress;

  const sampleX = (t: number): number =>
    3 * t * (1 - t) * (1 - t) * x1 + 3 * t * t * (1 - t) * x2 + t * t * t;
  const sampleY = (t: number): number =>
    3 * t * (1 - t) * (1 - t) * y1 + 3 * t * t * (1 - t) * y2 + t * t * t;
  const sampleDx = (t: number): number =>
    3 * (1 - t) * (1 - t) * x1 + 6 * t * (1 - t) * (x2 - x1) + 3 * t * t * (1 - x2);

  // Newton–Raphson.
  let t = progress;
  for (let i = 0; i < 8; i++) {
    const x = sampleX(t) - progress;
    if (Math.abs(x) < 1e-6) return sampleY(t);
    const dx = sampleDx(t);
    if (Math.abs(dx) < 1e-6) break;
    t -= x / dx;
  }
  // Bisection fallback (Newton can escape [0,1] on extreme curves).
  let lo = 0;
  let hi = 1;
  t = progress;
  for (let i = 0; i < 32 && hi - lo > 1e-7; i++) {
    const x = sampleX(t);
    if (Math.abs(x - progress) < 1e-6) break;
    if (x < progress) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return sampleY(t);
}

/** A keyframe's time from the clip's visible start, given the clip's duration. */
export function keyframeTimeUs(keyframe: Keyframe, clipDurationUs: Us): Us {
  return keyframe.anchor === "end" ? clipDurationUs - keyframe.timeUs : keyframe.timeUs;
}

const hasEndAnchor = (keyframes: readonly Keyframe[]): boolean => {
  for (let i = 0; i < keyframes.length; i++) if (keyframes[i]!.anchor === "end") return true;
  return false;
};

// Documents are immutable snapshots, so a resolved list stays valid for as
// long as its source array lives — per-tick evaluation stays alloc-free.
const resolvedCache = new WeakMap<readonly Keyframe[], { durationUs: Us; keyframes: readonly Keyframe[] }>();

/**
 * Keyframes with every time measured from the clip's visible start, sorted.
 * End-anchored keyframes are placed using `clipDurationUs`; when a clip is
 * shorter than its In + Out animations the two interleave by time (ties keep
 * the start-anchored one first). Returns the input array itself when nothing
 * is end-anchored.
 */
export function resolveKeyframes(keyframes: readonly Keyframe[], clipDurationUs: Us): readonly Keyframe[] {
  if (!hasEndAnchor(keyframes)) return keyframes;
  const cached = resolvedCache.get(keyframes);
  if (cached && cached.durationUs === clipDurationUs) return cached.keyframes;
  const resolved = keyframes
    .map((k, i) => ({ k: { timeUs: keyframeTimeUs(k, clipDurationUs), value: k.value, easing: k.easing }, end: k.anchor === "end", i }))
    .sort((a, b) => a.k.timeUs - b.k.timeUs || Number(a.end) - Number(b.end) || a.i - b.i)
    .map((e) => e.k);
  resolvedCache.set(keyframes, { durationUs: clipDurationUs, keyframes: resolved });
  return resolved;
}

/**
 * Evaluate one property's keyframe list at a clip-relative time. Keyframes
 * must be in stored order (the keyframe/set command maintains it). Pass
 * `clipDurationUs` when the list may hold end-anchored keyframes. Before
 * the first keyframe the first value holds; after the last, the last value
 * holds; between, the LEFT keyframe's easing shapes the segment.
 */
export function evaluateKeyframes(
  keyframes: readonly Keyframe[],
  timeUs: Us,
  fallback: number,
  clipDurationUs?: Us,
): number {
  if (clipDurationUs !== undefined) keyframes = resolveKeyframes(keyframes, clipDurationUs);
  const n = keyframes.length;
  if (n === 0) return fallback;
  const first = keyframes[0]!;
  if (timeUs <= first.timeUs) return first.value;
  const last = keyframes[n - 1]!;
  if (timeUs >= last.timeUs) return last.value;

  // Binary search: greatest index with timeUs <= t.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keyframes[mid]!.timeUs <= timeUs) lo = mid;
    else hi = mid;
  }
  const a = keyframes[lo]!;
  const b = keyframes[lo + 1]!;
  if (a.easing.kind === "hold") return a.value;
  const span = b.timeUs - a.timeUs;
  const progress = span <= 0 ? 1 : (timeUs - a.timeUs) / span;
  const eased = cubicBezierProgress(
    a.easing.x1,
    a.easing.y1,
    a.easing.x2,
    a.easing.y2,
    progress,
  );
  return a.value + (b.value - a.value) * eased;
}

/** Flat evaluated state — reusable output object keeps evaluation alloc-free. */
export interface EvaluatedClip {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  volume: number;
}

const PROPS: readonly AnimatableProperty[] = [
  "x",
  "y",
  "scale",
  "rotation",
  "opacity",
  "volume",
];

/**
 * Evaluate a clip's animated properties at a clip-relative time into `out`
 * (alloc-free — call per tick with a reused object). Static clip values are
 * the fallback for properties without keyframes.
 */
export function evaluateClipInto(clip: Clip, clipTimeUs: Us, out: EvaluatedClip): EvaluatedClip {
  const t = clip.transform;
  out.x = t.x;
  out.y = t.y;
  out.scale = t.scale;
  out.rotation = t.rotation;
  out.opacity = t.opacity;
  out.volume = "volume" in clip && typeof clip.volume === "number" ? clip.volume : 1;
  const animations = clip.animations;
  if (!animations) return out;
  for (const prop of PROPS) {
    const keyframes = animations[prop];
    if (keyframes && keyframes.length > 0) {
      out[prop] = evaluateKeyframes(keyframes, clipTimeUs, out[prop], clip.durationUs);
    }
  }
  return out;
}

/** Convenience allocating variant of {@link evaluateClipInto}. */
export function evaluateClipAt(clip: Clip, clipTimeUs: Us): EvaluatedClip {
  return evaluateClipInto(clip, clipTimeUs, {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    volume: 1,
  });
}
