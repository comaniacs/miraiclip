import { describe, expect, it } from "vitest";
import { evaluateClipAt, evaluateKeyframes, resolveKeyframes, EASING_PRESETS } from "../src/animation.js";
import { describeProject } from "../src/ai.js";
import { createProject } from "../src/engine.js";
import type { Clip } from "../src/types.js";

const linear = EASING_PRESETS.linear;

function setup() {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "a", kind: "video", src: "x.mp4", durationUs: 20_000_000 } });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "clip/add", payload: { kind: "video", id: "c", trackId: "v1", assetId: "a", startUs: 0, durationUs: 5_000_000 } });
  });
  return project;
}
const clip = (p: ReturnType<typeof setup>, id = "c") => p.getState().doc.clips[id] as Clip;
const set = (p: ReturnType<typeof setup>, timeUs: number, value: number, anchor?: "start" | "end") =>
  p.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "opacity", timeUs, value, ...(anchor ? { anchor } : {}) } });

/** Fade in over the first 0.5 s, fade out over the last 0.5 s. */
function inOut(p: ReturnType<typeof setup>) {
  set(p, 0, 0);
  set(p, 500_000, 1);
  set(p, 500_000, 1, "end");
  set(p, 0, 0, "end");
}

describe("end-anchored keyframes", () => {
  it("are stored after start keyframes, in clip-time order, and only carry anchor when 'end'", () => {
    const p = setup();
    inOut(p);
    expect(clip(p).animations!.opacity).toEqual([
      { timeUs: 0, value: 0, easing: linear },
      { timeUs: 500_000, value: 1, easing: linear },
      { timeUs: 500_000, anchor: "end", value: 1, easing: linear },
      { timeUs: 0, anchor: "end", value: 0, easing: linear },
    ]);
    // Same (anchor, time) upserts; the start keyframe at 0.5 s is a different slot.
    set(p, 500_000, 0.8, "end");
    expect(clip(p).animations!.opacity).toHaveLength(4);
    expect(clip(p).animations!.opacity![2]!.value).toBe(0.8);
    expect(clip(p).animations!.opacity![1]!.value).toBe(1);
  });

  it("follow the clip's end through trims", () => {
    const p = setup();
    inOut(p);
    expect(evaluateClipAt(clip(p), 4_750_000).opacity).toBeCloseTo(0.5, 6);
    expect(evaluateClipAt(clip(p), 2_000_000).opacity).toBe(1);
    p.dispatch({ type: "clip/trim", payload: { clipId: "c", durationUs: 3_000_000 } });
    expect(evaluateClipAt(clip(p), 2_750_000).opacity).toBeCloseTo(0.5, 6);
    expect(evaluateClipAt(clip(p), 3_000_000).opacity).toBe(0);
    expect(evaluateClipAt(clip(p), 250_000).opacity).toBeCloseTo(0.5, 6);
  });

  it("interleave by time when the clip is shorter than both animations", () => {
    const p = setup();
    inOut(p);
    p.dispatch({ type: "clip/trim", payload: { clipId: "c", durationUs: 600_000 } });
    const resolved = resolveKeyframes(clip(p).animations!.opacity!, 600_000);
    expect(resolved.map((k) => k.timeUs)).toEqual([0, 100_000, 500_000, 600_000]);
    expect(resolved.every((k) => !("anchor" in k))).toBe(true);
    // Never leaves 0..1.
    for (let t = 0; t <= 600_000; t += 50_000) {
      const v = evaluateClipAt(clip(p), t).opacity;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("resolution is cached and a no-op without end anchors", () => {
    const plain = [{ timeUs: 0, value: 1, easing: linear }];
    expect(resolveKeyframes(plain, 1_000)).toBe(plain);
    const anchored = [{ timeUs: 0, value: 1, easing: linear, anchor: "end" as const }];
    expect(resolveKeyframes(anchored, 1_000)).toBe(resolveKeyframes(anchored, 1_000));
    expect(resolveKeyframes(anchored, 1_000)[0]!.timeUs).toBe(1_000);
    expect(evaluateKeyframes(anchored, 0, 0, 1_000)).toBe(1);
  });

  it("keyframe/remove matches the anchor", () => {
    const p = setup();
    inOut(p);
    p.dispatch({ type: "keyframe/remove", payload: { clipId: "c", property: "opacity", timeUs: 0, anchor: "end" } });
    expect(clip(p).animations!.opacity!.map((k) => [k.timeUs, k.anchor ?? "start"])).toEqual([[0, "start"], [500_000, "start"], [500_000, "end"]]);
    expect(() => p.dispatch({ type: "keyframe/remove", payload: { clipId: "c", property: "opacity", timeUs: 0, anchor: "end" } })).toThrow(/from the end/);
  });

  it("split leaves the Out animation on the right half only", () => {
    const p = setup();
    inOut(p);
    p.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "scale", timeUs: 0, value: 2, anchor: "end" } });
    p.dispatch({ type: "clip/split", payload: { clipId: "c", atUs: 2_000_000, newClipId: "r" } });
    expect(clip(p).animations!.opacity!.some((k) => k.anchor === "end")).toBe(false);
    expect(clip(p).animations!.scale).toBeUndefined();
    expect(clip(p, "r").animations!.opacity!.filter((k) => k.anchor === "end")).toHaveLength(2);
    expect(evaluateClipAt(clip(p, "r"), 3_000_000).opacity).toBe(0);
  });

  it("shows in describeProject", () => {
    const p = setup();
    inOut(p);
    expect(describeProject(p.toJSON())).toContain("[keyframes: opacity (some from end)]");
  });
});
