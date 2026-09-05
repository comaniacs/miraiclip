import { beforeEach, describe, expect, it } from "vitest";
import { FrameCache } from "../src/media/frame-cache.js";
import { VideoPipeline } from "../src/media/video-pipeline.js";
import { MediaManager } from "../src/media/media-manager.js";
import { RealtimeClock, StepClock } from "../src/clock.js";
import { FakeDecoder, FakeDemuxer, createFakeDecoder, fakeFrame } from "./fakes.js";

const FRAME_US = FakeDemuxer.FRAME_US;

describe("FrameCache", () => {
  it("returns the frame covering a timestamp, or nearest earlier", () => {
    const cache = new FrameCache();
    const f0 = fakeFrame(0);
    const f1 = fakeFrame(FRAME_US);
    cache.put(f0);
    cache.put(f1);
    expect(cache.frameAt(10)).toBe(f0);
    expect(cache.frameAt(FRAME_US + 10)).toBe(f1);
    expect(cache.frameAt(999_999_999)).toBe(f1); // nearest earlier fallback
  });

  it("evicts frames farthest from the playhead and closes them", () => {
    const cache = new FrameCache({ maxFrames: 3 });
    const frames = [0, 1, 2, 3, 4].map((i) => fakeFrame(i * FRAME_US));
    for (const frame of frames) cache.put(frame);
    cache.evict(0);
    expect(cache.size).toBe(3);
    expect(frames[4]?.closed).toBe(true);
    expect(frames[3]?.closed).toBe(true);
    expect(frames[0]?.closed).toBe(false);
  });

  it("enforces the byte budget", () => {
    const cache = new FrameCache({ maxFrames: 100, maxBytes: 250 });
    for (const i of [0, 1, 2]) cache.put(fakeFrame(i * FRAME_US, FRAME_US, 100));
    cache.evict(0);
    expect(cache.byteSize).toBeLessThanOrEqual(250);
    expect(cache.size).toBe(2);
  });

  it("closes a replaced duplicate and everything on clear", () => {
    const cache = new FrameCache();
    const a = fakeFrame(0);
    const b = fakeFrame(0);
    cache.put(a);
    cache.put(b);
    expect(a.closed).toBe(true);
    cache.clear();
    expect(b.closed).toBe(true);
    expect(cache.size).toBe(0);
  });
});

describe("VideoPipeline", () => {
  beforeEach(() => {
    FakeDecoder.instances.length = 0; // the fake keeps a static registry
  });

  it("primes from the keyframe before the target and decodes ahead", async () => {
    const demuxer = new FakeDemuxer(300, 30); // keyframes at 0, 30, 60…
    const pipeline = new VideoPipeline(demuxer, createFakeDecoder, { aheadUs: 500_000 });
    const targetUs = 45 * FRAME_US; // mid-GOP: keyframe at frame 30
    await pipeline.prime(targetUs);

    expect(demuxer.chunksServed[0]).toBe(30 * FRAME_US); // started at keyframe
    expect(pipeline.frameAt(targetUs)?.timestampUs).toBe(targetUs);
    // decoded ahead but not the whole file
    expect(Math.max(...demuxer.chunksServed)).toBeLessThan(80 * FRAME_US);
  });

  it("a seek snaps to the target frame — lead-in is decoded but never shown", async () => {
    const demuxer = new FakeDemuxer(300, 30);
    const pipeline = new VideoPipeline(demuxer, createFakeDecoder, { aheadUs: 200_000 });
    const targetUs = 29 * FRAME_US; // keyframe at 0, 28 lead-in frames
    await pipeline.prime(targetUs);
    // The exact frame is presentable…
    expect(pipeline.frameAt(targetUs)?.timestampUs).toBe(targetUs);
    // …but the lead-in never entered the cache, so the display can never
    // rewind to the keyframe or fast-forward through the GOP.
    expect(pipeline.frameAt(5 * FRAME_US)).toBeUndefined();
    // All lead-in frames were closed exactly once (double-close would throw).
    expect(() => pipeline.dispose()).not.toThrow();
  });

  it("playback frames after a seek are all presentable", async () => {
    const demuxer = new FakeDemuxer(300, 30);
    const pipeline = new VideoPipeline(demuxer, createFakeDecoder, { aheadUs: 500_000 });
    await pipeline.prime(35 * FRAME_US); // settle mid-GOP
    // Linear playback from there: every advanced position has its frame.
    for (let f = 36; f <= 44; f++) {
      await pipeline.prime(f * FRAME_US);
      expect(pipeline.frameAt(f * FRAME_US)?.timestampUs).toBe(f * FRAME_US);
    }
    pipeline.dispose();
  });

  it("a superseding prime refines to the new target without leaking", async () => {
    const demuxer = new FakeDemuxer(600, 30);
    const pipeline = new VideoPipeline(demuxer, createFakeDecoder, { aheadUs: 500_000 });
    const first = pipeline.prime(0);
    const second = pipeline.prime(400 * FRAME_US); // far jump → supersedes
    await Promise.all([first, second]);
    expect(pipeline.frameAt(400 * FRAME_US)?.timestampUs).toBe(400 * FRAME_US);
    expect(() => pipeline.dispose()).not.toThrow(); // double-close-throwing fakes
    expect(FakeDecoder.instances.every((d) => d.closed)).toBe(true);
  });

  it("reuses one decoder across seeks, re-seeking the stream only when needed", async () => {
    const demuxer = new FakeDemuxer(600, 30);
    const pipeline = new VideoPipeline(demuxer, createFakeDecoder, { aheadUs: 500_000 });
    for (let f = 0; f <= 120; f += 10) await pipeline.prime(f * FRAME_US);
    // Linear playback: one decoder, one chunk stream — no re-seeks.
    expect(FakeDecoder.instances.length).toBe(1);
    expect(demuxer.iteratorsCreated).toBe(1);
    expect(pipeline.frameAt(120 * FRAME_US)?.timestampUs).toBe(120 * FRAME_US);
    // A backward jump to an evicted frame re-seeks the stream but reuses the
    // same (reset) decoder rather than allocating a new one.
    await pipeline.prime(2 * FRAME_US);
    expect(FakeDecoder.instances.length).toBe(1);
    expect(demuxer.iteratorsCreated).toBe(2);
    expect(FakeDecoder.instances[0]?.resets).toBeGreaterThanOrEqual(1);
  });

  it("dispose closes the cache and demuxer; later frames are refused", async () => {
    const demuxer = new FakeDemuxer(120, 30);
    const pipeline = new VideoPipeline(demuxer, createFakeDecoder);
    await pipeline.prime(0);
    expect(pipeline.cacheSize).toBeGreaterThan(0);
    pipeline.dispose();
    expect(pipeline.cacheSize).toBe(0);
    expect(demuxer.disposed).toBe(true);
    await pipeline.prime(0); // no-op, no throw
    expect(pipeline.cacheSize).toBe(0);
  });

  it("surfaces decoder errors", async () => {
    const demuxer = new FakeDemuxer(120, 30);
    const failing = () => {
      const decoder = new FakeDecoder();
      decoder.decode = () => decoder.onError?.(new Error("boom"));
      return decoder;
    };
    const pipeline = new VideoPipeline(demuxer, failing);
    await expect(pipeline.prime(0)).rejects.toThrow("boom");
  });
});

