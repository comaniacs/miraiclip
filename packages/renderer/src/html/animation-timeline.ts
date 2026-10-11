/**
 * When does an animated html clip's picture actually change?
 *
 * Animated html clips are re-rasterized for every preview frame, and a raster
 * is a whole SVG document build (parse, style, layout, font decode, paint) on
 * the main thread — ~10–15 ms on a desktop, several times that on a phone.
 * Most motion-graphics templates animate in bursts: elements fly in, then
 * hold; counters tick in `steps()`. Between those changes every frame is
 * identical, so re-rasterizing it is wasted main-thread time (and garbage).
 *
 * This module asks the browser's own CSS engine for the template's animations
 * (`getAnimations()` on a hidden copy of the markup — the same parser and
 * cascade that will rasterize it) and turns their timing and keyframes into a
 * timeline answering one question: "from which time on has the picture been
 * constant?" Two times inside the same constant span render identically, so
 * the preview keeps the raster it already has.
 *
 * It is deliberately conservative: anything it cannot reason about (markup
 * reading `--t` directly, SMIL, a non-linear effect-level easing, keyframes
 * that don't all name the same properties) is treated as changing all the
 * time — i.e. today's behaviour, never a wrong frame.
 */

/** One CSS animation, reduced to what decides when its output changes. */
export interface AnimationDescriptor {
  /** Animation start on the clip's animation clock (seconds) — CSS delay. */
  delayS: number;
  /** One iteration (seconds). */
  durationS: number;
  /** Iteration count; Infinity for `infinite`. */
  iterations: number;
  /** CSS `animation-direction`. */
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  /**
   * Keyframes in offset order: `values` holds every animated property's value
   * (as strings), `easing` the timing function of the segment that STARTS at
   * this keyframe.
   */
  keyframes: { offset: number; easing: string; values: Record<string, string> }[];
}

/** A stretch of one iteration's progress [0..1] and how it changes. */
interface Segment {
  from: number;
  to: number;
  /** "hold": constant; "steps": jumps only at `jumps`; "continuous": changes throughout. */
  kind: "hold" | "steps" | "continuous";
  /** Progress values where a `steps()` segment jumps (ascending). */
  jumps: number[];
}

interface AnimationModel {
  delayS: number;
  durationS: number;
  iterations: number;
  direction: AnimationDescriptor["direction"];
  /** Segments of a forward-playing iteration. */
  forward: Segment[];
  /** Segments of a reverse-playing iteration (progress mirrored). */
  backward: Segment[];
}

/** The answer for one time. */
export interface ConstantSpan {
  /**
   * The picture has been constant since this time (seconds, ≤ the time
   * asked). Two times with the same `sinceS` render identically.
   */
  sinceS: number;
}

export interface HtmlAnimationTimeline {
  /**
   * The constant span containing `timeS`, or `undefined` when the picture is
   * changing continuously at `timeS` (every frame differs).
   */
  constantSpanAt(timeS: number): ConstantSpan | undefined;
}

/** A timeline for markup whose picture never changes (no animations). */
const STATIC_TIMELINE: HtmlAnimationTimeline = { constantSpanAt: () => ({ sinceS: Number.NEGATIVE_INFINITY }) };

const STEPS = /^steps\(\s*(\d+)\s*(?:,\s*([\w-]+)\s*)?\)$/;

function segmentKind(easing: string): { kind: "steps" | "continuous"; steps: number } {
  const match = STEPS.exec(easing.trim());
  if (match) return { kind: "steps", steps: Math.max(1, Number(match[1])) };
  if (easing === "step-start" || easing === "step-end") return { kind: "steps", steps: 1 };
  return { kind: "continuous", steps: 0 };
}

