import { describe, expect, it } from "vitest";
import { createProject } from "../src/engine.js";
import {
  clipHeadroomTimelineUs,
  clipSpeed,
  sourceEndUs,
  toSourceUs,
  toTimelineUs,
} from "../src/time-remap.js";
import { findCuts } from "../src/cuts.js";
import type { VideoClip } from "../src/types.js";

const S = 1_000_000;

function setup() {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "a", kind: "video", src: "x.mp4", durationUs: 60 * S } });
    project.dispatch({ type: "asset/add", payload: { id: "m", kind: "audio", src: "x.mp3", durationUs: 60 * S } });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "track/add", payload: { id: "a1", kind: "audio" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "c1", trackId: "v1", assetId: "a", startUs: 0, durationUs: 4 * S, trimStartUs: 10 * S },
    });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "c2", trackId: "v1", assetId: "a", startUs: 4 * S, durationUs: 2 * S, trimStartUs: 30 * S },
    });
  });
  return project;
}

const clip = (p: ReturnType<typeof setup>, id: string) => p.getState().doc.clips[id] as VideoClip;

describe("clip time-remap", () => {
  it("maps timeline ↔ source at speed 1, 2 and 0.5", () => {
    const base = { id: "x", kind: "video", trackId: "v", assetId: "a", startUs: S, durationUs: 4 * S, trimStartUs: 10 * S, volume: 1, transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 } } as VideoClip;
    expect(toSourceUs(base, 2 * S)).toBe(11 * S);
    expect(clipSpeed(base)).toBe(1);
    const fast = { ...base, speed: 2 };
    expect(toSourceUs(fast, 2 * S)).toBe(12 * S);
    expect(sourceEndUs(fast)).toBe(18 * S);
    expect(toTimelineUs(fast, 12 * S)).toBe(2 * S);
    const slow = { ...base, speed: 0.5 };
    expect(toSourceUs(slow, 3 * S)).toBe(11 * S);
    expect(sourceEndUs(slow)).toBe(12 * S);
    const frozen = { ...base, speed: 0 };
    expect(toSourceUs(frozen, 4 * S)).toBe(10 * S);
    expect(toTimelineUs(frozen, 10 * S)).toBeUndefined();
  });

  it("clip/add stores speed; 1 is omitted; audio can't freeze; bad speeds reject", () => {
    const p = setup();
    p.dispatch({ type: "clip/add", payload: { kind: "audio", id: "au", trackId: "a1", assetId: "m", startUs: 0, durationUs: S, speed: 1.5 } });
    expect((p.getState().doc.clips["au"] as { speed?: number }).speed).toBe(1.5);
    p.dispatch({ type: "clip/add", payload: { kind: "audio", id: "au2", trackId: "a1", assetId: "m", startUs: 2 * S, durationUs: S, speed: 1 } });
    expect("speed" in p.getState().doc.clips["au2"]!).toBe(false);
    expect(() =>
      p.dispatch({ type: "clip/add", payload: { kind: "audio", id: "au3", trackId: "a1", assetId: "m", startUs: 4 * S, durationUs: S, speed: 0 } }),
    ).toThrow(/cannot-freeze|only video/);
    expect(() =>
      p.dispatch({ type: "clip/add", payload: { kind: "audio", id: "au4", trackId: "a1", assetId: "m", startUs: 4 * S, durationUs: S, speed: 0.01 } }),
    ).toThrow();
    expect(() =>
      p.dispatch({ type: "clip/add", payload: { kind: "audio", id: "au5", trackId: "a1", assetId: "m", startUs: 4 * S, durationUs: S, speed: 17 } }),
    ).toThrow();
  });

  it("clip/set-speed keeps the footage by default and can ripple the track", () => {
    const p = setup();
    p.dispatch({ type: "clip/set-speed", payload: { clipId: "c1", speed: 2, ripple: true } });
    expect(clip(p, "c1")).toMatchObject({ speed: 2, durationUs: 2 * S, trimStartUs: 10 * S });
    expect(sourceEndUs(clip(p, "c1"))).toBe(14 * S);
    expect(clip(p, "c2").startUs).toBe(2 * S); // rippled left by 2 s
    p.undo();
    expect(clip(p, "c1").durationUs).toBe(4 * S);
    expect(clip(p, "c2").startUs).toBe(4 * S);

    p.dispatch({ type: "clip/set-speed", payload: { clipId: "c1", speed: 0.5, keepDuration: true } });
    expect(clip(p, "c1")).toMatchObject({ speed: 0.5, durationUs: 4 * S });
    expect(clip(p, "c2").startUs).toBe(4 * S);
    p.dispatch({ type: "clip/set-speed", payload: { clipId: "c1", speed: 1 } });
    expect("speed" in clip(p, "c1")).toBe(false);
    expect(clip(p, "c1").durationUs).toBe(2 * S); // 2 s of footage at 1×
  });

  it("clip/split keeps source continuity at speed 2", () => {
    const p = setup();
    p.dispatch({ type: "clip/set-speed", payload: { clipId: "c1", speed: 2, keepDuration: true } });
    p.dispatch({ type: "clip/split", payload: { clipId: "c1", atUs: S, newClipId: "r" } });
    expect(clip(p, "c1")).toMatchObject({ durationUs: S, speed: 2 });
    expect(clip(p, "r")).toMatchObject({ startUs: S, durationUs: 3 * S, trimStartUs: 12 * S, speed: 2 });
  });

  it("clip/freeze holds a frame mid-clip and ripples the rest of the track", () => {
    const p = setup();
    p.dispatch({ type: "clip/freeze", payload: { clipId: "c1", atUs: S, durationUs: 3 * S, freezeClipId: "f", rightClipId: "r" } });
    expect(clip(p, "c1")).toMatchObject({ startUs: 0, durationUs: S });
    expect(clip(p, "f")).toMatchObject({ startUs: S, durationUs: 3 * S, trimStartUs: 11 * S, speed: 0 });
    expect(clip(p, "r")).toMatchObject({ startUs: 4 * S, durationUs: 3 * S, trimStartUs: 11 * S });
    expect("speed" in clip(p, "r")).toBe(false);
    expect(clip(p, "c2").startUs).toBe(7 * S);
    expect(toSourceUs(clip(p, "f"), 3.5 * S)).toBe(11 * S);
    // one undo step
    p.undo();
    expect(Object.keys(p.getState().doc.clips).sort()).toEqual(["c1", "c2"]);
    expect(clip(p, "c2").startUs).toBe(4 * S);
  });

  it("clip/freeze at the clip's end holds the last frame without splitting", () => {
    const p = setup();
    p.dispatch({ type: "clip/freeze", payload: { clipId: "c2", atUs: 6 * S, durationUs: S, freezeClipId: "f" } });
    expect(clip(p, "f")).toMatchObject({ startUs: 6 * S, durationUs: S, trimStartUs: 32 * S - 1, speed: 0 });
    expect(clip(p, "c2").durationUs).toBe(2 * S);
    expect(() => p.dispatch({ type: "clip/freeze", payload: { clipId: "c2", atUs: 7 * S, durationUs: S } })).toThrow(/out-of-range/);
  });

  it("clip/freeze with ripple false lays the freeze over what follows", () => {
    const p = setup();
    p.dispatch({ type: "clip/freeze", payload: { clipId: "c1", atUs: 2 * S, durationUs: S, freezeClipId: "f", rightClipId: "r", ripple: false } });
    expect(clip(p, "r").startUs).toBe(2 * S);
    expect(clip(p, "c2").startUs).toBe(4 * S);
  });

  it("transition headroom is measured in timeline time at the clip's speed", () => {
    const p = setup();
    // c1 source ends at 14 s → 46 s spare; at 2× that is 23 s of timeline.
    p.dispatch({ type: "clip/set-speed", payload: { clipId: "c1", speed: 2, keepDuration: true } });
    const c1 = clip(p, "c1");
    expect(sourceEndUs(c1)).toBe(18 * S);
    expect(clipHeadroomTimelineUs(p.getState().doc, c1, "out")).toBe(21 * S);
    expect(clipHeadroomTimelineUs(p.getState().doc, c1, "in")).toBe(5 * S);
    expect(findCuts(p.getState().doc)[0]!.maxTransitionUs).toBe(2 * S); // limited by c2's length
  });
});
