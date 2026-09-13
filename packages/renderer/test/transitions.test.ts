import { describe, expect, it } from "vitest";
import { createProject, isVideoClip, type Project } from "@miraiclip/core";
import { Compositor } from "../src/compositor/compositor.js";
import { MediaManager } from "../src/media/media-manager.js";
import { gainFor, volumeAutomation } from "../src/audio/mapping.js";
import {
  progressIn,
  renderExtension,
  rendersBothClips,
  transitionGainAt,
  transitionRampTimes,
  transitionsForClip,
  windowOf,
} from "../src/transitions/timing.js";
import { createVideoSupport } from "../src/video/video-support.js";
import { FakeDemuxer, createFakeDecoder } from "./fakes.js";
import { FakeBackend } from "./scene-fakes.js";

const SEC = 1_000_000;

/** Two adjacent 2s video clips of one 10s asset; B trimmed to 2.5s for in-headroom. */
function videoProject(): Project {
  const project = createProject({ width: 1000, height: 500, fps: 30 });
  project.transaction(() => {
    project.dispatch({
      type: "asset/add",
      payload: { id: "media", kind: "video", src: "/m.mp4", durationUs: 10 * SEC },
    });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "a", trackId: "v1", assetId: "media", startUs: 0, durationUs: 2 * SEC },
    });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "b", trackId: "v1", assetId: "media", startUs: 2 * SEC, durationUs: 2 * SEC, trimStartUs: 2_500_000 },
    });
  });
  return project;
}

function addTransition(project: Project, kind: string, params?: Record<string, unknown>): void {
  project.dispatch({
    type: "transition/add",
    payload: { id: "t1", kind, fromClipId: "a", toClipId: "b", durationUs: SEC, ...(params ? { params } : {}) },
  });
}

/** Adjacent IMAGE clips — no video pipeline needed, pure compositor tests. */
function imageProject(): Project {
  const project = createProject({ width: 1000, height: 500, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "img", kind: "image", src: "/a.png" } });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "image", id: "a", trackId: "v1", assetId: "img", startUs: 0, durationUs: 2 * SEC },
    });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "image", id: "b", trackId: "v1", assetId: "img", startUs: 2 * SEC, durationUs: 2 * SEC },
    });
  });
  return project;
}

// ---------------------------------------------------------------------------
// Timing math
// ---------------------------------------------------------------------------

