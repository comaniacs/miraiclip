import { describe, expect, it } from "vitest";
import { createProject } from "../src/engine.js";
import { evaluateEffectRegion, hasAnimatedEffectRegion } from "../src/effect-region.js";

const S = 1_000_000;

function setup() {
  const p = createProject({ width: 1280, height: 720, fps: 30 });
  p.dispatch({ type: "asset/add", payload: { id: "a", kind: "video", src: "x.mp4", durationUs: 60 * S } });
  p.dispatch({ type: "track/add", payload: { id: "v", kind: "video" } });
  p.dispatch({ type: "clip/add", payload: { kind: "video", id: "c", trackId: "v", assetId: "a", startUs: 0, durationUs: 4 * S } });
  return p;
}
const effect = (p: ReturnType<typeof setup>) => p.getState().doc.clips["c"]!.effects![0]!;

describe("effect regions", () => {
  it("effect/add stores a minimal region; update replaces or clears it", () => {
    const p = setup();
    p.dispatch({
      type: "effect/add",
      payload: { clipId: "c", kind: "blur", effectId: "b", region: { x: 0.1, y: 0.2, width: 0.3, height: 0.1, shape: "rect", feather: 0, invert: false } },
    });
    expect(effect(p).region).toEqual({ x: 0.1, y: 0.2, width: 0.3, height: 0.1 });
    p.dispatch({ type: "effect/update", payload: { clipId: "c", effectId: "b", region: { x: 0, y: 0, width: 0.5, height: 0.5, shape: "ellipse", feather: 0.2, invert: true } } });
    expect(effect(p).region).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5, shape: "ellipse", feather: 0.2, invert: true });
    p.dispatch({ type: "effect/update", payload: { clipId: "c", effectId: "b", region: null } });
    expect("region" in effect(p)).toBe(false);
    expect(() =>
      p.dispatch({ type: "effect/update", payload: { clipId: "c", effectId: "b", region: { x: 0, y: 0, width: 0, height: 1 } } }),
    ).toThrow();
  });

  it("keyframed regions follow the content and survive a region update", () => {
    const p = setup();
    p.dispatch({ type: "effect/add", payload: { clipId: "c", kind: "pixelate", effectId: "px", region: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 } } });
    expect(() =>
      p.dispatch({ type: "effect/set-region-keyframe", payload: { clipId: "c", effectId: "px", property: "width", timeUs: 0, value: 0 } }),
    ).toThrow(/out-of-range/);
    p.dispatch({ type: "effect/set-region-keyframe", payload: { clipId: "c", effectId: "px", property: "x", timeUs: 0, value: 0.1 } });
    p.dispatch({ type: "effect/set-region-keyframe", payload: { clipId: "c", effectId: "px", property: "x", timeUs: 2 * S, value: 0.5 } });
    const clip = p.getState().doc.clips["c"]!;
    expect(hasAnimatedEffectRegion(clip)).toBe(true);
    const mid = evaluateEffectRegion(effect(p).region!, S, clip.durationUs);
    expect(mid.x).toBeCloseTo(0.3, 6);
    expect(mid).toMatchObject({ y: 0.1, width: 0.2, height: 0.1, shape: "rect", feather: 0, invert: false });
    p.dispatch({ type: "effect/update", payload: { clipId: "c", effectId: "px", region: { x: 0, y: 0, width: 0.4, height: 0.4 } } });
    expect(effect(p).region!.animations!.x).toHaveLength(2);
    p.dispatch({ type: "effect/clear-region-keyframes", payload: { clipId: "c", effectId: "px" } });
    expect(hasAnimatedEffectRegion(p.getState().doc.clips["c"]!)).toBe(false);
  });

  it("keyframing needs a region", () => {
    const p = setup();
    p.dispatch({ type: "effect/add", payload: { clipId: "c", kind: "blur", effectId: "b" } });
    expect(() =>
      p.dispatch({ type: "effect/set-region-keyframe", payload: { clipId: "c", effectId: "b", property: "x", timeUs: 0, value: 0.2 } }),
    ).toThrow(/no-region/);
  });
});
