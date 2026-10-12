import { describe, expect, it } from "vitest";
import { createProject, type Project } from "@miraiclip/core";
import {
  beginClipDrag,
  beginGesture,
  clipsByTrack,
  clipsInRange,
  compositionDurationUs,
  createCommands,
  fillScale,
  followPlayheadScroll,
  formatClock,
  isTrackFree,
  matchEditorShortcut,
  newId,
  placeAssetAtPlayhead,
  placeAssetOnTrack,
  playheadOffscreenSide,
  presetFor,
  pxToUs,
  refillForAspect,
  revealPlayheadScroll,
  runEditorAction,
  snapToTargets,
  transitionsByTrack,
  usToPx,
  visibleRange,
  wheelZoomFactor,
  zoomAtPoint,
} from "../src/index.js";

const S = 1_000_000;

/** v1 (video): a [0,2s) b [2s,5s) — v2 (video, locked): c [1s,3s) — a1 (audio). */
function setup(): Project {
  const project = createProject({ width: 1920, height: 1080, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "vid", kind: "video", src: "/v.mp4", durationUs: 10 * S, width: 1080, height: 1920 } });
    project.dispatch({ type: "asset/add", payload: { id: "snd", kind: "audio", src: "/a.mp3", durationUs: 3 * S } });
    project.dispatch({ type: "asset/add", payload: { id: "img", kind: "image", src: "/i.png", width: 100, height: 100 } });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "track/add", payload: { id: "v2", kind: "video" } });
    project.dispatch({ type: "track/add", payload: { id: "a1", kind: "audio" } });
    project.dispatch({ type: "clip/add", payload: { kind: "video", id: "a", trackId: "v1", assetId: "vid", startUs: 0, durationUs: 2 * S, trimStartUs: 1 * S } });
    project.dispatch({ type: "clip/add", payload: { kind: "video", id: "b", trackId: "v1", assetId: "vid", startUs: 2 * S, durationUs: 3 * S } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "c", trackId: "v2", startUs: 1 * S, durationUs: 2 * S, text: "hi" } });
  });
  project.dispatch({ type: "track/set-property", payload: { trackId: "v2", locked: true } });
  project.clearHistory();
  return project;
}