describe("MediaManager", () => {
  const options = () => ({
    openDemuxer: async () => new FakeDemuxer(300, 30),
    createDecoder: createFakeDecoder,
    maxActivePipelines: 2,
  });

  it("shares one pipeline per asset", async () => {
    const manager = new MediaManager(options());
    const a1 = await manager.acquire("a", "/a.mp4");
    const a2 = await manager.acquire("a", "/a.mp4");
    expect(a1).toBe(a2);
    expect(manager.activeCount).toBe(1);
    manager.dispose();
  });

  it("evicts the least recently used pipeline over the cap", async () => {
    const manager = new MediaManager(options());
    await manager.acquire("a", "/a.mp4");
    await manager.acquire("b", "/b.mp4");
    await manager.acquire("a", "/a.mp4"); // touch a → b becomes LRU
    await manager.acquire("c", "/c.mp4");
    expect(manager.activeCount).toBe(2);
    expect(manager.isActive("a")).toBe(true);
    expect(manager.isActive("b")).toBe(false);
    expect(manager.isActive("c")).toBe(true);
    manager.dispose();
  });

  it("dispose releases everything and refuses further work", async () => {
    const manager = new MediaManager(options());
    const pipeline = await manager.acquire("a", "/a.mp4");
    await pipeline.prime(0);
    manager.dispose();
    expect(pipeline.cacheSize).toBe(0);
    await expect(manager.acquire("b", "/b.mp4")).rejects.toThrow(/disposed/);
  });
});

describe("clocks", () => {
  it("StepClock advances deterministically by frames", () => {
    const clock = new StepClock();
    clock.setTime(0);
    clock.step(30);
    clock.step(30);
    expect(clock.timeUs).toBe(66_666);
    expect(clock.playing).toBe(false);
  });

  it("RealtimeClock tracks an injected time source with rate", () => {
    let nowMs = 1000;
    const clock = new RealtimeClock(() => nowMs);
    expect(clock.playing).toBe(false);
    clock.play();
    nowMs += 500; // +500ms at 1x
    expect(clock.timeUs).toBe(500_000);
    clock.setRate(2);
    nowMs += 250; // +250ms at 2x = +500ms media time
    expect(clock.timeUs).toBe(1_000_000);
    clock.pause();
    nowMs += 999;
    expect(clock.timeUs).toBe(1_000_000);
    clock.seek(0);
    expect(clock.timeUs).toBe(0);
  });
});
