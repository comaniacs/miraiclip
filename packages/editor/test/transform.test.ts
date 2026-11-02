import { describe, expect, it } from "vitest";
import { createProject, type Project } from "@miraiclip/core";
import {
  beginTransformDrag,
  canTransformClip,
  clipsByTrack,
  cornerCursor,
  nudgeClip,
  rotateHandlePosition,
  snapOffset,
  trackCuts,
  transitionsByTrack,
  writeClipTransform,
  type TransformBounds,
} from "../src/index.js";

const S = 1_000_000;

function setup(): Project {
  const project = createProject({ width: 1000, height: 500, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "track/add", payload: { id: "v2", kind: "video" } });
    project.dispatch({ type: "track/add", payload: { id: "a1", kind: "audio" } });
    project.dispatch({ type: "asset/add", payload: { id: "snd", kind: "audio", src: "/a.mp3", durationUs: 3 * S } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "t", trackId: "v1", startUs: 0, durationUs: 2 * S, text: "a" } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "u", trackId: "v1", startUs: 2 * S, durationUs: 2 * S, text: "b" } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "w", trackId: "v1", startUs: 5 * S, durationUs: 1 * S, text: "c" } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "l", trackId: "v2", startUs: 0, durationUs: 1 * S, text: "l" } });
    project.dispatch({ type: "clip/add", payload: { kind: "audio", id: "s", trackId: "a1", assetId: "snd", startUs: 0, durationUs: 1 * S } });
  });
  project.dispatch({ type: "track/set-property", payload: { trackId: "v2", locked: true } });
  project.clearHistory();
  return project;
}

/** A 200×100 box centered at (500, 250): the middle of the frame. */
function boundsOf(clipId: string, cx = 500, cy = 250): TransformBounds {
  return {
    clipId,
    originXPx: cx,
    originYPx: cy,
    centerXPx: cx,
    centerYPx: cy,
    scale: 1,
    rotationDeg: 0,
    corners: [
      { xPx: cx - 100, yPx: cy - 50 },
      { xPx: cx + 100, yPx: cy - 50 },
      { xPx: cx + 100, yPx: cy + 50 },
      { xPx: cx - 100, yPx: cy + 50 },
    ],
  };
}

const transformOf = (project: Project, id: string) => project.getState().doc.clips[id]!.transform;

describe("transform drags", () => {
  it("moves a clip as one undo step and snaps to the frame", () => {
    const project = setup();
    const drag = beginTransformDrag(project, boundsOf("t"), "move", { x: 500, y: 250 }, { snapThresholdPx: 6 });
    expect(drag).not.toBeNull();
    drag!.update({ x: 600, y: 250 }); // center 600: no frame line within 6px (edges at 500/700)
    expect(transformOf(project, "t").x).toBe(0.6);
    const guides = drag!.update({ x: 603, y: 253 }); // right edge 703 / center y 253 → snap y to 250
    expect(guides.y).toEqual([250]);
    expect(transformOf(project, "t").y).toBe(0.5);
    const free = drag!.update({ x: 503, y: 253 }, { altKey: true });
    expect(free).toEqual({ x: [], y: [] });
    expect(transformOf(project, "t").x).toBe(0.503);
    drag!.end();
    project.undo();
    expect(transformOf(project, "t").x).toBe(0.5);
    expect(project.canUndo()).toBe(false);
  });

  it("ignores movement under the drag threshold", () => {
    const project = setup();
    const drag = beginTransformDrag(project, boundsOf("t"), "move", { x: 500, y: 250 }, { dragThresholdPx: 3 });
    drag!.update({ x: 501, y: 251 });
    expect(drag!.moved).toBe(false);
    expect(project.canUndo()).toBe(false);
  });

  it("scales around the origin and rotates with 15° steps on Shift", () => {
    const project = setup();
    const scale = beginTransformDrag(project, boundsOf("t"), "scale", { x: 600, y: 250 })!;
    scale.update({ x: 700, y: 250 });
    expect(transformOf(project, "t").scale).toBe(2);
    scale.end();

    const rotate = beginTransformDrag(project, boundsOf("t"), "rotate", { x: 600, y: 250 })!;
    rotate.update({ x: 600, y: 260 }, { shiftKey: true }); // ~5.7° → 0 in 15° steps
    expect(transformOf(project, "t").rotation).toBe(0);
    rotate.update({ x: 500, y: 350 }); // 90°
    expect(transformOf(project, "t").rotation).toBe(90);
    rotate.end();
  });

  it("refuses locked tracks and audio, and keyframes animated properties", () => {
    const project = setup();
    expect(beginTransformDrag(project, boundsOf("l"), "move", { x: 0, y: 0 })).toBeNull();
    expect(canTransformClip(project, "s")).toBe(false);
    expect(nudgeClip(project, boundsOf("l"), 1, 0)).toBe(false);

    project.dispatch({ type: "keyframe/set", payload: { clipId: "t", property: "x", timeUs: 0, value: 0.2 } });
    project.setPlayhead(1 * S);
    writeClipTransform(project, "t", { x: 0.7, y: 0.4 });
    const clip = project.getState().doc.clips["t"]!;
    expect(clip.animations?.x?.find((k) => k.timeUs === 1 * S)?.value).toBe(0.7);
    expect(clip.transform.y).toBe(0.4);
  });

  it("nudges by composition pixels", () => {
    const project = setup();
    expect(nudgeClip(project, boundsOf("t"), 10, -5)).toBe(true);
    expect(transformOf(project, "t")).toMatchObject({ x: 0.51, y: 0.49 });
  });
});