describe("selectors", () => {
  it("indexes clips by track in start order, cached per clips object", () => {
    const project = setup();
    const { doc } = project.getState();
    const first = clipsByTrack(doc.clips);
    expect(first.get("v1")!.map((c) => c.id)).toEqual(["a", "b"]);
    expect(clipsByTrack(doc.clips)).toBe(first);
    project.setPlayhead(1 * S); // ephemeral change: same clips object, same index
    expect(clipsByTrack(project.getState().doc.clips)).toBe(first);
    project.dispatch({ type: "clip/move", payload: { clipId: "a", startUs: 6 * S } });
    expect(clipsByTrack(project.getState().doc.clips).get("v1")!.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("finds clips overlapping a range, including long clips that start before it", () => {
    const project = setup();
    const v1 = clipsByTrack(project.getState().doc.clips).get("v1")!;
    expect(clipsInRange(v1, 1.5 * S, 2.5 * S).map((c) => c.id)).toEqual(["a", "b"]);
    expect(clipsInRange(v1, 2 * S, 3 * S).map((c) => c.id)).toEqual(["b"]);
    expect(clipsInRange(v1, 5 * S, 9 * S)).toEqual([]);
    expect(clipsInRange([], 0, 1)).toEqual([]);
  });

  it("reports composition duration, transitions by track, and free ranges", () => {
    const project = setup();
    const { doc } = project.getState();
    expect(compositionDurationUs(doc.clips)).toBe(5 * S);
    expect(transitionsByTrack(doc.transitions).size).toBe(0);
    expect(isTrackFree(doc, "v1", 5 * S, 6 * S)).toBe(true);
    expect(isTrackFree(doc, "v1", 4 * S, 6 * S)).toBe(false);
    expect(isTrackFree(doc, "v1", 2 * S, 5 * S, "b")).toBe(true);
  });
});

describe("time scale", () => {
  it("converts between time and pixels and formats a clock", () => {
    expect(usToPx(2 * S, 50)).toBe(100);
    expect(pxToUs(100, 50)).toBe(2 * S);
    expect(formatClock(75.4 * S)).toBe("01:15");
    expect(formatClock(-1)).toBe("00:00");
  });

  it("returns a visible range with overscan, snapped to half-viewport steps", () => {
    const at = (scrollLeftPx: number) => visibleRange({ scrollLeftPx, viewportWidthPx: 1000, pxPerSecond: 100 });
    expect(at(0)).toEqual({ fromUs: 0, toUs: 20 * S });
    expect(at(2000)).toEqual({ fromUs: 10 * S, toUs: 40 * S });
    expect(at(2100)).toEqual(at(2400)); // small scrolls keep the same range
  });

  it("zooms around the pointer, keeping the time under it fixed and clamping", () => {
    const next = zoomAtPoint({ pxPerSecond: 100, scrollLeftPx: 500, anchorPx: 300, factor: 2, minPxPerSecond: 8, maxPxPerSecond: 120 });
    expect(next.pxPerSecond).toBe(120);
    const timeBefore = (300 + 500) / 100;
    expect((300 + next.scrollLeftPx) / next.pxPerSecond).toBeCloseTo(timeBefore);
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
  });

  it("tells when the playhead is off screen and where to scroll", () => {
    const view = { pxPerSecond: 100, scrollLeftPx: 1000, viewportWidthPx: 500 };
    expect(playheadOffscreenSide({ ...view, playheadUs: 5 * S })).toBe("left");
    expect(playheadOffscreenSide({ ...view, playheadUs: 12 * S })).toBeNull();
    expect(playheadOffscreenSide({ ...view, playheadUs: 20 * S })).toBe("right");
    expect(followPlayheadScroll({ ...view, playheadUs: 12 * S })).toBeNull();
    expect(followPlayheadScroll({ ...view, playheadUs: 14.9 * S })).toBe(1440);
    expect(revealPlayheadScroll({ pxPerSecond: 100, viewportWidthPx: 500, playheadUs: 20 * S })).toBe(1850);
  });
});

describe("clip drag", () => {
  it("snaps a moved clip's nearer edge to targets", () => {
    expect(snapToTargets(1_950_000, [0, 2 * S], 100_000)).toBe(2 * S);
    expect(snapToTargets(1_800_000, [0, 2 * S], 100_000)).toBe(1_800_000);
    const project = setup();
    project.dispatch({ type: "clip/move", payload: { clipId: "b", startUs: 6 * S } });
    const drag = beginClipDrag(project, "a", "move", { snapThresholdUs: 100_000 })!;
    expect(drag.update(3.95 * S).startUs).toBe(4 * S); // end edge snaps onto b's start (6s)
    expect(drag.update(-1 * S).startUs).toBe(0);
    drag.update(1 * S);
    expect(drag.commit()).toBe(true);
    expect(project.getState().doc.clips["a"]!.startUs).toBe(1 * S);
    project.undo();
    expect(project.getState().doc.clips["a"]!.startUs).toBe(0); // one undo step
  });

  it("moves across tracks only onto unlocked tracks that accept the clip", () => {
    const project = setup();
    project.dispatch({ type: "track/add", payload: { id: "v3", kind: "video" } });
    const drag = beginClipDrag(project, "b", "move", { snapThresholdUs: 0 })!;
    expect(drag.update(0, "a1").trackId).toBe("v1"); // audio track can't hold video
    expect(drag.update(0, "v2").trackId).toBe("v1"); // locked
    expect(drag.update(0, "v3").trackId).toBe("v3");
    drag.commit();
    expect(project.getState().doc.clips["b"]!.trackId).toBe("v3");
  });

  it("won't drag a clip on a locked track; a no-op drag commits nothing", () => {
    const project = setup();
    expect(beginClipDrag(project, "c", "move", { snapThresholdUs: 0 })).toBeNull();
    expect(beginClipDrag(project, "missing", "move", { snapThresholdUs: 0 })).toBeNull();
    const drag = beginClipDrag(project, "a", "move", { snapThresholdUs: 0 })!;
    drag.update(0);
    expect(drag.commit()).toBe(false);
    expect(project.canUndo()).toBe(false);
  });

  it("trims the end with a minimum length and snapping", () => {
    const project = setup();
    const drag = beginClipDrag(project, "b", "trim-end", { snapThresholdUs: 0, minDurationUs: 500_000 })!;
    expect(drag.update(-10 * S).durationUs).toBe(500_000);
    expect(drag.update(1 * S).durationUs).toBe(4 * S);
    drag.commit();
    expect(project.getState().doc.clips["b"]!.durationUs).toBe(4 * S);
  });

  it("trims the start, keeping the out-point and moving the media in-point", () => {
    const project = setup();
    const drag = beginClipDrag(project, "a", "trim-start", { snapThresholdUs: 0 })!;
    const preview = drag.update(0.5 * S);
    expect(preview).toMatchObject({ startUs: 0.5 * S, durationUs: 1.5 * S });
    expect(drag.update(5 * S).startUs).toBe(1.8 * S); // stops 200 ms before the out-point
    drag.update(0.5 * S);
    drag.commit();
    const a = project.getState().doc.clips["a"] as { startUs: number; durationUs: number; trimStartUs: number };
    expect(a).toMatchObject({ startUs: 0.5 * S, durationUs: 1.5 * S, trimStartUs: 1.5 * S });
  });
});

describe("shortcuts", () => {
  it("maps the default keys", () => {
    expect(matchEditorShortcut({ key: "Delete" })).toBe("delete");
    expect(matchEditorShortcut({ key: "Backspace" })).toBe("delete");
    expect(matchEditorShortcut({ key: "s" })).toBe("split");
    expect(matchEditorShortcut({ key: "S", shiftKey: true })).toBeNull();
    expect(matchEditorShortcut({ key: "z", metaKey: true })).toBe("undo");
    expect(matchEditorShortcut({ key: "Z", ctrlKey: true, shiftKey: true })).toBe("redo");
    expect(matchEditorShortcut({ key: "y", ctrlKey: true })).toBe("redo");
    expect(matchEditorShortcut({ key: "s", ctrlKey: true })).toBeNull();
    expect(matchEditorShortcut({ key: "z", ctrlKey: true, altKey: true })).toBeNull();
  });

  it("deletes every selected clip on unlocked tracks as one undo step", () => {
    const project = setup();
    project.setSelection(["a", "b", "c"]);
    expect(runEditorAction(project, "delete")).toBe(true);
    const { doc, selection } = project.getState();
    expect(Object.keys(doc.clips).sort()).toEqual(["c"]); // c is on a locked track
    expect(selection).toEqual(["c"]);
    project.undo();
    expect(Object.keys(project.getState().doc.clips).sort()).toEqual(["a", "b", "c"]);
    project.setSelection([]);
    expect(runEditorAction(project, "delete")).toBe(false);
  });

  it("splits selected clips under the playhead", () => {
    const project = setup();
    project.setSelection(["a", "b"]);
    project.setPlayhead(1 * S);
    expect(runEditorAction(project, "split")).toBe(true);
    expect(Object.values(project.getState().doc.clips).filter((c) => c.trackId === "v1")).toHaveLength(3);
    project.setPlayhead(2 * S); // exactly on a cut: nothing to split
    project.setSelection(["b"]);
    expect(runEditorAction(project, "split")).toBe(false);
    expect(runEditorAction(project, "undo")).toBe(true);
    expect(runEditorAction(project, "redo")).toBe(true);
  });
});

describe("placement", () => {
  it("places an asset on a track, refusing locked or wrong-kind tracks", () => {
    const project = setup();
    expect(placeAssetOnTrack(project, "snd", "v1", 0)).toBeNull();
    expect(placeAssetOnTrack(project, "vid", "v2", 0)).toBeNull();
    const id = placeAssetOnTrack(project, "img", "v1", 6.4 * S)!;
    const clip = project.getState().doc.clips[id]!;
    expect(clip).toMatchObject({ kind: "image", startUs: 6.4 * S, durationUs: 5 * S });
    expect(project.getState().selection).toEqual([id]);
  });

  it("places at the playhead on the first free track, else adds a track", () => {
    const project = setup();
    project.setPlayhead(1 * S);
    const id = placeAssetAtPlayhead(project, "vid")!; // v1 busy, v2 locked → new track
    const { doc } = project.getState();
    const track = doc.tracks[doc.clips[id]!.trackId]!;
    expect(track).toMatchObject({ kind: "video", name: "Video 3" });
    project.undo(); // track and clip together
    expect(project.getState().doc.tracks[track.id]).toBeUndefined();
    const audio = placeAssetAtPlayhead(project, "snd")!;
    expect(project.getState().doc.clips[audio]!.trackId).toBe("a1");
  });
});

describe("commands, ids, gestures, framing", () => {
  it("dispatches through typed builders and makes unique ids", () => {
    const project = setup();
    const commands = createCommands(project);
    commands.setClipProperty("b", { volume: 0.5 });
    expect((project.getState().doc.clips["b"] as { volume: number }).volume).toBe(0.5);
    const ids = new Set(Array.from({ length: 100 }, () => newId("clip")));
    expect(ids.size).toBe(100);
    expect([...ids][0]).toMatch(/^clip-/);
  });

  it("records a live gesture as one history entry", () => {
    const project = setup();
    const commands = createCommands(project);
    const gesture = beginGesture(project, "drag");
    for (const x of [0.1, 0.2, 0.3]) gesture.update(() => commands.setClipProperty("b", { transform: { x } }));
    gesture.end();
    expect(project.getState().doc.clips["b"]!.transform.x).toBe(0.3);
    project.undo();
    expect(project.getState().doc.clips["b"]!.transform.x).not.toBe(0.1);
    expect(project.canUndo()).toBe(false);
  });

  it("keeps filled clips filled across an aspect change", () => {
    const project = setup();
    const { doc } = project.getState();
    expect(presetFor(doc.settings)?.id).toBe("16:9");
    const fill = fillScale(doc.assets["vid"], doc.settings)!;
    project.dispatch({ type: "clip/set-property", payload: { clipId: "b", transform: { scale: fill } } });
    const pairs = refillForAspect(project.getState().doc, { width: 1080, height: 1920 });
    expect(pairs).toEqual([["b", 1]]);
  });
});
