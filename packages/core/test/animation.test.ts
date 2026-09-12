import { describe, expect, it } from "vitest";
import {
  EASING_PRESETS,
  cubicBezierProgress,
  evaluateClipAt,
  evaluateClipInto,
  evaluateKeyframes,
  resolveEasing,
} from "../src/animation.js";
import { createProject } from "../src/engine.js";
import type { Keyframe, VideoClip } from "../src/types.js";

const linear = EASING_PRESETS.linear;

function kf(timeUs: number, value: number, easing = linear): Keyframe {
  return { timeUs, value, easing };
}

describe("cubicBezierProgress", () => {
  it("is exact at the endpoints and identity for linear", () => {
    expect(cubicBezierProgress(0, 0, 1, 1, 0)).toBe(0);
    expect(cubicBezierProgress(0, 0, 1, 1, 1)).toBe(1);
    expect(cubicBezierProgress(0, 0, 1, 1, 0.37)).toBeCloseTo(0.37, 6);
  });

  it("easeIn starts slow, easeOut starts fast (CSS control points)", () => {
    const easeIn = cubicBezierProgress(0.42, 0, 1, 1, 0.25);
    const easeOut = cubicBezierProgress(0, 0, 0.58, 1, 0.25);
    expect(easeIn).toBeLessThan(0.25);
    expect(easeOut).toBeGreaterThan(0.25);
    // Symmetry: easeInOut at midpoint is exactly 0.5.
    expect(cubicBezierProgress(0.42, 0, 0.58, 1, 0.5)).toBeCloseTo(0.5, 4);
  });

  it("stays monotonic across the whole range (Newton + bisection agree)", () => {
    let previous = 0;
    for (let i = 1; i <= 100; i++) {
      const y = cubicBezierProgress(0.42, 0, 0.58, 1, i / 100);
      expect(y).toBeGreaterThanOrEqual(previous);
      previous = y;
    }
  });
});

describe("evaluateKeyframes", () => {
  const keyframes = [kf(0, 10), kf(1_000_000, 20), kf(2_000_000, 0)];

  it("holds the first value before and the last value after", () => {
    expect(evaluateKeyframes(keyframes, -5, 99)).toBe(10);
    expect(evaluateKeyframes(keyframes, 5_000_000, 99)).toBe(0);
  });

  it("interpolates linearly between keyframes", () => {
    expect(evaluateKeyframes(keyframes, 500_000, 99)).toBeCloseTo(15, 6);
    expect(evaluateKeyframes(keyframes, 1_500_000, 99)).toBeCloseTo(10, 6);
  });

  it("returns the fallback when there are no keyframes", () => {
    expect(evaluateKeyframes([], 0, 42)).toBe(42);
  });

  it("hold easing steps instead of interpolating", () => {
    const held = [kf(0, 10, { kind: "hold" }), kf(1_000_000, 20)];
    expect(evaluateKeyframes(held, 999_999, 0)).toBe(10);
    expect(evaluateKeyframes(held, 1_000_000, 0)).toBe(20);
  });

  it("binary search lands on the right segment in long lists", () => {
    const many = Array.from({ length: 101 }, (_, i) => kf(i * 10_000, i));
    expect(evaluateKeyframes(many, 555_000, 0)).toBeCloseTo(55.5, 6);
  });
});

describe("evaluateClipAt", () => {
  function clipWith(animations: VideoClip["animations"]): VideoClip {
    const project = createProject({ width: 1280, height: 720, fps: 30 });
    project.transaction(() => {
      project.dispatch({
        type: "asset/add",
        payload: { id: "a", kind: "video", src: "x.mp4", durationUs: 10_000_000 },
      });
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({
        type: "clip/add",
        payload: {
          kind: "video", id: "c", trackId: "v1", assetId: "a",
          startUs: 0, durationUs: 5_000_000, volume: 0.8,
          transform: { opacity: 0.5 },
        },
      });
    });
    const clip = project.getState().doc.clips["c"] as VideoClip;
    return animations ? { ...clip, animations } : clip;
  }

  it("static values are the fallback for unanimated properties", () => {
    const evaluated = evaluateClipAt(clipWith(undefined), 1_000_000);
    expect(evaluated).toMatchObject({ x: 0.5, y: 0.5, scale: 1, opacity: 0.5, volume: 0.8 });
  });

  it("animated properties override statics; others untouched", () => {
    const evaluated = evaluateClipAt(
      clipWith({ opacity: [kf(0, 0), kf(1_000_000, 1)] }),
      500_000,
    );
    expect(evaluated.opacity).toBeCloseTo(0.5, 6);
    expect(evaluated.volume).toBe(0.8); // untouched
  });

  it("evaluateClipInto reuses the output object (alloc-free contract)", () => {
    const out = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, volume: 1 };
    const returned = evaluateClipInto(clipWith({ x: [kf(0, 0), kf(1_000_000, 1)] }), 250_000, out);
    expect(returned).toBe(out);
    expect(out.x).toBeCloseTo(0.25, 6);
  });
});

