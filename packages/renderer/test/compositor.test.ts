import { describe, expect, it } from "vitest";
import { createProject, type Asset, type Clip, type ImageClip, type TextClip } from "@miraiclip/core";
import { Compositor } from "../src/compositor/compositor.js";
import { zIndexFor } from "../src/compositor/placement.js";
import type { Placement, SceneBackend, SceneNode } from "../src/compositor/types.js";

import { FakeBackend, FakeNode } from "./scene-fakes.js";

function setup() {
  const project = createProject({ width: 1920, height: 1080, fps: 30 });
  project.dispatch({
    type: "asset/add",
    payload: { id: "img", kind: "image", src: "/logo.png" },
  });
  project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
  project.dispatch({ type: "track/add", payload: { id: "v2", kind: "video" } });
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "image",
      id: "c-img",
      trackId: "v1",
      assetId: "img",
      startUs: 0,
      durationUs: 2_000_000,
    },
  });
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "text",
      id: "c-text",
      trackId: "v2",
      startUs: 1_000_000,
      durationUs: 2_000_000,
      text: "Hello",
    },
  });
  const backend = new FakeBackend();
  const compositor = new Compositor(project, backend);
  return { project, backend, compositor };
}

describe("Compositor", () => {
  it("builds the scene from the document and sizes the backend", () => {
    const { backend, compositor } = setup();
    expect(backend.size).toEqual({ width: 1920, height: 1080 });
    expect(compositor.nodeCount).toBe(2);
    expect(backend.nodes.map((n) => n.kind).sort()).toEqual(["image", "text"]);
    expect(backend.nodes.find((n) => n.kind === "image")?.asset?.src).toBe("/logo.png");
  });

  it("computes pixel placement from normalized transforms", () => {
    const { backend } = setup();
    const image = backend.nodes.find((n) => n.kind === "image")!;
    expect(image.placement).toMatchObject({ xPx: 960, yPx: 540, scale: 1, opacity: 1 });
  });

  it("toggles visibility as a pure function of time", () => {
    const { backend, compositor } = setup();
    const image = backend.nodes.find((n) => n.kind === "image")!;
    const text = backend.nodes.find((n) => n.kind === "text")!;
    compositor.renderAt(500_000);
    expect(image.visible).toBe(true);
    expect(text.visible).toBe(false);
    compositor.renderAt(1_500_000);
    expect(image.visible).toBe(true);
    expect(text.visible).toBe(true);
    compositor.renderAt(2_500_000);
    expect(image.visible).toBe(false);
    expect(text.visible).toBe(true);
  });

  it("applies command patches granularly, including during undo", () => {
    const { project, backend } = setup();
    const image = backend.nodes.find((n) => n.kind === "image")!;
    project.dispatch({
      type: "clip/set-property",
      payload: { clipId: "c-img", transform: { x: 0.25, opacity: 0.5 } },
    });
    expect(image.placement).toMatchObject({ xPx: 480, opacity: 0.5 });
    project.undo();
    expect(image.placement).toMatchObject({ xPx: 960, opacity: 1 });
  });

  it("creates and destroys nodes as clips come and go", () => {
    const { project, backend, compositor } = setup();
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "text",
        id: "c2",
        trackId: "v2",
        startUs: 0,
        durationUs: 1_000_000,
        text: "Bye",
      },
    });
    expect(compositor.nodeCount).toBe(3);
    project.dispatch({ type: "clip/remove", payload: { clipId: "c2" } });
    expect(compositor.nodeCount).toBe(2);
    expect(backend.nodes.filter((n) => n.destroyed)).toHaveLength(1);
  });

  it("re-stacks on track reorder", () => {
    const { project, backend } = setup();
    const image = backend.nodes.find((n) => n.kind === "image")!;
    const text = backend.nodes.find((n) => n.kind === "text")!;
    expect(image.z).toBe(zIndexFor(0, 0));
    expect(text.z).toBe(zIndexFor(1, 0));
    project.dispatch({ type: "track/reorder", payload: { trackId: "v2", index: 0 } });
    expect(text.z).toBe(zIndexFor(0, 0));
    expect(image.z).toBe(zIndexFor(1, 0));
  });

  it("resizes and recomputes placement when settings change", () => {
    const { project, backend } = setup();
    project.dispatch({ type: "project/set-settings", payload: { width: 1280, height: 720 } });
    expect(backend.size).toEqual({ width: 1280, height: 720 });
    const image = backend.nodes.find((n) => n.kind === "image")!;
    expect(image.placement).toMatchObject({ xPx: 640, yPx: 360 });
  });

  it("routes custom clip kinds through registered factories", () => {
    const project = createProject({ width: 100, height: 100, fps: 30 });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    const backend = new FakeBackend();
    const custom = new FakeNode("custom");
    const compositor = new Compositor(project, backend, {
      factories: { text: () => custom },
    });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "text",
        id: "x",
        trackId: "v1",
        startUs: 0,
        durationUs: 1,
        text: "custom-rendered",
      },
    });
    expect(compositor.nodeCount).toBe(1);
    expect(custom.updates.at(-1)).toMatchObject({ text: "custom-rendered" });
  });

  it("destroy tears down nodes, backend, and the subscription", () => {
    const { project, backend, compositor } = setup();
    compositor.destroy();
    expect(backend.destroyed).toBe(true);
    expect(backend.nodes.every((n) => n.destroyed)).toBe(true);
    const rendersAfter = backend.renders;
    project.dispatch({ type: "clip/move", payload: { clipId: "c-img", startUs: 5 } });
    expect(backend.renders).toBe(rendersAfter); // unsubscribed
  });
});

