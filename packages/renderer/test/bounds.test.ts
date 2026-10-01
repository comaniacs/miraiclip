import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { Compositor } from "../src/compositor/compositor.js";
import { FakeBackend, type FakeNode } from "./scene-fakes.js";

/** 1000×500 composition; two text clips on two tracks (t2 above t1), 0..2s. */
function setup() {
  const project = createProject({ width: 1000, height: 500, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
  project.dispatch({ type: "track/add", payload: { id: "t2", kind: "video" } });
  const text = (id: string, trackId: string, transform: Record<string, number>) =>
    project.dispatch({
      type: "clip/add",
      payload: { kind: "text", id, trackId, startUs: 0, durationUs: 2_000_000, text: id, transform },
    });
  text("a", "t1", { x: 0.5, y: 0.5 });
  text("b", "t2", { x: 0.6, y: 0.5 });
  const backend = new FakeBackend();
  const compositor = new Compositor(project, backend);
  const node = (i: number) => backend.nodes[i] as FakeNode;
  return { project, compositor, node };
}

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("clip bounds", () => {
  it("maps local content through the clip's position and scale", () => {
    const { project, compositor } = setup();
    project.dispatch({ type: "clip/set-property", payload: { clipId: "a", transform: { scale: 2 } } });
    const b = compositor.getClipBounds("a", 1_000_000)!;
    expect(b).not.toBeNull();
    close(b.originXPx, 500);
    close(b.originYPx, 250);
    close(b.widthPx, 200); // fake local 100×20, scale 2
    close(b.heightPx, 40);
    close(b.centerXPx, 500);
    close(b.corners[0].xPx, 400);
    close(b.corners[0].yPx, 230);
    close(b.corners[2].xPx, 600);
    close(b.corners[2].yPx, 270);
  });

  it("rotates corners and an off-center content box around the origin", () => {
    const { project, compositor, node } = setup();
    node(0).localBounds = { xPx: 0, yPx: 0, widthPx: 100, heightPx: 20 }; // drawn right/down of the origin
    project.dispatch({ type: "clip/set-property", payload: { clipId: "a", transform: { rotation: 90 } } });
    const b = compositor.getClipBounds("a", 0)!;
    // Center (50, 10) local → rotated 90° → (-10, 50) from the origin.
    close(b.centerXPx, 490);
    close(b.centerYPx, 300);
    close(b.rotationDeg, 90);
    // Top-left stays at the origin; top-right swings down.
    close(b.corners[0].xPx, 500);
    close(b.corners[0].yPx, 250);
    close(b.corners[1].xPx, 500);
    close(b.corners[1].yPx, 350);
  });

  it("evaluates keyframed transforms at the requested time", () => {
    const { project, compositor } = setup();
    project.dispatch({ type: "keyframe/set", payload: { clipId: "a", property: "x", timeUs: 0, value: 0.2 } });
    project.dispatch({ type: "keyframe/set", payload: { clipId: "a", property: "x", timeUs: 2_000_000, value: 0.8 } });
    close(compositor.getClipBounds("a", 0)!.originXPx, 200);
    close(compositor.getClipBounds("a", 1_000_000)!.originXPx, 500);
  });

  it("is null off screen or before anything is drawn", () => {
    const { compositor, node } = setup();
    expect(compositor.getClipBounds("a", 3_000_000)).toBeNull(); // after the clip
    expect(compositor.getClipBounds("missing", 0)).toBeNull();
    node(0).localBounds = null; // texture still loading
    expect(compositor.getClipBounds("a", 0)).toBeNull();
  });

  it("defaults to the last rendered time", () => {
    const { compositor } = setup();
    compositor.renderAt(2_500_000);
    expect(compositor.getClipBounds("a")).toBeNull();
    compositor.renderAt(500_000);
    expect(compositor.getClipBounds("a")).not.toBeNull();
  });
});

describe("hit testing", () => {
  it("returns the topmost clip under the point", () => {
    const { compositor } = setup();
    // a spans x 450..550, b spans 550..650 (both y 240..260); they touch at 550.
    expect(compositor.hitTest(480, 250, 0)).toBe("a");
    expect(compositor.hitTest(600, 250, 0)).toBe("b");
    expect(compositor.hitTest(550, 250, 0)).toBe("b"); // shared edge: upper track wins
    expect(compositor.hitTest(480, 300, 0)).toBeNull();
  });

  it("follows rotation (the unrotated box's corner area misses)", () => {
    const { project, compositor } = setup();
    project.dispatch({ type: "clip/set-property", payload: { clipId: "a", transform: { rotation: 90 } } });
    // Rotated 90°, a is a 20×100 column at x 490..510, y 200..300.
    expect(compositor.hitTest(500, 210, 0)).toBe("a");
    expect(compositor.hitTest(460, 250, 0)).toBeNull();
  });

  it("honors the filter and skips invisible clips", () => {
    const { project, compositor } = setup();
    expect(compositor.hitTest(600, 250, 0, (clip) => clip.id !== "b")).toBeNull();
    project.dispatch({ type: "clip/set-property", payload: { clipId: "b", transform: { opacity: 0 } } });
    expect(compositor.hitTest(600, 250, 0)).toBeNull();
    expect(compositor.hitTest(600, 250, 3_000_000)).toBeNull(); // nothing on screen
  });
});
