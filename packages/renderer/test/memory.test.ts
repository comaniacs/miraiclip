/**
 * Memory bounds: what keeps preview memory proportional to what is on screen
 * near the playhead — not to how long the timeline is, how many clips it
 * has, or how many of them share a source file.
 */
import { describe, expect, it } from "vitest";
import { createProject, type Project } from "@miraiclip/core";
import { Compositor } from "../src/compositor/compositor.js";
import { FrameCache } from "../src/media/frame-cache.js";
import { MediaManager } from "../src/media/media-manager.js";
import { assignVideoLanes, createVideoSupport } from "../src/video/video-support.js";
import { FakeDemuxer, createFakeDecoder, fakeFrame, type FakeFrame } from "./fakes.js";
import { VideoPipeline } from "../src/media/video-pipeline.js";
import { FakeBackend } from "./scene-fakes.js";

const SEC = 1_000_000;
const MB = 1024 * 1024;

/**
 * The launch film's montage, generalized: `count` back-to-back cuts of one
 * source, `cutUs` long each, with a transition at every cut.
 */
function montage(count: number, cutUs: number): Project {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "src", kind: "video", src: "/src.mp4", durationUs: 600 * SEC } });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    for (let i = 0; i < count; i++) {
      project.dispatch({
        type: "clip/add",
        payload: {
          kind: "video", id: `c${i}`, trackId: "v1", assetId: "src",
          startUs: i * cutUs, durationUs: cutUs, trimStartUs: (i * 7 * SEC) % (500 * SEC),
        },
      });
    }
    for (let i = 0; i + 1 < count; i++) {
      project.dispatch({
        type: "transition/add",
        payload: { id: `t${i}`, kind: "crossDissolve", fromClipId: `c${i}`, toClipId: `c${i + 1}`, durationUs: cutUs / 2 },
      });
    }
  });
  return project;
}

describe("frame cache history", () => {
  it("keeps at most maxBehindFrames played frames, even with budget to spare", () => {
    const cache = new FrameCache({ maxFrames: 120, maxBytes: 1024 * MB, maxBehindFrames: 4 });
    for (let i = 0; i < 60; i++) cache.put(fakeFrame(i * 33_333, 33_333, MB));
    cache.evict(50 * 33_333); // playhead at frame 50
    // 4 behind + the covering frame + 9 ahead (51..59)
    expect(cache.size).toBe(4 + 1 + 9);
    expect(cache.has(45 * 33_333)).toBe(false); // evicted history
    expect(cache.has(46 * 33_333)).toBe(true); // oldest kept
  });

  it("a lowered byte budget takes effect at the next eviction", () => {
    const cache = new FrameCache({ maxFrames: 120, maxBytes: 100 * MB, maxBehindFrames: 120 });
    for (let i = 0; i < 40; i++) cache.put(fakeFrame(i * 33_333, 33_333, MB));
    cache.setByteBudget(10 * MB);
    cache.evict(0);
    expect(cache.byteSize).toBeLessThanOrEqual(10 * MB);
  });
});

describe("pool-backed frames (live VideoFrames)", () => {
  const poolFrame = (i: number) => ({ ...fakeFrame(i * 33_333, 33_333, MB), poolBacked: true });

  it("holds at most maxPoolFrames decoder buffers, whatever the byte budget", () => {
    const cache = new FrameCache({ maxFrames: 120, maxBytes: 1024 * MB, maxPoolFrames: 6 });
    for (let i = 0; i < 30; i++) {
      cache.put(poolFrame(i));
      cache.evict(i * 33_333); // playhead follows decode
    }
    expect(cache.size).toBeLessThanOrEqual(6);
    expect(cache.frameCapacity).toBe(6);
  });

  it("streams through a long run holding ≤ maxPoolFrames, without re-seek storms", async () => {
    // A decoder whose frames are pool-backed, like real VideoFrame storage.
    const poolDecoder = () => {
      const decoder = createFakeDecoder();
      let handler: ((frame: FakeFrame) => void) | null = null;
      Object.defineProperty(decoder, "onFrame", {
        get: () => handler,
        set: (fn: ((frame: FakeFrame) => void) | null) => {
          handler = fn && ((frame: FakeFrame) => fn(Object.assign(frame, { poolBacked: true })));
        },
      });
      return decoder;
    };
    const demuxer = new FakeDemuxer(600, 30);
    const pipeline = new VideoPipeline(demuxer, poolDecoder, { cache: { maxFrames: 120, maxPoolFrames: 6 } });
    let maxHeld = 0;
    for (let f = 0; f < 300; f++) {
      await pipeline.prime(f * FakeDemuxer.FRAME_US);
      await pipeline.waitForFrame(f * FakeDemuxer.FRAME_US);
      expect(pipeline.frameAt(f * FakeDemuxer.FRAME_US)?.timestampUs, `frame ${f}`).toBe(f * FakeDemuxer.FRAME_US);
      maxHeld = Math.max(maxHeld, pipeline.cacheSize);
    }
    expect(maxHeld).toBeLessThanOrEqual(6);
    expect(demuxer.iteratorsCreated).toBe(1); // continuous streaming, no eviction re-seeks
    pipeline.dispose();
  });
});

