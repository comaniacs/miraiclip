import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { Compositor } from "../src/compositor/compositor.js";
import { MediaManager } from "../src/media/media-manager.js";
import { createVideoSupport, toMediaUs } from "../src/video/video-support.js";
import { FakeDemuxer, createFakeDecoder } from "./fakes.js";
import { FakeBackend, FakeVideoNode } from "./scene-fakes.js";

const FRAME_US = FakeDemuxer.FRAME_US;

function setup(clip?: { startUs?: number; trimStartUs?: number }) {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.dispatch({
    type: "asset/add",
    payload: { id: "vid", kind: "video", src: "/movie.mp4", durationUs: 10_000_000 },
  });
  project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "video",
      id: "c1",
      trackId: "v1",
      assetId: "vid",
      startUs: clip?.startUs ?? 0,
      durationUs: 5_000_000,
      trimStartUs: clip?.trimStartUs ?? 0,
    },
  });
  const manager = new MediaManager({
    openDemuxer: async () => new FakeDemuxer(300, 30),
    createDecoder: createFakeDecoder,
  });
  const videos = createVideoSupport(project, manager);
  const backend = new FakeBackend();
  const compositor = new Compositor(project, backend, {
    factories: { video: videos.factory },
  });
  const node = backend.nodes.find((n): n is FakeVideoNode => n instanceof FakeVideoNode)!;
  return { project, manager, videos, backend, compositor, node };
}

describe("video in the compositor", () => {
  it("renderFrameAt shows the exact frame for a timeline position", async () => {
    const { videos, compositor, node } = setup();
    const t = 45 * FRAME_US;
    await videos.renderFrameAt(compositor, t);
    const frame = node.lastFrame as { timestampUs: number };
    expect(frame).not.toBeNull();
    expect(frame.timestampUs).toBe(t);
  });

  it("maps timeline time through clip start and source trim", async () => {
    const { videos, compositor, node, project } = setup({
      startUs: 1_000_000,
      trimStartUs: 2_000_000,
    });
    const clip = project.getState().doc.clips["c1"]!;
    const t = 1_500_000; // 500ms into the clip → media 2.5s
    expect(toMediaUs(clip as never, t)).toBe(2_500_000);
    await videos.renderFrameAt(compositor, t);
    const frame = node.lastFrame as { timestampUs: number };
    const expected = Math.floor(2_500_000 / FRAME_US) * FRAME_US;
    expect(frame.timestampUs).toBe(expected);
  });

  it("clears the frame and hides the node outside the clip window", async () => {
    const { videos, compositor, node } = setup({ startUs: 1_000_000 });
    await videos.renderFrameAt(compositor, 1_500_000);
    expect(node.lastFrame).not.toBeNull();
    compositor.renderAt(200_000); // before the clip starts
    expect(node.visible).toBe(false);
  });

  it("shares one pipeline across two clips of the same asset", async () => {
    const { project, videos, compositor, manager } = setup();
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "video",
        id: "c2",
        trackId: "v1",
        assetId: "vid",
        startUs: 6_000_000,
        durationUs: 2_000_000,
        trimStartUs: 0,
      },
    });
    await videos.renderFrameAt(compositor, 100_000);
    expect(manager.activeCount).toBe(1);
  });

  it("prepare primes only clips near the playhead", async () => {
    const { project, videos, manager } = setup(); // c1: 0..5s
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "video",
        id: "far",
        trackId: "v1",
        assetId: "vid",
        startUs: 8_000_000, // far in the future
        durationUs: 1_000_000,
        trimStartUs: 0,
      },
    });
    await videos.prepare(100_000);
    const pipeline = await manager.acquire("vid", "/movie.mp4");
    // Primed around t=100ms media time — the frame there is cached.
    expect(pipeline.frameAt(100_000)).toBeDefined();
    // The lookahead gate skipped the far clip: nothing was decoded near 8s —
    // frameAt falls back to the nearest earlier frame within the ahead window.
    expect(pipeline.frameAt(8_000_000)?.timestampUs).toBeLessThan(3_000_000);
  });

  it("dispose releases the media manager", async () => {
    const { videos, manager, compositor } = setup();
    await videos.renderFrameAt(compositor, 0);
    videos.dispose();
    expect(() => manager.isActive("vid")).not.toThrow();
    await expect(manager.acquire("x", "/x.mp4")).rejects.toThrow(/disposed/);
  });
});