describe("keyframe commands", () => {
  function setup() {
    const project = createProject({ width: 1280, height: 720, fps: 30 });
    project.transaction(() => {
      project.dispatch({
        type: "asset/add",
        payload: { id: "a", kind: "video", src: "x.mp4", durationUs: 10_000_000 },
      });
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({
        type: "clip/add",
        payload: { kind: "video", id: "c", trackId: "v1", assetId: "a", startUs: 0, durationUs: 5_000_000 },
      });
    });
    return project;
  }

  it("keyframe/set inserts sorted, expands presets, and upserts at equal time", () => {
    const project = setup();
    project.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "opacity", timeUs: 1_000_000, value: 1 } });
    project.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "opacity", timeUs: 0, value: 0, easing: "easeIn" } });
    project.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "opacity", timeUs: 0, value: 0.25 } });
    const keyframes = project.getState().doc.clips["c"]!.animations!.opacity!;
    expect(keyframes.map((k) => k.timeUs)).toEqual([0, 1_000_000]); // sorted, upserted
    expect(keyframes[0]!.value).toBe(0.25);
    expect(keyframes[0]!.easing).toEqual(EASING_PRESETS.linear); // upsert replaced easing too
    expect(resolveEasing("easeIn")).toEqual({ kind: "bezier", x1: 0.42, y1: 0, x2: 1, y2: 1 });
  });

  it("rejects volume keyframes on clips without volume and out-of-range opacity", () => {
    const project = setup();
    project.transaction(() => {
      project.dispatch({
        type: "clip/add",
        payload: { kind: "text", id: "t", trackId: "v1", startUs: 0, durationUs: 1_000_000, text: "hi" },
      });
    });
    expect(() =>
      project.dispatch({ type: "keyframe/set", payload: { clipId: "t", property: "volume", timeUs: 0, value: 1 } }),
    ).toThrow(/no volume/);
    expect(() =>
      project.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "opacity", timeUs: 0, value: 2 } }),
    ).toThrow(/0\.\.1/);
  });

  it("keyframe/remove deletes exactly one; keyframe/clear wipes a property or all", () => {
    const project = setup();
    for (const [property, timeUs, value] of [["opacity", 0, 0], ["opacity", 1_000_000, 1], ["x", 0, 0.5]] as const) {
      project.dispatch({ type: "keyframe/set", payload: { clipId: "c", property, timeUs, value } });
    }
    project.dispatch({ type: "keyframe/remove", payload: { clipId: "c", property: "opacity", timeUs: 0 } });
    expect(project.getState().doc.clips["c"]!.animations!.opacity!.length).toBe(1);
    expect(() =>
      project.dispatch({ type: "keyframe/remove", payload: { clipId: "c", property: "opacity", timeUs: 77 } }),
    ).toThrow(/keyframe-not-found|no opacity keyframe/);
    project.dispatch({ type: "keyframe/clear", payload: { clipId: "c" } });
    expect(project.getState().doc.clips["c"]!.animations).toBeUndefined();
  });

  it("keyframes survive undo/redo like any other document change", () => {
    const project = setup();
    project.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "scale", timeUs: 0, value: 2 } });
    project.undo();
    expect(project.getState().doc.clips["c"]!.animations).toBeUndefined();
    project.redo();
    expect(project.getState().doc.clips["c"]!.animations!.scale![0]!.value).toBe(2);
  });
});