describe("media manager budget and lifetime", () => {
  const manager = (extra: Partial<ConstructorParameters<typeof MediaManager>[0]> = {}) =>
    new MediaManager({
      openDemuxer: async () => new FakeDemuxer(300, 30),
      createDecoder: createFakeDecoder,
      ...extra,
    });

  it("splits ONE frame budget across live pipelines", async () => {
    const m = manager({ frameBudgetBytes: 120 * MB, minPipelineBudgetBytes: 10 * MB });
    await m.acquire("a", "/a.mp4", undefined, "h1");
    await m.acquire("b", "/b.mp4", undefined, "h2");
    await m.acquire("c", "/c.mp4", undefined, "h3");
    expect(m.stats().frameBudgetBytes).toBe(120 * MB);
    // Pipelines decode into their 40 MB share; the total stays within budget.
    m.dispose();
  });

  it("releases a pipeline once no holder has needed it for idleReleaseMs", async () => {
    let now = 0;
    const m = manager({ idleReleaseMs: 1_000, now: () => now });
    const pipeline = await m.acquire("a", "/a.mp4", undefined, "clip1");
    m.unhold("a", undefined, "clip1");
    now = 500;
    m.sweep();
    expect(m.activeCount).toBe(1); // still in its grace period (a scrub back is cheap)
    now = 1_500;
    m.sweep();
    expect(m.activeCount).toBe(0);
    expect(pipeline.isDisposed).toBe(true);
  });

  it("a held pipeline is never idle-released", async () => {
    let now = 0;
    const m = manager({ idleReleaseMs: 10, now: () => now });
    await m.acquire("a", "/a.mp4", undefined, "clip1");
    now = 60_000;
    m.sweep();
    expect(m.activeCount).toBe(1);
    m.dispose();
  });

  it("over the cap, pipelines nobody holds are evicted first", async () => {
    let now = 0;
    const m = manager({ maxActivePipelines: 2, idleReleaseMs: 60_000, now: () => now });
    await m.acquire("a", "/a.mp4", undefined, "h1");
    const b = await m.acquire("b", "/b.mp4", undefined, "h2");
    m.unhold("b", undefined, "h2");
    now = 10;
    await m.acquire("c", "/c.mp4", undefined, "h3");
    expect(b.isDisposed).toBe(true);
    expect(m.isActive("a")).toBe(true);
    m.dispose();
  });

  it("memory pressure shrinks the frame budget, never below one share per pipeline", async () => {
    const m = manager({ frameBudgetBytes: 100 * MB, minPipelineBudgetBytes: 30 * MB });
    await m.acquire("a", "/a.mp4", undefined, "h1");
    m.reportMemoryPressure();
    expect(m.stats().frameBudgetBytes).toBe(75 * MB);
    for (let i = 0; i < 10; i++) m.reportMemoryPressure();
    expect(m.stats().frameBudgetBytes).toBe(30 * MB);
    m.resetMemoryBudget();
    expect(m.stats().frameBudgetBytes).toBe(100 * MB);
    m.dispose();
  });
});

describe("decoder lanes", () => {
  it("a montage of transitioned cuts needs a few lanes, not one per clip", () => {
    const lanes = assignVideoLanes(montage(200, SEC / 2).getState().doc, SEC);
    expect(lanes.size).toBe(200);
    expect(new Set(lanes.values()).size).toBeLessThanOrEqual(4);
  });

  it("clips far apart share lane 0 (decoder continuity across cuts)", () => {
    const project = montage(1, SEC);
    project.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "late", trackId: "v1", assetId: "src", startUs: 30 * SEC, durationUs: SEC, trimStartUs: 0 },
    });
    const lanes = assignVideoLanes(project.getState().doc, SEC);
    expect(lanes.get("c0")).toBe(0);
    expect(lanes.get("late")).toBe(0);
  });

  it("playing through a long montage keeps pipelines bounded and releases them behind", async () => {
    let now = 0;
    const project = montage(120, SEC / 2); // 60s of half-second transitioned cuts
    const manager = new MediaManager({
      openDemuxer: async () => new FakeDemuxer(20_000, 30),
      createDecoder: createFakeDecoder,
      idleReleaseMs: 1_000,
      now: () => now,
    });
    const videos = createVideoSupport(project, manager);
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend, { factories: { video: videos.factory } });
    let peak = 0;
    for (let t = 0; t < 60 * SEC; t += SEC / 4) {
      now = t / 1000;
      compositor.renderAt(t);
      await videos.prepare(t);
      peak = Math.max(peak, manager.activeCount);
    }
    // Peak overlap of span + lookahead, plus pipelines in their release grace.
    expect(peak).toBeLessThanOrEqual(6);
    now += 5_000;
    compositor.renderAt(60 * SEC);
    await videos.prepare(60 * SEC);
    videos.sweep();
    expect(manager.activeCount).toBeLessThanOrEqual(1);
    compositor.destroy();
    videos.dispose();
  });
});

