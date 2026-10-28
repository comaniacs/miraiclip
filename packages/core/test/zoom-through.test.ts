import { describe, expect, it } from "vitest";
import { createProject } from "../src/engine.js";
import { findCuts } from "../src/cuts.js";
import { transitionHoldsFrames } from "../src/registry.js";

/** Two adjacent clips with NO spare footage on either side (each clip uses its whole asset). */
function noHandles() {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "m", kind: "video", src: "x.mp4", durationUs: 2_000_000 } });
    project.dispatch({ type: "asset/add", payload: { id: "n", kind: "video", src: "y.mp4", durationUs: 2_000_000 } });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "clip/add", payload: { kind: "video", id: "a", trackId: "v1", assetId: "m", startUs: 0, durationUs: 2_000_000, trimStartUs: 0 } });
    project.dispatch({ type: "clip/add", payload: { kind: "video", id: "b", trackId: "v1", assetId: "n", startUs: 2_000_000, durationUs: 2_000_000, trimStartUs: 0 } });
  });
  return project;
}
const add = (project: ReturnType<typeof noHandles>, kind: string, durationUs: number, params?: Record<string, unknown>) =>
  project.dispatch({ type: "transition/add", payload: { id: "t", kind, fromClipId: "a", toClipId: "b", durationUs, ...(params ? { params } : {}) } });

describe("zoomThrough transition", () => {
  it("holds frames, so it needs no spare footage where a dissolve is refused", () => {
    expect(transitionHoldsFrames("zoomThrough")).toBe(true);
    expect(transitionHoldsFrames("crossDissolve")).toBe(false);
    expect(() => add(noHandles(), "crossDissolve", 1_000_000)).toThrow(/insufficient-handles|no source media/);
    const project = noHandles();
    add(project, "zoomThrough", 1_000_000);
    expect(project.getState().doc.transitions["t"]!.kind).toBe("zoomThrough");
  });

  it("defaults the rect to the centre quarter and the ease to inOut", () => {
    const project = noHandles();
    add(project, "zoomThrough", 1_000_000);
    expect(project.getState().doc.transitions["t"]!.params).toEqual({ rect: { x: 0.375, y: 0.375, w: 0.25, h: 0.25 }, ease: "inOut" });
  });

  it("validates the rect", () => {
    expect(() => add(noHandles(), "zoomThrough", 1_000_000, { rect: { x: 0.9, y: 0.1, w: 0.3, h: 0.2 } })).toThrow(/inside the frame/);
    expect(() => add(noHandles(), "zoomThrough", 1_000_000, { rect: { x: 0.1, y: 0.1, w: 0, h: 0.2 } })).toThrow();
    expect(() => add(noHandles(), "zoomThrough", 1_000_000, { ease: "bounce" })).toThrow();
  });

  it("can't outlast the shorter clip, on add or update", () => {
    expect(() => add(noHandles(), "zoomThrough", 2_500_000)).toThrow(/transition-too-long|longer than/);
    const project = noHandles();
    add(project, "zoomThrough", 1_000_000);
    expect(() => project.dispatch({ type: "transition/update", payload: { transitionId: "t", durationUs: 2_500_000 } })).toThrow(/longer than/);
    project.dispatch({ type: "transition/update", payload: { transitionId: "t", durationUs: 1_800_000 } });
    expect(project.getState().doc.transitions["t"]!.durationUs).toBe(1_800_000);
  });

  it("findCuts reports the held-frame limit separately from the footage limit", () => {
    const [cut] = findCuts(noHandles().getState().doc);
    expect(cut!.maxTransitionUs).toBe(0);
    expect(cut!.maxHoldTransitionUs).toBe(2_000_000);
  });
});
