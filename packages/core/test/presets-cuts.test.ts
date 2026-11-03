import { describe, expect, it } from "vitest";
import {
  ANIMATION_PRESETS,
  BLUR_ANIMATION_PEAK,
  animationCommands,
  animationPreset,
  evaluateClipAt,
  presetAppliesTo,
  applyCommands,
  createProject,
  describeAnimation,
  findCuts,
  readAnimation,
  type AnimationRecipe,
  type Clip,
} from "../src/index.js";

function project() {
  const p = createProject({ width: 1280, height: 720, fps: 30 });
  p.transaction(() => {
    p.dispatch({ type: "asset/add", payload: { id: "a", kind: "video", src: "a.mp4", durationUs: 30_000_000 } });
    p.dispatch({ type: "track/add", payload: { id: "v", kind: "video" } });
    p.dispatch({ type: "clip/add", payload: { kind: "video", id: "c1", trackId: "v", assetId: "a", startUs: 0, durationUs: 4_000_000 } });
    p.dispatch({ type: "clip/add", payload: { kind: "video", id: "c2", trackId: "v", assetId: "a", startUs: 4_000_000, durationUs: 3_000_000, trimStartUs: 10_000_000 } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "t", trackId: "v", startUs: 9_000_000, durationUs: 5_000_000, text: "hi", transform: { x: 0.4, y: 0.6, scale: 1.2 } } });
  });
  return p;
}
const clip = (p: ReturnType<typeof project>, id: string) => p.getState().doc.clips[id] as Clip;
const apply = (p: ReturnType<typeof project>, id: string, r: AnimationRecipe) => {
  const res = applyCommands(p, animationCommands(clip(p, id), r));
  expect(res.ok).toBe(true);
};

describe("animation presets", () => {
  it("every In × Loop × Out combination reads back exactly", () => {
    const p = project();
    const ins = [undefined, ...ANIMATION_PRESETS.filter((x) => x.slot === "in")];
    const loops = [undefined, ...ANIMATION_PRESETS.filter((x) => x.slot === "loop")];
    const outs = [undefined, ...ANIMATION_PRESETS.filter((x) => x.slot === "out")];
    let n = 0;
    for (const i of ins)
      for (const l of loops)
        for (const o of outs) {
          if (!i && !l && !o) continue;
          const r: AnimationRecipe = {
            ...(i ? { in: { preset: i.id, durationUs: 700_000, easing: i.linearOnly ? ("linear" as const) : ("snappy" as const) } } : {}),
            ...(l ? { loop: { preset: l.id, durationUs: 0, easing: "linear" as const } } : {}),
            ...(o ? { out: { preset: o.id, durationUs: 400_000, easing: "smooth" as const } } : {}),
          };
          apply(p, "t", r);
          expect(readAnimation(clip(p, "t"))).toEqual({ recipe: r, custom: false });
          n++;
        }
    expect(n).toBeGreaterThan(300);
  });

  it("Out stays on the end through a trim; a loop reads as stale; custom keyframes read as custom", () => {
    const p = project();
    apply(p, "t", { in: { preset: "in:zoom", durationUs: 500_000, easing: "smooth" }, out: { preset: "out:pop", durationUs: 800_000, easing: "snappy" } });
    p.dispatch({ type: "clip/trim", payload: { clipId: "t", durationUs: 3_000_000 } });
    expect(describeAnimation(readAnimation(clip(p, "t")).recipe)).toBe("Zoom in · Pop out");
    apply(p, "t", { ...readAnimation(clip(p, "t")).recipe, loop: { preset: "loop:pulse", durationUs: 0, easing: "linear" } });
    p.dispatch({ type: "clip/trim", payload: { clipId: "t", durationUs: 4_500_000 } });
    expect(readAnimation(clip(p, "t"))).toMatchObject({ stale: true, recipe: { loop: { preset: "loop:pulse" } } });
    p.dispatch({ type: "keyframe/set", payload: { clipId: "t", property: "rotation", timeUs: 1234, value: 9 } });
    expect(readAnimation(clip(p, "t")).custom).toBe(true);
    apply(p, "t", {});
    expect(clip(p, "t").animations ?? {}).toEqual({});
  });
});