function buildSegments(keyframes: AnimationDescriptor["keyframes"]): Segment[] | undefined {
  if (keyframes.length < 2) return [];
  // Every keyframe must name the same properties: an implicit (underlying)
  // value is not something we can compare, so bail out conservatively.
  const names = Object.keys(keyframes[0]!.values).sort().join("|");
  for (const k of keyframes) if (Object.keys(k.values).sort().join("|") !== names) return undefined;
  const segments: Segment[] = [];
  for (let i = 0; i + 1 < keyframes.length; i++) {
    const a = keyframes[i]!;
    const b = keyframes[i + 1]!;
    if (b.offset <= a.offset) continue; // zero-length: an instant jump, covered by the next segment's start
    const same = Object.keys(a.values).every((p) => a.values[p] === b.values[p]);
    if (same) {
      segments.push({ from: a.offset, to: b.offset, kind: "hold", jumps: [] });
      continue;
    }
    const { kind, steps } = segmentKind(a.easing);
    if (kind === "continuous") {
      segments.push({ from: a.offset, to: b.offset, kind, jumps: [] });
      continue;
    }
    // Every steps() variant jumps only at multiples of 1/steps of the
    // segment (jump-start/both/none/end differ in WHICH of those they use) —
    // treating all of them as jump points is exact enough and never wrong.
    const jumps: number[] = [];
    for (let k = 0; k <= steps; k++) jumps.push(a.offset + ((b.offset - a.offset) * k) / steps);
    segments.push({ from: a.offset, to: b.offset, kind, jumps });
  }
  return segments;
}

function mirror(segments: Segment[]): Segment[] {
  return segments
    .map((s) => ({ from: 1 - s.to, to: 1 - s.from, kind: s.kind, jumps: s.jumps.map((j) => 1 - j).reverse() }))
    .reverse();
}

/**
 * Within one iteration, the start of the constant stretch containing progress
 * `p` (0..1), or undefined when changing continuously at `p`.
 */
function constantSinceInIteration(segments: Segment[], p: number): number | undefined {
  let since = 0; // the iteration start is always a potential change (100% → 0% wrap)
  for (const s of segments) {
    if (p < s.from) break;
    const inside = p < s.to || s === segments[segments.length - 1];
    if (!inside) {
      // Passed this segment: a hold keeps `since`; anything else changed up to its end.
      if (s.kind !== "hold") since = s.to;
      continue;
    }
    if (s.kind === "hold") return since;
    if (s.kind === "continuous") return p === s.from ? s.from : undefined;
    let last = s.from;
    for (const j of s.jumps) {
      if (j <= p) last = j;
      else break;
    }
    return last;
  }
  // Past the last segment (keyframes ending before 100%): constant since the last change.
  return since;
}

function iterationReversed(direction: AnimationDescriptor["direction"], iteration: number): boolean {
  switch (direction) {
    case "reverse":
      return true;
    case "alternate":
      return iteration % 2 === 1;
    case "alternate-reverse":
      return iteration % 2 === 0;
    default:
      return false;
  }
}

/** Constant-since time for one animation at clip time `t`, or undefined if changing. */
function animationConstantSince(model: AnimationModel, t: number): number | undefined {
  const local = t - model.delayS;
  if (local < 0) return Number.NEGATIVE_INFINITY; // before it starts: fill shows a fixed keyframe (or nothing)
  const total = model.iterations * model.durationS;
  if (Number.isFinite(total) && local >= total) return model.delayS + total; // finished: frozen since its end
  const iteration = Math.floor(local / model.durationS);
  const iterationStart = model.delayS + iteration * model.durationS;
  const progress = (local - iteration * model.durationS) / model.durationS;
  const reversed = iterationReversed(model.direction, iteration);
  const segments = reversed ? model.backward : model.forward;
  const since = constantSinceInIteration(segments, progress);
  return since === undefined ? undefined : iterationStart + since * model.durationS;
}

/** Build the timeline from animation descriptors (pure — see `analyzeHtmlAnimations` for the DOM side). */
export function buildAnimationTimeline(descriptors: readonly AnimationDescriptor[]): HtmlAnimationTimeline | undefined {
  const models: AnimationModel[] = [];
  for (const d of descriptors) {
    if (!(d.durationS > 0) || !(d.iterations > 0)) continue; // never runs: no change
    const forward = buildSegments([...d.keyframes].sort((a, b) => a.offset - b.offset));
    if (!forward) return undefined;
    if (forward.every((s) => s.kind === "hold")) continue; // animates nothing visible
    models.push({ delayS: d.delayS, durationS: d.durationS, iterations: d.iterations, direction: d.direction, forward, backward: mirror(forward) });
  }
  if (models.length === 0) return STATIC_TIMELINE;
  return {
    constantSpanAt(timeS: number): ConstantSpan | undefined {
      let since = Number.NEGATIVE_INFINITY;
      for (const model of models) {
        const s = animationConstantSince(model, timeS);
        if (s === undefined) return undefined;
        if (s > since) since = s;
      }
      return { sinceS: since };
    },
  };
}