describe("transition timing", () => {
  it("centers the window on the cut", () => {
    const project = videoProject();
    addTransition(project, "crossDissolve");
    const doc = project.getState().doc;
    const window = windowOf(doc.transitions["t1"]!, doc)!;
    expect(window.cutUs).toBe(2 * SEC);
    expect(window.startUs).toBe(1_500_000);
    expect(window.endUs).toBe(2_500_000);
    expect(progressIn(window, 1_000_000)).toBe(0);
    expect(progressIn(window, 1_750_000)).toBe(0.25);
    expect(progressIn(window, 2 * SEC)).toBe(0.5);
    expect(progressIn(window, 3 * SEC)).toBe(1);
  });

  it("reports roles per clip", () => {
    const project = videoProject();
    addTransition(project, "wipe", { direction: "right" });
    const doc = project.getState().doc;
    expect(transitionsForClip(doc, "a").map((t) => t.role)).toEqual(["from"]);
    expect(transitionsForClip(doc, "b").map((t) => t.role)).toEqual(["to"]);
    expect(transitionsForClip(doc, "nope")).toEqual([]);
  });

  it("extends rendering into headroom for blend kinds only", () => {
    const project = videoProject();
    addTransition(project, "crossDissolve");
    const doc = project.getState().doc;
    const [a, b] = [doc.clips["a"]!, doc.clips["b"]!];
    expect(renderExtension(doc, a)).toEqual({ beforeUs: 0, afterUs: 500_000 });
    expect(renderExtension(doc, b)).toEqual({ beforeUs: 500_000, afterUs: 0 });
    expect(rendersBothClips("dipToBlack")).toBe(false);
    expect(rendersBothClips("dipToWhite")).toBe(false);

    project.dispatch({ type: "transition/remove", payload: { transitionId: "t1" } });
    addTransition(project, "dipToBlack");
    const doc2 = project.getState().doc;
    expect(renderExtension(doc2, doc2.clips["a"]!)).toEqual({ beforeUs: 0, afterUs: 0 });
    expect(renderExtension(doc2, doc2.clips["b"]!)).toEqual({ beforeUs: 0, afterUs: 0 });
  });

  it("crossfades with equal-power ramps inside each clip's own bounds", () => {
    const project = videoProject();
    addTransition(project, "crossDissolve");
    const doc = project.getState().doc;
    // Outgoing: 1 at the window start, cos-ramp to 0 at the cut.
    expect(transitionGainAt(doc, "a", 1_000_000)).toBe(1);
    expect(transitionGainAt(doc, "a", 1_750_000)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(transitionGainAt(doc, "a", 2 * SEC)).toBe(0);
    // Incoming: 0 at the cut, sin-ramp to 1 at the window end.
    expect(transitionGainAt(doc, "b", 2 * SEC)).toBe(0);
    expect(transitionGainAt(doc, "b", 2_250_000)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(transitionGainAt(doc, "b", 2_500_000)).toBe(1);
    expect(transitionGainAt(doc, "b", 3 * SEC)).toBe(1);
  });

  it("samples ramp times strictly inside the requested range", () => {
    const project = videoProject();
    addTransition(project, "crossDissolve");
    const doc = project.getState().doc;
    // From-clip ramp runs 1.5s → 2.0s: boundary + quarter points.
    expect(transitionRampTimes(doc, "a", 0, 4 * SEC)).toEqual([
      1_500_000, 1_625_000, 1_750_000, 1_875_000, 2_000_000,
    ]);
    // Range endpoints are exclusive — a window starting AT fromUs adds no dup.
    expect(transitionRampTimes(doc, "a", 1_500_000, 1_800_000)).toEqual([1_625_000, 1_750_000]);
    expect(transitionRampTimes(doc, "a", 3 * SEC, 4 * SEC)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Audio integration
// ---------------------------------------------------------------------------

describe("transition audio", () => {
  it("gainFor includes the crossfade gain", () => {
    const project = videoProject();
    addTransition(project, "crossDissolve");
    const doc = project.getState().doc;
    const a = doc.clips["a"]!;
    if (!isVideoClip(a)) throw new Error("expected video clip");
    expect(gainFor(a, doc, 1_000_000)).toBe(1);
    expect(gainFor(a, doc, 1_750_000)).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("volumeAutomation emits crossfade ramp points without any keyframes", () => {
    const project = videoProject();
    addTransition(project, "dipToBlack"); // audio crossfades on EVERY kind
    const doc = project.getState().doc;
    const b = doc.clips["b"]!;
    if (!isVideoClip(b)) throw new Error("expected video clip");
    const points = volumeAutomation(b, doc, 2 * SEC, 4 * SEC)!;
    expect(points).not.toBeNull();
    expect(points.map((p) => p.atTimelineUs)).toEqual([
      2_000_000, 2_125_000, 2_250_000, 2_375_000, 2_500_000, 4_000_000,
    ]);
    expect(points[0]!.value).toBe(0); // silent at the cut
    expect(points[2]!.value).toBeCloseTo(Math.SQRT1_2, 6);
    expect(points.at(-1)!.value).toBe(1);
  });

  it("volumeAutomation stays null for clips with no keyframes and no transitions", () => {
    const project = videoProject();
    const doc = project.getState().doc;
    const a = doc.clips["a"]!;
    if (!isVideoClip(a)) throw new Error("expected video clip");
    expect(volumeAutomation(a, doc, 0, 2 * SEC)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Media: dedicated pipelines per participating clip
// ---------------------------------------------------------------------------

describe("transition media pipelines", () => {
  function managed() {
    return new MediaManager({
      openDemuxer: async () => new FakeDemuxer(300, 30),
      createDecoder: createFakeDecoder,
    });
  }

  it("lane-scoped acquire creates separate pipelines for one asset", async () => {
    const manager = managed();
    const [shared1, shared2] = await Promise.all([
      manager.acquire("m", "/m.mp4"),
      manager.acquire("m", "/m.mp4"),
    ]);
    expect(shared2).toBe(shared1);
    const laneA = await manager.acquire("m", "/m.mp4", "a");
    const laneB = await manager.acquire("m", "/m.mp4", "b");
    expect(laneA).not.toBe(shared1);
    expect(laneB).not.toBe(shared1);
    expect(laneA).not.toBe(laneB);
    expect(manager.activeCount).toBe(3);
    manager.dispose();
  });

  it("clips in a transition upgrade to dedicated pipelines", async () => {
    const project = videoProject();
    addTransition(project, "crossDissolve");
    const manager = managed();
    const videos = createVideoSupport(project, manager);
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend, { factories: { video: videos.factory } });
    // Prepare inside the overlap window (cut at 2s, 1s window): both clips
    // are live, so both dedicated lanes exist. Acquisition is lazy — a lane
    // is only opened when its clip nears visibility, never at mount.
    await videos.prepare(2 * SEC);
    // Two clips of ONE asset, both in the transition → two dedicated lanes,
    // and no shared per-asset pipeline was ever created.
    expect(manager.activeCount).toBe(2);
    expect(manager.isActive("media")).toBe(false);
    compositor.destroy();
    videos.dispose();
  });

  it("clips without transitions share the per-asset pipeline", async () => {
    const project = videoProject();
    const manager = managed();
    const videos = createVideoSupport(project, manager);
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend, { factories: { video: videos.factory } });
    await videos.prepare(0);
    expect(manager.activeCount).toBe(1);
    expect(manager.isActive("media")).toBe(true);
    compositor.destroy();
    videos.dispose();
  });
});

// ---------------------------------------------------------------------------
// Compositor blending
// ---------------------------------------------------------------------------

describe("transition rendering", () => {
  function setup(kind: string, params?: Record<string, unknown>) {
    const project = imageProject();
    project.dispatch({
      type: "transition/add",
      payload: { id: "t1", kind, fromClipId: "a", toClipId: "b", durationUs: SEC, ...(params ? { params } : {}) },
    });
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend);
    const a = backend.nodes[0]!;
    const b = backend.nodes[1]!;
    return { project, backend, compositor, a, b };
  }

  it("cross dissolve: both clips render through the window, incoming at alpha p", () => {
    const { compositor, a, b } = setup("crossDissolve");
    compositor.renderAt(1_000_000); // before the window
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(false);

    compositor.renderAt(1_750_000); // p = 0.25 — B visible EARLY (headroom)
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(true);
    expect(a.placement!.opacity).toBe(1);
    expect(b.placement!.opacity).toBeCloseTo(0.25, 6);

    compositor.renderAt(2_250_000); // p = 0.75 — A visible PAST its end
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(true);
    expect(b.placement!.opacity).toBeCloseTo(0.75, 6);

    compositor.renderAt(2_600_000); // after the window
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(true);
    expect(b.placement!.opacity).toBe(1);
  });

  it("incoming clip stacks above the outgoing one (same track)", () => {
    const { a, b } = setup("crossDissolve");
    expect(b.z).toBeGreaterThan(a.z);
  });

  it("wipe: reveals the incoming clip in the transition's direction", () => {
    const { compositor, a, b } = setup("wipe", { direction: "right" });
    compositor.renderAt(1_750_000); // p = 0.25
    expect(b.visible).toBe(true);
    expect(b.reveal).toEqual({ fraction: 0.25, direction: "right" });
    expect(a.reveal).toEqual({ fraction: 1, direction: "left" }); // outgoing unmasked
    compositor.renderAt(3 * SEC); // window over — mask cleared
    expect(b.reveal).toEqual({ fraction: 1, direction: "left" });
  });

  it("slide: offsets the incoming clip by the remaining distance", () => {
    const { compositor, b } = setup("slide", { direction: "left" });
    compositor.renderAt(1_750_000); // p = 0.25 → 75% of the 1000px width left to travel
    expect(b.placement!.xPx).toBeCloseTo(500 + 750, 6); // base center 0.5×1000 + offset
    expect(b.placement!.opacity).toBe(1);
    compositor.renderAt(2_500_000); // p = 1 (window end is exclusive → next render)
    expect(b.placement!.xPx).toBe(500);
  });

  it("dips: an overlay covers the hard cut, opaque exactly at the cut", () => {
    const { backend, compositor, a, b } = setup("dipToBlack");
    compositor.renderAt(1_000_000);
    expect(backend.solids.length).toBe(0); // lazy — nothing until a dip is live

    compositor.renderAt(1_750_000); // p = 0.25 → alpha 0.5
    const overlay = backend.solids[0]!;
    expect(overlay.visible).toBe(true);
    expect(overlay.colorRgb).toBe(0x000000);
    expect(overlay.alpha).toBeCloseTo(0.5, 6);
    // No extended visibility for dips — the overlay hides the swap instead.
    expect(b.visible).toBe(false);

    compositor.renderAt(2 * SEC); // the cut: fully opaque, clips swap beneath
    expect(overlay.alpha).toBe(1);
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(true);

    compositor.renderAt(3 * SEC);
    expect(overlay.visible).toBe(false);
  });

  it("dip to white draws white", () => {
    const { backend, compositor } = setup("dipToWhite");
    compositor.renderAt(2 * SEC);
    expect(backend.solids[0]!.colorRgb).toBe(0xffffff);
  });

  it("removing the transition mid-window resets placement and reveal", () => {
    const { project, compositor, b } = setup("slide", { direction: "left" });
    compositor.renderAt(1_750_000);
    expect(b.placement!.xPx).toBeCloseTo(1250, 6);
    project.dispatch({ type: "transition/remove", payload: { transitionId: "t1" } });
    expect(b.placement!.xPx).toBe(500); // re-synced to the base transform
    expect(b.reveal).toEqual({ fraction: 1, direction: "left" });
    expect(b.visible).toBe(false); // 1.75s is before clip b — no extension left
  });

  it("keyframe animation composes with the dissolve", () => {
    const { project, compositor, b } = setup("crossDissolve");
    // B fades 0.8 → 0.8 (flat) so evaluated opacity is 0.8 through the window.
    project.dispatch({ type: "keyframe/set", payload: { clipId: "b", property: "opacity", timeUs: 0, value: 0.8 } });
    compositor.renderAt(2_250_000); // p = 0.75
    expect(b.placement!.opacity).toBeCloseTo(0.8 * 0.75, 6);
  });
});