describe("Blur and Typewriter presets", () => {
  const blurIn = { preset: "in:blur", durationUs: 600_000, easing: "linear" as const };

  it("Blur in sharpens and fades in; Blur out mirrors it from the end", () => {
    const p = project();
    apply(p, "c1", { in: blurIn, out: { preset: "out:blur", durationUs: 500_000, easing: "linear" } });
    const anim = clip(p, "c1").animations!;
    expect(anim.blur!.map((k) => [k.timeUs, k.anchor ?? "start", k.value])).toEqual([
      [0, "start", BLUR_ANIMATION_PEAK],
      [600_000, "start", 0],
      [500_000, "end", 0],
      [0, "end", BLUR_ANIMATION_PEAK],
    ]);
    expect(anim.opacity!.length).toBe(4);
    expect(evaluateClipAt(clip(p, "c1"), 0)).toMatchObject({ blur: BLUR_ANIMATION_PEAK, opacity: 0 });
    expect(evaluateClipAt(clip(p, "c1"), 2_000_000)).toMatchObject({ blur: 0, opacity: 1 });
    expect(readAnimation(clip(p, "c1")).recipe.in?.preset).toBe("in:blur");
  });

  it("Typewriter reveals the characters steadily over the In length, text only", () => {
    const p = project();
    apply(p, "t", { in: { preset: "in:typewriter", durationUs: 1_000_000, easing: "linear" } });
    expect(clip(p, "t").animations!.reveal!.map((k) => [k.timeUs, k.value])).toEqual([[0, 0], [1_000_000, 1]]);
    expect(evaluateClipAt(clip(p, "t"), 0).reveal).toBe(0);
    expect(evaluateClipAt(clip(p, "t"), 500_000).reveal).toBeCloseTo(0.5, 6);
    expect(evaluateClipAt(clip(p, "t"), 4_000_000).reveal).toBe(1);
    const typewriter = animationPreset("in:typewriter")!;
    expect(presetAppliesTo(typewriter, clip(p, "t"))).toBe(true);
    expect(presetAppliesTo(typewriter, clip(p, "c1"))).toBe(false);
    expect(presetAppliesTo(animationPreset("in:blur")!, clip(p, "c1"))).toBe(true);
  });

  it("clips without keyframes rest at no blur and everything revealed; replacing the animation clears them", () => {
    const p = project();
    expect(evaluateClipAt(clip(p, "t"), 0)).toMatchObject({ blur: 0, reveal: 1 });
    apply(p, "t", { in: { preset: "in:typewriter", durationUs: 800_000, easing: "linear" } });
    apply(p, "t", { in: blurIn });
    expect(clip(p, "t").animations).not.toHaveProperty("reveal");
    apply(p, "t", {});
    expect(clip(p, "t").animations ?? {}).toEqual({});
  });

  it("validates blur and reveal keyframes", () => {
    const p = project();
    const set = (clipId: string, property: "blur" | "reveal", value: number) =>
      p.dispatch({ type: "keyframe/set", payload: { clipId, property, timeUs: 0, value } });
    expect(() => set("c1", "blur", 0.5)).toThrow(/blur keyframes/);
    expect(() => set("c1", "blur", -0.1)).toThrow(/blur keyframes/);
    expect(() => set("t", "reveal", 1.5)).toThrow(/reveal keyframes/);
    expect(() => set("c1", "reveal", 0.5)).toThrow(/characters to reveal/);
    set("t", "reveal", 0.5);
    set("c1", "blur", 0.1);
    expect(clip(p, "t").animations!.reveal).toHaveLength(1);
  });
});

describe("findCuts", () => {
  it("finds adjacent visual clips with the transition room their media allows", () => {
    const p = project();
    const [cut, ...rest] = findCuts(p.getState().doc);
    expect(rest).toHaveLength(0); // the text clip doesn't touch c2
    // c1 has 26 s after it; c2 has 10 s before it; both clips cap it: min(4 s, 3 s).
    expect(cut).toMatchObject({ fromClipId: "c1", toClipId: "c2", atUs: 4_000_000, maxTransitionUs: 3_000_000 });
    expect(cut!.short).toBeUndefined();
    p.dispatch({ type: "clip/trim", payload: { clipId: "c2", trimStartUs: 0 } });
    expect(findCuts(p.getState().doc)[0]).toMatchObject({ maxTransitionUs: 0, short: "to" });
  });
});