describe("keyframe animation application", () => {
  function animatedSetup() {
    const project = createProject({ width: 1000, height: 500, fps: 30 });
    project.transaction(() => {
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({
        type: "clip/add",
        payload: { kind: "text", id: "t", trackId: "v1", startUs: 1_000_000, durationUs: 4_000_000, text: "hi" },
      });
    });
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend);
    return { project, backend, compositor };
  }

  it("an animated clip is re-placed from evaluated keyframes every render", () => {
    const { project, backend, compositor } = animatedSetup();
    // Clip-relative keyframes: opacity 0→1 and x 0→1 over 2s.
    project.dispatch({ type: "keyframe/set", payload: { clipId: "t", property: "opacity", timeUs: 0, value: 0 } });
    project.dispatch({ type: "keyframe/set", payload: { clipId: "t", property: "opacity", timeUs: 2_000_000, value: 1 } });
    project.dispatch({ type: "keyframe/set", payload: { clipId: "t", property: "x", timeUs: 0, value: 0 } });
    project.dispatch({ type: "keyframe/set", payload: { clipId: "t", property: "x", timeUs: 2_000_000, value: 1 } });

    compositor.renderAt(2_000_000); // clip time 1s = halfway
    const node = backend.nodes.find((n) => n.id?.includes("t") || true)!;
    expect(node.placement!.opacity).toBeCloseTo(0.5, 6);
    expect(node.placement!.xPx).toBeCloseTo(500, 3); // 0.5 × 1000px

    compositor.renderAt(3_000_000); // clip time 2s = end of ramp
    expect(node.placement!.opacity).toBeCloseTo(1, 6);
    expect(node.placement!.xPx).toBeCloseTo(1000, 3);

    // Before the first keyframe the first value holds.
    compositor.renderAt(1_000_000);
    expect(node.placement!.opacity).toBeCloseTo(0, 6);
  });

  it("unanimated properties keep the clip's static transform", () => {
    const { project, backend, compositor } = animatedSetup();
    project.dispatch({ type: "clip/set-property", payload: { clipId: "t", transform: { y: 0.8, scale: 2 } } });
    project.dispatch({ type: "keyframe/set", payload: { clipId: "t", property: "opacity", timeUs: 0, value: 0.25 } });
    compositor.renderAt(1_500_000);
    const node = backend.nodes[0]!;
    expect(node.placement!.opacity).toBeCloseTo(0.25, 6);
    expect(node.placement!.yPx).toBeCloseTo(0.8 * 500, 3); // static y survives
    expect(node.placement!.scale).toBe(2);
  });
});
