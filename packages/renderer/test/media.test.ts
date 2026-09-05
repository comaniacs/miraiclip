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

  it("evicts the past before the future", () => {
    const cache = new FrameCache({ maxFrames: 4 });
    for (const i of [0, 1, 2, 3, 4, 5]) cache.put(fakeFrame(i * FRAME_US));
    cache.evict(3 * FRAME_US); // playhead at frame 3: behind = 0,1,2 (2 covering-adjacent)
    // Oldest-behind frames go first; the ahead frames (4, 5) must survive —
    // symmetric distance-eviction would have discarded frame 5 on arrival.
    expect(cache.frameAt(5 * FRAME_US)?.timestampUs).toBe(5 * FRAME_US);
    expect(cache.frameAt(4 * FRAME_US)?.timestampUs).toBe(4 * FRAME_US);
    expect(cache.has(0)).toBe(false);
    expect(cache.has(FRAME_US)).toBe(false);
  });

  it("never evicts the frame covering the playhead, whatever the budget", () => {
    const cache = new FrameCache({ maxFrames: 2 });
    const covering = fakeFrame(10 * FRAME_US);
    cache.put(covering);
    for (const i of [11, 12, 13, 14]) cache.put(fakeFrame(i * FRAME_US));
    cache.evict(10 * FRAME_US + 5); // playhead sits on the covering frame
    expect(covering.closed).toBe(false);
    expect(cache.frameAt(10 * FRAME_US + 5)).toBe(covering);
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

  it("survives streams that report zero frame durations (no reseek storm)", async () => {
    const demuxer = new FakeDemuxer(300, 30);
    // Decoder emitting duration-0 frames, like some 60fps/B-frame H.264 files.
    const zeroDuration = () => {
      const decoder = new FakeDecoder();
      const original = decoder.decode.bind(decoder);
      decoder.decode = (chunk) => {
        original(chunk);
        const frame = decoder.emitted.at(-1)!;
        (frame as { durationUs: number }).durationUs = 0;
      };
      return decoder;
    };
    const pipeline = new VideoPipeline(demuxer, zeroDuration, { aheadUs: 500_000 });
    const targetUs = 45 * FRAME_US;
    await pipeline.prime(targetUs);
    // The frame AT the target is presentable despite its zero duration…
    expect(pipeline.frameAt(targetUs)?.timestampUs).toBe(targetUs);
    // …and repeated primes at the same spot reuse the stream instead of
    // re-seeking forever (the black-video + pegged-CPU failure mode).
    await pipeline.prime(targetUs);
    await pipeline.prime(targetUs + 1_000);
    expect(demuxer.iteratorsCreated).toBe(1);
    pipeline.dispose();
  });

  it("never reseeks while decoded frames are still arriving (async decode)", async () => {
    const demuxer = new FakeDemuxer(300, 30);
    // Real decoders deliver frames asynchronously (decode callback plus a GPU
    // ImageBitmap copy) — at 4K that window is long. Simulate with a decoder
    // that defers each emission a macrotask.
    const asyncDecoder = () => {
      const decoder = new FakeDecoder();
      const original = decoder.decode.bind(decoder);
      decoder.decode = (chunk) => {
        setTimeout(() => original(chunk), 0);
      };
      return decoder;
    };
    const pipeline = new VideoPipeline(demuxer, asyncDecoder, { aheadUs: 500_000 });
    const targetUs = 45 * FRAME_US;
    // Hammer prime the way the rAF tick does, while frames are in flight. The
    // old timing-based check saw "fed past the target but not cached" and
    // re-seeked, and each re-seek discarded the in-flight frames — a storm.
    const first = pipeline.prime(targetUs);
    for (let i = 0; i < 25; i++) {
      void pipeline.prime(targetUs);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await first;
    await new Promise((resolve) => setTimeout(resolve, 20)); // let emissions land
    await pipeline.prime(targetUs);
    expect(pipeline.frameAt(targetUs)?.timestampUs).toBe(targetUs);
    expect(demuxer.iteratorsCreated).toBe(1);
    pipeline.dispose();
  });

  it("adapts the decode-ahead window to the byte budget (no evict/reseek churn)", async () => {
    // "4K" frames: 40 MB each against a 512 MiB default budget — the cache can
    // hold ~13, far fewer than 1s of decode-ahead would produce.
    const demuxer = new FakeDemuxer(600, 30);
    const bigFrames = () => {
      const decoder = new FakeDecoder();
      const original = decoder.decode.bind(decoder);
      decoder.decode = (chunk) => {
        original(chunk);
        const frame = decoder.emitted.at(-1)!;
        (frame as { byteLength: number }).byteLength = 40 * 1024 * 1024;
      };
      return decoder;
    };
    const pipeline = new VideoPipeline(demuxer, bigFrames, { aheadUs: 1_000_000 });
    // Linear playback: every frame must be available when the playhead reaches
    // it, with no stream re-seeks (the fixed 1s window used to decode frames
    // straight into eviction, then re-seek when the playhead reached the gap).
    for (let f = 0; f <= 90; f++) {
      await pipeline.prime(f * FRAME_US);
      expect(pipeline.frameAt(f * FRAME_US)?.timestampUs).toBe(f * FRAME_US);
    }
    expect(demuxer.iteratorsCreated).toBe(1);
    pipeline.dispose();
  });

  it("a slow FIRST conversion after a seek never re-triggers the seek", async () => {
    // After a seek the first conversion is often the slowest (pipeline
    // warmup), so a LATER frame lands first. A watermark anchored at that
    // first arrival puts the in-flight target below it → misread as evicted →
    // re-seek → same race on the new stream: a self-sustaining storm. The
    // anchor must be the seek target itself.
    const demuxer = new FakeDemuxer(300, 30);
    const slowFirst = () => {
      const decoder = new FakeDecoder();
      const original = decoder.decode.bind(decoder);
      let held: (() => void) | undefined;
      let count = 0;
      decoder.decode = (chunk) => {
        count++;
        if (count === 1) {
          held = () => original(chunk);
          return;
        }
        original(chunk);
        if (count === 12 && held) {
          held();
          held = undefined;
        }
      };
      return decoder;
    };
    const pipeline = new VideoPipeline(demuxer, slowFirst, { aheadUs: 500_000 });
    const first = pipeline.prime(0);
    for (let i = 0; i < 20; i++) {
      void pipeline.prime(0); // the rAF tick, hammering while frame 0 is in flight
      await Promise.resolve();
    }
    await first;
    await pipeline.prime(0);
    expect(demuxer.iteratorsCreated).toBe(1);
    expect(pipeline.frameAt(0)?.timestampUs).toBe(0);
    pipeline.dispose();
  });

  it("a straggling frame arrival never triggers a re-seek (contiguity watermark)", async () => {
    const demuxer = new FakeDemuxer(300, 30);
    // Frame #5's emission is held until 15 later frames have emitted — like a
    // slow ImageBitmap copy while decode runs at hundreds of fps. The old
    // arrival-high-watermark check read the hole at the playhead as an
    // eviction and re-seeked (the ~1/sec decode storm measured on 4K60).
    const straggler = () => {
      const decoder = new FakeDecoder();
      const original = decoder.decode.bind(decoder);
      let held: (() => void) | undefined;
      let count = 0;
      decoder.decode = (chunk) => {
        count++;
        if (count === 6) {
          held = () => original(chunk);
          return;
        }
        original(chunk);
        if (count === 21 && held) {
          held();
          held = undefined;
        }
      };
      return decoder;
    };
    const pipeline = new VideoPipeline(demuxer, straggler, { aheadUs: 800_000 });
    for (let f = 0; f <= 40; f++) await pipeline.prime(f * FRAME_US);
    expect(demuxer.iteratorsCreated).toBe(1); // held frame ≠ evicted frame
    expect(pipeline.frameAt(5 * FRAME_US)?.timestampUs).toBe(5 * FRAME_US); // landed late, kept
    pipeline.dispose();
  });

  it("sizes decode-ahead by measured frame spacing, not reported durations", async () => {
    // The 4K60 failure: a stream reporting no/wrong durations (fallback 2× the
    // real spacing) made the time-based ahead window feed more big frames than
    // the byte budget holds — eviction reached the displayed frame and every
    // playhead advance re-seeked the stream (decode rate 3–6× playback).
    const demuxer = new FakeDemuxer(600, 30);
    const lyingDurations = () => {
      const decoder = new FakeDecoder();
      const original = decoder.decode.bind(decoder);
      decoder.decode = (chunk) => {
        original(chunk);
        const frame = decoder.emitted.at(-1)!;
        (frame as { durationUs: number }).durationUs = 2 * FRAME_US; // wrong: 2× actual
        (frame as { byteLength: number }).byteLength = 40 * 1024 * 1024;
      };
      return decoder;
    };
    const pipeline = new VideoPipeline(demuxer, lyingDurations, { aheadUs: 1_000_000 });
    for (let f = 0; f <= 90; f++) {
      await pipeline.prime(f * FRAME_US);
      expect(pipeline.frameAt(f * FRAME_US)?.timestampUs).toBe(f * FRAME_US);
    }
    expect(demuxer.iteratorsCreated).toBe(1); // linear playback: one stream, ever
    pipeline.dispose();
  });

  it("playback across the cache-capacity boundary never re-seeks (no self-evicting decode-ahead)", async () => {
    // The 1.07s-period storm measured on 4K60: a cache that can hold barely
    // more than the ahead window. Symmetric eviction discarded each freshly
    // decoded ahead frame (the farthest from a short behind-tail), burning a
    // hole one cache-capacity after every seek; the playhead hit it and
    // re-seeked, re-arming the trap on the new stream.
    const demuxer = new FakeDemuxer(600, 30);
    const pipeline = new VideoPipeline(demuxer, createFakeDecoder, {
      aheadUs: 10 * FRAME_US,
      cache: { maxFrames: 14 },
    });
    for (let f = 0; f <= 60; f++) {
      await pipeline.prime(f * FRAME_US);
      expect(pipeline.frameAt(f * FRAME_US)?.timestampUs).toBe(f * FRAME_US);
    }
    expect(demuxer.iteratorsCreated).toBe(1);
    pipeline.dispose();
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