/** Markup that depends on time in ways `getAnimations` cannot describe. */
const OPAQUE_TIME = /var\(\s*--t\b|<\s*(?:animate|animateTransform|animateMotion|set)\b/i;

const ANALYSIS_CSS =
  // The rasterizer replaces every animation-delay with `var(--d)` (then seeks
  // by `--t`): mirror that, paused, so the computed delays are the real ones.
  ".mc-anim-probe *,.mc-anim-probe *::before,.mc-anim-probe *::after{" +
  "animation-play-state:paused!important;animation-delay:var(--d,0s)!important}";

/** Read the markup's CSS animations through the browser (requires a DOM). */
function describeAnimations(markup: string, widthPx: number, heightPx: number): AnimationDescriptor[] | undefined {
  if (typeof document === "undefined" || typeof document.body?.getAnimations !== "function") return undefined;
  const host = document.createElement("div");
  host.className = "mc-anim-probe";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    `position:fixed;left:-100000px;top:0;width:${widthPx}px;height:${heightPx}px;` +
    "overflow:hidden;visibility:hidden;contain:strict;pointer-events:none";
  const style = document.createElement("style");
  style.textContent = ANALYSIS_CSS;
  host.innerHTML = markup;
  host.prepend(style);
  document.body.appendChild(host);
  try {
    const out: AnimationDescriptor[] = [];
    for (const animation of host.getAnimations({ subtree: true })) {
      const effect = animation.effect as KeyframeEffect | null;
      if (!effect || typeof effect.getKeyframes !== "function") continue;
      const timing = effect.getComputedTiming();
      // A non-linear easing on the effect itself reshapes every segment — not modelled.
      if (timing.easing && timing.easing !== "linear") return undefined;
      const duration = typeof timing.duration === "number" ? timing.duration : 0;
      const keyframes = effect.getKeyframes().map((k) => {
        const values: Record<string, string> = {};
        for (const [prop, value] of Object.entries(k)) {
          if (prop === "offset" || prop === "computedOffset" || prop === "easing" || prop === "composite") continue;
          values[prop] = String(value);
        }
        return { offset: Number(k.computedOffset ?? k.offset ?? 0), easing: String(k.easing ?? "linear"), values };
      });
      out.push({
        delayS: (timing.delay ?? 0) / 1000,
        durationS: duration / 1000,
        iterations: timing.iterations ?? 1,
        direction: (timing.direction ?? "normal") as AnimationDescriptor["direction"],
        keyframes,
      });
    }
    return out;
  } finally {
    host.remove();
  }
}

const cache = new Map<string, HtmlAnimationTimeline | null>();
const MAX_CACHED = 64;

/**
 * The animation timeline of (already parameter-substituted) markup laid out
 * at `widthPx`×`heightPx`, or `undefined` when it can't be analysed (no DOM,
 * time read through `--t`, SMIL…) — callers then treat every frame as new.
 * Cached per markup; analysis costs a few ms once per template.
 */
export function analyzeHtmlAnimations(markup: string, widthPx: number, heightPx: number): HtmlAnimationTimeline | undefined {
  const key = `${widthPx}x${heightPx}|${markup}`;
  if (cache.has(key)) {
    const hit = cache.get(key)!;
    cache.delete(key);
    cache.set(key, hit); // LRU
    return hit ?? undefined;
  }
  let timeline: HtmlAnimationTimeline | undefined;
  if (!OPAQUE_TIME.test(markup)) {
    try {
      const descriptors = describeAnimations(markup, widthPx, heightPx);
      timeline = descriptors ? buildAnimationTimeline(descriptors) : undefined;
    } catch {
      timeline = undefined;
    }
  }
  cache.set(key, timeline ?? null);
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return timeline;
}