describe("compositor residency", () => {
  /** An hour of 2s image clips on one track, plus one clip spanning everything. */
  function longTimeline(): Project {
    const project = createProject({ width: 1280, height: 720, fps: 30 });
    project.transaction(() => {
      project.dispatch({ type: "asset/add", payload: { id: "img", kind: "image", src: "/a.png" } });
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({ type: "track/add", payload: { id: "bg", kind: "video" } });
      for (let i = 0; i < 1800; i++) {
        project.dispatch({
          type: "clip/add",
          payload: { kind: "image", id: `i${i}`, trackId: "v1", assetId: "img", startUs: i * 2 * SEC, durationUs: 2 * SEC },
        });
      }
      project.dispatch({
        type: "clip/add",
        payload: { kind: "image", id: "under", trackId: "bg", assetId: "img", startUs: 0, durationUs: 3600 * SEC },
      });
    });
    return project;
  }

  it("mounts only clips near the render time, however long the timeline", () => {
    const project = longTimeline();
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend);
    let peak = 0;
    for (let t = 0; t < 3600 * SEC; t += 7 * SEC) {
      compositor.renderAt(t);
      peak = Math.max(peak, compositor.nodeCount);
    }
    expect(peak).toBeLessThanOrEqual(6); // ~4 neighbours + the spanning clip
    expect(backend.nodes.length).toBeLessThan(1801); // never all at once
    compositor.destroy();
  });

  it("the right clip is visible at every probe (mounting never changes what is drawn)", () => {
    const project = longTimeline();
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend);
    for (const t of [0, 1.999 * SEC, 2 * SEC, 1234.5 * SEC, 3599 * SEC, 17 * SEC, 0]) {
      compositor.renderAt(t);
      const visible = backend.nodes.filter((n) => !n.destroyed && n.visible).length;
      expect(visible, `t=${t}`).toBe(2); // the clip at t + the spanning clip
    }
    compositor.destroy();
  });

  it("residency: false mounts every clip (the previous behaviour)", () => {
    const project = longTimeline();
    const compositor = new Compositor(project, new FakeBackend(), { residency: false });
    expect(compositor.nodeCount).toBe(1801);
    compositor.destroy();
  });

  it("edits far from the playhead don't mount nodes; moving a clip near does", () => {
    const project = longTimeline();
    const compositor = new Compositor(project, new FakeBackend());
    compositor.renderAt(0);
    const before = compositor.nodeCount;
    project.dispatch({ type: "clip/trim", payload: { clipId: "i1000", durationUs: SEC } });
    expect(compositor.nodeCount).toBe(before);
    project.dispatch({ type: "track/add", payload: { id: "v2", kind: "video" } });
    project.dispatch({ type: "clip/move", payload: { clipId: "i1000", startUs: SEC / 2, trackId: "v2" } });
    expect(compositor.nodeCount).toBe(before + 1);
    compositor.destroy();
  });
});

describe("audio sources near the playhead", () => {
  it("a long timeline opens only nearby audio sources, and closes them behind", async () => {
    const { AudioEngine } = await import("../src/audio/audio-engine.js");
    const { FakeOutput, FakeAudioSource } = await import("./audio-fakes.js");
    const project = createProject({ width: 1280, height: 720, fps: 30 });
    project.transaction(() => {
      project.dispatch({ type: "asset/add", payload: { id: "a", kind: "audio", src: "/a.mp3", durationUs: 3_600 * SEC } });
      project.dispatch({ type: "track/add", payload: { id: "t1", kind: "audio" } });
      for (let i = 0; i < 1000; i++) {
        project.dispatch({ type: "clip/add", payload: { kind: "audio", id: `c${i}`, trackId: "t1", assetId: "a", startUs: i * 2 * SEC, durationUs: 2 * SEC } });
      }
    });
    const open = new Set<InstanceType<typeof FakeAudioSource>>();
    let opened = 0;
    const engine = new AudioEngine(project, new FakeOutput(), async () => {
      opened++;
      const source = new FakeAudioSource(3_600 * SEC);
      open.add(source);
      const dispose = source.dispose.bind(source);
      source.dispose = () => { open.delete(source); dispose(); };
      return source;
    });
    engine.start(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(opened).toBeLessThanOrEqual(3); // 0..4s window + preroll — not 1000
    let peakOpen = 0;
    for (let t = 0; t < 600 * SEC; t += SEC / 2) {
      engine.pump(t);
      await new Promise((r) => setTimeout(r, 0));
      peakOpen = Math.max(peakOpen, open.size);
    }
    expect(peakOpen).toBeLessThanOrEqual(5);
    engine.dispose();
  });
});
