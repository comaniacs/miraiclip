import { resolveEasing } from "./animation.js";
import type { BuiltinCommand } from "./commands/schemas.js";
import type { AnimatableProperty, Clip, Easing, Keyframe, Transform, Us } from "./types.js";

/**
 * Animation presets, built on ordinary keyframes so they play in preview and
 * every export with no special support.
 *
 * A clip's animation is a RECIPE of up to three slots: In (from the start),
 * Loop (between In and Out) and Out (into the end, end-anchored so it follows
 * trims). Applying a recipe regenerates the clip's visual keyframes. The
 * recipe isn't stored anywhere: `readAnimation` recognizes it from the
 * keyframes (presets are deterministic), so it survives save / reload and
 * undo. Hand-made keyframes that match no preset read as "custom".
 *
 * Editor panels and AI tools share this module, so "pop in" means the same
 * keyframes wherever it's applied.
 */

export type AnimationSlot = "in" | "out" | "loop";
type Prop = Exclude<AnimatableProperty, "volume">;
type Base = Pick<Transform, "x" | "y" | "scale" | "rotation" | "opacity">;

/** A keyframe in slot-local time (0 = the slot's start). */
interface Point {
  t: Us;
  value: number;
  easing: Easing;
}
type Track = Partial<Record<Prop, Point[]>>;

export type AnimationEasing = "smooth" | "linear" | "snappy";
export const ANIMATION_EASINGS: { id: AnimationEasing; label: string }[] = [
  { id: "smooth", label: "Smooth" },
  { id: "linear", label: "Linear" },
  { id: "snappy", label: "Snappy" },
];

