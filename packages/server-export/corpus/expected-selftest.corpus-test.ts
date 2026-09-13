/**
 * Pure self-test of the expectation math (no ffmpeg, no browser): the oracle
 * must replicate the exporter's documented frame walk and the dissolve's
 * compositing before its verdicts on real exports mean anything.
 */
import { describe, expect, it } from "vitest";
import { expectedFrames, mixColors, sampleTimes } from "./expected.js";

describe("corpus expectation math", () => {
  it("sample times replicate the exporter's midpoint walk", () => {
    const times = sampleTimes(0, 1_000_000, 30);
    expect(times.length).toBe(30);
    // Frame 15: [500_000, 533_333) → midpoint 516_666 (floor of half-width).
    expect(times[15]).toEqual({ n: 15, sampleUs: 516_666 });
    // Last frame clips at the range end.
    const short = sampleTimes(0, 1_010_000, 30);
    expect(short.length).toBe(31);
    expect(short[30]!.sampleUs).toBeLessThan(1_010_000);
  });

  it("range exports rebase: sampling starts at the range start", () => {
    const times = sampleTimes(1_000_000, 3_000_000, 30);
    expect(times[0]!.sampleUs).toBeGreaterThanOrEqual(1_000_000);
    expect(times.length).toBe(60);
  });

  it("frame selection crosses a cut with trimmed media", () => {
    // Two 2s clips; the second starts 800ms deeper into the source.
    const segments = [
      { timelineStartUs: 0, timelineEndUs: 2_000_000, mediaStartUs: 0 },
      { timelineStartUs: 2_000_000, timelineEndUs: 4_000_000, mediaStartUs: 2_800_000 },
    ];
    const frames = expectedFrames({ segments, rangeStartUs: 0, rangeEndUs: 4_000_000, fps: 30 });
    expect(frames.length).toBe(120);
    // Just before the cut: source ≈ timeline. Just after: +800ms (24 frames).
    expect(frames[59]!).toMatchObject({ kind: "exact", frame: 59 });
    expect(frames[60]!).toMatchObject({ kind: "exact", frame: 60 + 24 });
  });

  it("a dissolve window is centered on the cut with p spanning 0→1", () => {
    const segments = [
      { timelineStartUs: 0, timelineEndUs: 2_000_000, mediaStartUs: 0 },
      { timelineStartUs: 2_000_000, timelineEndUs: 4_000_000, mediaStartUs: 2_800_000 },
    ];
    const frames = expectedFrames({
      segments,
      dissolves: [{ cutUs: 2_000_000, durationUs: 1_000_000 }],
      rangeStartUs: 0,
      rangeEndUs: 4_000_000,
      fps: 30,
    });
    const blends = frames.filter((f) => f.kind === "blend");
    // Window 1.5s–2.5s at 30fps ≈ 30 sampled frames.
    expect(blends.length).toBeGreaterThanOrEqual(29);
    expect(blends.length).toBeLessThanOrEqual(31);
    expect(blends[0]!.p!).toBeLessThan(0.05);
    expect(blends.at(-1)!.p!).toBeGreaterThan(0.95);
    // Mid-window: outgoing tracks the timeline, incoming tracks it +24 frames.
    const mid = blends.find((f) => Math.abs(f.p! - 0.5) < 0.03)!;
    expect(mid.frame).toBe(Math.floor((mid.sampleUs * 30) / 1_000_000));
    expect(mid.inFrame).toBe(Math.floor(((mid.sampleUs + 800_000) * 30) / 1_000_000));
    // Frames outside the window are exact.
    expect(frames[10]!.kind).toBe("exact");
    expect(frames.at(-1)!.kind).toBe("exact");
  });

  it("mixColors is the dissolve's in-over-out compositing", () => {
    expect(mixColors({ r: 200, g: 0, b: 128 }, { r: 0, g: 100, b: 128 }, 0.25)).toEqual({
      r: 150,
      g: 25,
      b: 128,
    });
  });
});