describe("stretch drags (side handles)", () => {
  it("stretches only the dragged axis, pivoting at the origin, as one undo step", () => {
    const project = setup();
    // Right-edge handle at x=600 (100px right of the origin at 500).
    const drag = beginTransformDrag(project, boundsOf("t"), "stretch-x", { x: 600, y: 250 });
    drag!.update({ x: 700, y: 250 }); // 100 → 200 from the origin: ×2
    expect(transformOf(project, "t").scaleX).toBe(2);
    expect(transformOf(project, "t").scaleY).toBeUndefined();
    expect(transformOf(project, "t").scale).toBe(1);
    drag!.update({ x: 800, y: 250 });
    drag!.end();
    expect(transformOf(project, "t").scaleX).toBe(3);
    project.undo();
    expect(transformOf(project, "t").scaleX).toBeUndefined();
    expect(project.canUndo()).toBe(false);
  });

  it("stretch-y follows the vertical axis", () => {
    const project = setup();
    const drag = beginTransformDrag(project, boundsOf("t"), "stretch-y", { x: 500, y: 300 });
    drag!.update({ x: 500, y: 400 }); // 50 → 150: ×3
    drag!.end();
    expect(transformOf(project, "t").scaleY).toBe(3);
    expect(transformOf(project, "t").scaleX).toBeUndefined();
  });

  it("follows the clip's rotation: a 90° clip's own x axis points down the screen", () => {
    const project = setup();
    const rotated = { ...boundsOf("t"), rotationDeg: 90 };
    const drag = beginTransformDrag(project, rotated, "stretch-x", { x: 500, y: 350 });
    drag!.update({ x: 500, y: 450 }); // 100 → 200 along screen-down: ×2
    drag!.end();
    expect(transformOf(project, "t").scaleX).toBe(2);
  });

  it("never flips through the origin, and keeps a mirrored clip mirrored", () => {
    const project = setup();
    const drag = beginTransformDrag(project, boundsOf("t"), "stretch-x", { x: 600, y: 250 });
    drag!.update({ x: 300, y: 250 }); // dragged past the origin: clamped to the minimum
    expect(transformOf(project, "t").scaleX).toBe(0.05);
    drag!.end();

    const mirrored = { ...boundsOf("t"), scaleX: -1 };
    const again = beginTransformDrag(project, mirrored, "stretch-x", { x: 600, y: 250 });
    again!.update({ x: 700, y: 250 });
    again!.end();
    expect(transformOf(project, "t").scaleX).toBe(-2);
  });
});

describe("transform geometry", () => {
  it("places the rotate handle above the top edge and picks corner cursors", () => {
    const { handle, anchor } = rotateHandlePosition(boundsOf("t"), 26);
    expect(anchor).toEqual({ xPx: 500, yPx: 200 });
    expect(handle.xPx).toBeCloseTo(500);
    expect(handle.yPx).toBeCloseTo(174);
    expect(cornerCursor(0, 0)).toBe("nwse-resize");
    expect(cornerCursor(0, 90)).toBe("nesw-resize");
    expect(snapOffset([97, 140], [100], 5)).toEqual({ delta: 3, target: 100 });
    expect(snapOffset([90], [100], 5)).toBeNull();
  });
});

describe("trackCuts", () => {
  it("finds back-to-back visual clips and their transitions", () => {
    const project = setup();
    project.dispatch({ type: "transition/add", payload: { id: "x", kind: "crossDissolve", fromClipId: "t", toClipId: "u", durationUs: 500_000 } });
    const doc = project.getState().doc;
    const cuts = trackCuts(clipsByTrack(doc.clips).get("v1")!, transitionsByTrack(doc.transitions).get("v1"));
    expect(cuts).toHaveLength(1);
    expect(cuts[0]).toMatchObject({ atUs: 2 * S, transition: { id: "x" } });
    expect(cuts[0]!.from.id).toBe("t");
  });
});