const SNAPPY_IN: Easing = { kind: "bezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 };
const SNAPPY_OUT: Easing = { kind: "bezier", x1: 0.7, y1: 0, x2: 0.84, y2: 0 };
const LINEAR = resolveEasing("linear");
const SINE = resolveEasing("easeInOut");

/** Entrances decelerate, exits accelerate. */
function curve(choice: AnimationEasing, slot: "in" | "out"): Easing {
  if (choice === "linear") return LINEAR;
  if (choice === "snappy") return slot === "in" ? SNAPPY_IN : SNAPPY_OUT;
  return resolveEasing(slot === "in" ? "easeOut" : "easeIn");
}

export interface AnimationPreset {
  id: string;
  label: string;
  slot: AnimationSlot;
  /** Build the slot's keyframes. In: ends at base. Out: starts at base. Loop: spans `lengthUs`. */
  build(base: Base, lengthUs: Us, easing: AnimationEasing): Track;
  /** Loops only: fixed timing, no duration / easing choice. */
  fixed?: boolean;
}

const OFFSET = 0.12; // slide distance, in composition fractions

/** An entrance from `from` values to the base, plus an Out version that mirrors it. */
function entrance(id: string, label: string, from: (b: Base) => Partial<Base>, extra?: (b: Base, d: Us, e: Easing) => Track): AnimationPreset[] {
  const make = (slot: "in" | "out"): AnimationPreset => ({
    id: `${slot}:${id}`,
    label,
    slot,
    build(base, d, choice) {
      const e = curve(choice, slot);
      const start = from(base);
      const track: Track = {};
      for (const prop of Object.keys(start) as Prop[]) {
        const away = start[prop]!;
        track[prop] =
          slot === "in"
            ? [
                { t: 0, value: away, easing: e },
                { t: d, value: base[prop], easing: LINEAR },
              ]
            : [
                { t: 0, value: base[prop], easing: e },
                { t: d, value: away, easing: LINEAR },
              ];
      }
      return { ...track, ...(extra ? extra(base, d, e) : {}) };
    },
  });
  return [make("in"), make("out")];
}

const fade = (b: Base) => ({ opacity: 0 * b.opacity });

export const ANIMATION_PRESETS: readonly AnimationPreset[] = [
  ...entrance("fade", "Fade", fade),
  ...entrance("up", "Slide up", (b) => ({ y: b.y + OFFSET, ...fade(b) })),
  ...entrance("down", "Slide down", (b) => ({ y: b.y - OFFSET, ...fade(b) })),
  ...entrance("left", "Slide left", (b) => ({ x: b.x + OFFSET, ...fade(b) })),
  ...entrance("right", "Slide right", (b) => ({ x: b.x - OFFSET, ...fade(b) })),
  ...entrance("zoom", "Zoom", (b) => ({ scale: b.scale * 0.6, ...fade(b) })),
  ...entrance("spin", "Spin", (b) => ({ rotation: b.rotation - 90, scale: b.scale * 0.5, ...fade(b) })),
  // Pop overshoots: 0 → 110% → 100% (and the mirror on the way out).
  ...(["in", "out"] as const).map<AnimationPreset>((slot) => ({
    id: `${slot}:pop`,
    label: "Pop",
    slot,
    build(b, d, choice) {
      const e = curve(choice, slot);
      const peak = Math.round(d * 0.65);
      const scale: Point[] =
        slot === "in"
          ? [
              { t: 0, value: 0, easing: e },
              { t: peak, value: b.scale * 1.1, easing: SINE },
              { t: d, value: b.scale, easing: LINEAR },
            ]
          : [
              { t: 0, value: b.scale, easing: SINE },
              { t: d - peak, value: b.scale * 1.1, easing: e },
              { t: d, value: 0, easing: LINEAR },
            ];
      const opacity: Point[] =
        slot === "in"
          ? [
              { t: 0, value: 0, easing: LINEAR },
              { t: Math.round(d * 0.3), value: b.opacity, easing: LINEAR },
            ]
          : [
              { t: Math.round(d * 0.7), value: b.opacity, easing: LINEAR },
              { t: d, value: 0, easing: LINEAR },
            ];
      return { scale, opacity };
    },
  })),

  loop("pulse", "Pulse", "scale", 1_200_000, (b, i) => (i % 2 ? b.scale * 1.06 : b.scale)),
  loop("float", "Float", "y", 2_000_000, (b, i) => (i % 2 ? b.y - 0.02 : b.y)),
  loop("sway", "Sway", "rotation", 2_400_000, (b, i) => b.rotation + [0, 3, 0, -3][i % 4]!),
  {
    id: "loop:kenburns",
    label: "Ken Burns",
    slot: "loop",
    fixed: true,
    build: (b, len) => ({
      scale: [
        { t: 0, value: b.scale, easing: LINEAR },
        { t: len, value: b.scale * 1.15, easing: LINEAR },
      ],
      x: [
        { t: 0, value: b.x, easing: LINEAR },
        { t: len, value: b.x + 0.03, easing: LINEAR },
      ],
    }),
  },
];

/** A repeating motion: a keyframe every half-period (or quarter, for 4-step), back at base on whole periods. */
function loop(id: string, label: string, prop: Prop, periodUs: Us, valueAt: (b: Base, step: number) => number): AnimationPreset {
  const steps = prop === "rotation" ? 4 : 2;
  return {
    id: `loop:${id}`,
    label,
    slot: "loop",
    fixed: true,
    build(b, len) {
      const stepUs = periodUs / steps;
      const n = Math.max(1, Math.min(400, Math.floor(len / stepUs)));
      const points: Point[] = [];
      for (let i = 0; i <= n; i++) points.push({ t: Math.round(i * stepUs), value: valueAt(b, i), easing: SINE });
      // Settle back at base by the end of the window.
      const last = points[points.length - 1]!;
      if (last.t < len) points.push({ t: len, value: valueAt(b, 0), easing: SINE });
      else last.value = valueAt(b, 0);
      return { [prop]: points };
    },
  };
}

/** A preset by id ("in:pop", "loop:pulse", …). */
export const animationPreset = (id: string): AnimationPreset | undefined => ANIMATION_PRESETS.find((p) => p.id === id);

/* ---------- recipes ---------- */

export interface AnimationSlotChoice {
  preset: string;
  durationUs: Us;
  easing: AnimationEasing;
}
export interface AnimationRecipe {
  in?: AnimationSlotChoice;
  loop?: AnimationSlotChoice;
  out?: AnimationSlotChoice;
}

export const ANIMATION_DEFAULT_SLOT_US = 600_000;
export const ANIMATION_MIN_SLOT_US = 200_000;
export const ANIMATION_MAX_SLOT_US = 3_000_000;

/** In/Out lengths that fit the clip (they share it, leaving a sliver between). */
export function fitAnimation(recipe: AnimationRecipe, clipUs: Us): AnimationRecipe {
  const out: AnimationRecipe = { ...recipe };
  const room = Math.max(0, clipUs - 100_000);
  const a = recipe.in?.durationUs ?? 0;
  const b = recipe.out?.durationUs ?? 0;
  if (a + b > room && a + b > 0) {
    const k = room / (a + b);
    if (out.in) out.in = { ...out.in, durationUs: Math.max(1, Math.round(a * k)) };
    if (out.out) out.out = { ...out.out, durationUs: Math.max(1, Math.round(b * k)) };
  }
  return out;
}

export interface PlannedKeyframe {
  property: Prop;
  timeUs: Us;
  value: number;
  easing: Easing;
  anchor?: "end";
}

/** Every keyframe a recipe produces on a clip, plus the properties it owns. */
export function planAnimation(recipe: AnimationRecipe, base: Base, clipUs: Us): { keyframes: PlannedKeyframe[]; props: Set<Prop> } {
  const r = fitAnimation(recipe, clipUs);
  const keyframes: PlannedKeyframe[] = [];
  const props = new Set<Prop>();
  const inUs = r.in?.durationUs ?? 0;
  const outUs = r.out?.durationUs ?? 0;
  const taken = new Set<string>(); // "prop@time" slots already used (start-relative)

  const emit = (track: Track, place: (t: Us) => { timeUs: Us; anchor?: "end" }, skip?: (prop: Prop, t: Us) => boolean) => {
    for (const prop of Object.keys(track) as Prop[]) {
      props.add(prop);
      for (const p of track[prop]!) {
        if (skip?.(prop, p.t)) continue;
        const at = place(p.t);
        if (!at.anchor) taken.add(`${prop}@${at.timeUs}`);
        keyframes.push({ property: prop, value: p.value, easing: p.easing, ...at });
      }
    }
  };

  if (r.in) {
    const preset = animationPreset(r.in.preset);
    if (preset) emit(preset.build(base, inUs, r.in.easing), (t) => ({ timeUs: t }));
  }
  const outStart = clipUs - outUs;
  if (r.out) {
    const preset = animationPreset(r.out.preset);
    if (preset)
      emit(preset.build(base, outUs, r.out.easing), (t) => ({ timeUs: outUs - t, anchor: "end" }));
  }
  if (r.loop) {
    const preset = animationPreset(r.loop.preset);
    const start = inUs;
    const len = Math.max(1, outStart - start);
    // The loop starts and ends at base, exactly where In ends / Out starts: don't double up those points.
    if (preset) emit(preset.build(base, len, "linear"), (t) => ({ timeUs: start + t }), (prop, t) => taken.has(`${prop}@${start + t}`));
  }
  return { keyframes, props };
}

/* ---------- reading a recipe back from keyframes ---------- */

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const sameEasing = (a: Easing, b: Easing) =>
  a.kind === b.kind && (a.kind === "hold" || (b.kind === "bezier" && close(a.x1, b.x1) && close(a.y1, b.y1) && close(a.x2, b.x2) && close(a.y2, b.y2)));

export interface ReadAnimation {
  recipe: AnimationRecipe;
  /** Keyframes exist that no preset explains. */
  custom: boolean;
  /** The loop's keyframes no longer span the clip (it was trimmed): re-apply to refresh. */
  stale?: boolean;
}

type Actual = Keyframe & { property: Prop };
interface Candidate {
  choice: AnimationSlotChoice;
  /** Base values this candidate implies (In ends at base, Out starts at it). */
  base: Partial<Base>;
}

/**
 * Recognize the recipe that produced a clip's keyframes. Each In / Out
 * candidate (preset × easing, its length read off the keyframes) must
 * reproduce a subset of them on its own; the surviving combinations, with
 * each loop, are checked against the whole set. A clip moved on the canvas
 * after animating still reads, because bases come from the keyframes.
 */
export function readAnimation(clip: Clip): ReadAnimation {
  const anim = clip.animations ?? {};
  const visual = (Object.keys(anim) as AnimatableProperty[]).filter((p) => p !== "volume" && (anim[p]?.length ?? 0) > 0) as Prop[];
  if (visual.length === 0) return { recipe: {}, custom: false };
  const actual: Actual[] = visual.flatMap((property) => anim[property]!.map((k) => ({ property, ...k })));
  const clipUs = clip.durationUs;
  const ins: (Candidate | undefined)[] = [undefined, ...slotCandidates("in", actual, clip.transform, clipUs)];
  const outs: (Candidate | undefined)[] = [undefined, ...slotCandidates("out", actual, clip.transform, clipUs)];
  const loops: (AnimationSlotChoice | undefined)[] = [
    undefined,
    ...ANIMATION_PRESETS.filter((p) => p.slot === "loop").map((p) => ({ preset: p.id, durationUs: 0, easing: "linear" as const })),
  ];
  for (const i of ins)
    for (const o of outs)
      for (const l of loops) {
        if (!i && !o && !l) continue;
        const recipe: AnimationRecipe = { ...(i ? { in: i.choice } : {}), ...(l ? { loop: l } : {}), ...(o ? { out: o.choice } : {}) };
        const base: Base = { ...clip.transform, ...loopBase(l, actual, i?.choice.durationUs ?? 0), ...o?.base, ...i?.base };
        if (matches(planAnimation(recipe, base, clipUs).keyframes, actual, true)) return { recipe, custom: false };
      }
  // A trim leaves In / Out intact (Out follows the end) but not the loop's spacing:
  // accept In + Out when everything else sits on the loop's properties
  // (the reading that explains the most keyframes wins).
  let best: { read: ReadAnimation; rest: number } | undefined;
  for (const i of ins)
    for (const o of outs)
      for (const l of loops) {
        if (!l) continue;
        const loopProps = new Set(Object.keys(animationPreset(l.preset)!.build(clip.transform, 1_000_000, "linear")));
        const edges: AnimationRecipe = { ...(i ? { in: i.choice } : {}), ...(o ? { out: o.choice } : {}) };
        const plan = planAnimation(edges, { ...clip.transform, ...o?.base, ...i?.base }, clipUs).keyframes;
        if (!matches(plan, actual, false)) continue;
        const explained = new Set(plan.map((k) => `${k.property}@${k.anchor ?? "s"}:${k.timeUs}`));
        const rest = actual.filter((k) => !explained.has(`${k.property}@${k.anchor ?? "s"}:${k.timeUs}`));
        if (rest.length >= 2 && rest.every((k) => loopProps.has(k.property) && !k.anchor) && (!best || rest.length < best.rest)) {
          best = { read: { recipe: { ...(i ? { in: i.choice } : {}), loop: l, ...(o ? { out: o.choice } : {}) }, custom: false, stale: true }, rest: rest.length };
        }
      }
  return best?.read ?? { recipe: {}, custom: true };
}

function slotCandidates(slot: "in" | "out", actual: Actual[], transform: Base, clipUs: Us): Candidate[] {
  const out: Candidate[] = [];
  const startList = (prop: Prop) => actual.filter((k) => k.property === prop && !k.anchor).sort((a, b) => a.timeUs - b.timeUs);
  const endList = (prop: Prop) => actual.filter((k) => k.property === prop && k.anchor === "end").sort((a, b) => b.timeUs - a.timeUs);
  for (const preset of ANIMATION_PRESETS) {
    if (preset.slot !== slot) continue;
    // Shape at a reference length: point counts, and a property with a point at the slot's far edge.
    const ref = preset.build(transform, 1_000_000, "linear");
    const props = Object.keys(ref) as Prop[];
    const edge = props.find((p) => (slot === "in" ? ref[p]!.at(-1)!.t === 1_000_000 : ref[p]![0]!.t === 0));
    if (!edge) continue;
    const n = ref[edge]!.length;
    const length = slot === "in" ? startList(edge)[n - 1]?.timeUs : endList(edge)[0]?.timeUs;
    if (!length || length <= 0) continue;
    // Bases implied by this slot: In's last values / Out's first values.
    const base: Partial<Base> = {};
    for (const p of props) {
      const k = ref[p]!.length;
      const list = slot === "in" ? startList(p).slice(0, k) : endList(p).slice(0, k);
      const v = slot === "in" ? list.at(-1)?.value : list[0]?.value;
      if (v !== undefined) base[p] = v;
    }
    for (const { id: easing } of ANIMATION_EASINGS) {
      const choice: AnimationSlotChoice = { preset: preset.id, durationUs: length, easing };
      const plan = planAnimation({ [slot]: choice }, { ...transform, ...base }, clipUs).keyframes;
      if (matches(plan, actual, false)) out.push({ choice, base });
    }
  }
  return out;
}

/** A loop starts at base where it begins (after In). */
function loopBase(loop: AnimationSlotChoice | undefined, actual: Actual[], startUs: Us): Partial<Base> {
  if (!loop) return {};
  const preset = animationPreset(loop.preset);
  if (!preset) return {};
  const base: Partial<Base> = {};
  for (const p of Object.keys(preset.build({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }, 1_000_000, "linear")) as Prop[]) {
    const k = actual.find((a) => a.property === p && !a.anchor && a.timeUs === startUs);
    if (k) base[p] = k.value;
  }
  return base;
}

/** `exact`: same set; otherwise every planned keyframe exists in `actual`. */
function matches(planned: PlannedKeyframe[], actual: Actual[], exact: boolean): boolean {
  if (exact && planned.length !== actual.length) return false;
  const key = (k: { property: string; timeUs: number; anchor?: string }) => `${k.property}@${k.anchor ?? "s"}:${k.timeUs}`;
  const byKey = new Map(actual.map((k) => [key(k), k]));
  for (const p of planned) {
    const a = byKey.get(key(p));
    if (!a || !close(a.value, p.value) || !sameEasing(a.easing, p.easing)) return false;
  }
  return true;
}

/** Plain-language summary of a recipe ("Fade in · Pulse · Slide down out"). */
export function describeAnimation(r: AnimationRecipe): string {
  const parts: string[] = [];
  if (r.in) parts.push(`${animationPreset(r.in.preset)?.label ?? "?"} in`);
  if (r.loop) parts.push(animationPreset(r.loop.preset)?.label ?? "?");
  if (r.out) parts.push(`${animationPreset(r.out.preset)?.label ?? "?"} out`);
  return parts.join(" · ");
}

const VISUAL_PROPS: readonly Prop[] = ["x", "y", "scale", "rotation", "opacity"];

/**
 * The commands that give `clip` exactly `recipe`: clear its visual keyframes
 * (volume automation stays), then set the recipe's. Dispatch them in one
 * transaction for a single undo step. An empty recipe removes the animation.
 */
export function animationCommands(clip: Clip, recipe: AnimationRecipe): BuiltinCommand[] {
  const commands: BuiltinCommand[] = [];
  for (const property of VISUAL_PROPS) {
    if ((clip.animations?.[property]?.length ?? 0) > 0) commands.push({ type: "keyframe/clear", payload: { clipId: clip.id, property } });
  }
  for (const k of planAnimation(recipe, clip.transform, clip.durationUs).keyframes) {
    commands.push({
      type: "keyframe/set",
      payload: { clipId: clip.id, property: k.property, timeUs: k.timeUs, value: k.value, easing: k.easing, ...(k.anchor ? { anchor: k.anchor } : {}) },
    });
  }
  return commands;
}
