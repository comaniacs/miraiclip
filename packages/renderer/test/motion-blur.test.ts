import { describe, expect, it } from "vitest";
import {
  clipTimesToCuts,
  resolveMotionBlur,
  sampleCountFor,
  shutterSampleTimes,
  shutterUs,
} from "../src/export/motion-blur.js";

describe("motion blur planning", () => {
  it("defaults to a 180° shutter and refuses nonsense loudly", () => {
    expect(resolveMotionBlur({})).toEqual({ shutterAngle: 180, minSamples: 4, maxSamples: 32, gapPx: 6 });
    expect(resolveMotionBlur(undefined)).toBeNull();
    expect(resolveMotionBlur({ shutterAngle: 0 })).toBeNull(); // 0° is "off"
    expect(() => resolveMotionBlur({ shutterAngle: 400 })).toThrow(/shutterAngle/);
    expect(() => resolveMotionBlur({ minSamples: 8, maxSamples: 4 })).toThrow(/maxSamples/);
    expect(() => resolveMotionBlur({ minSamples: 2.5 })).toThrow(/integer/);
  });

  it("the shutter is angle/360 of the frame, in whole µs", () => {
    expect(shutterUs(33_333, 180)).toBe(16_667);
    expect(shutterUs(40_000, 360)).toBe(40_000);
  });

  it("spreads samples evenly across the open shutter around the centre", () => {
    expect(shutterSampleTimes(1_000_000, 16_000, 4)).toEqual([994_000, 998_000, 1_002_000, 1_006_000]);
    expect(shutterSampleTimes(1_000_000, 16_000, 1)).toEqual([1_000_000]);
    expect(shutterSampleTimes(1_000_000, 0, 8)).toEqual([1_000_000]);
  });

  it("mirrors around the centre exactly, even when rounding is uneven (29.97, 23.976)", () => {
    for (const [frameUs, count] of [[33_367, 7], [41_708, 5], [33_333, 32], [16_683, 9]] as const) {
      const open = shutterUs(frameUs, 180);
      const t = shutterSampleTimes(5_000_000, open, count).map((x) => x - 5_000_000);
      expect(t.every(Number.isInteger)).toBe(true);
      expect(t).toEqual(t.map((_, i) => 0 - t[count - 1 - i]!));
      expect([...t].sort((a, b) => a - b)).toEqual(t); // increasing
    }
  });

  it("holds below half a pixel and scales with travel inside [min, max]", () => {
    const r = resolveMotionBlur({})!;
    expect(sampleCountFor(0, r)).toBe(1);
    expect(sampleCountFor(0.4, r)).toBe(1);
    expect(sampleCountFor(0.5, r)).toBe(4); // moves at all: at least minSamples
    expect(sampleCountFor(60, r)).toBe(11);
    expect(sampleCountFor(10_000, r)).toBe(32);
    expect(sampleCountFor(10_000, resolveMotionBlur({ maxSamples: 12 })!)).toBe(12);
  });

  it("never blends across a hard cut: only the centre's side keeps its samples", () => {
    const times = [994_000, 998_000, 1_002_000, 1_006_000];
    expect(clipTimesToCuts(times, 1_000_000, [])).toEqual(times);
    expect(clipTimesToCuts(times, 1_000_000, [1_001_000])).toEqual([994_000, 998_000]);
    expect(clipTimesToCuts(times, 1_004_000, [1_001_000])).toEqual([1_002_000, 1_006_000]);
    expect(clipTimesToCuts(times, 1_000_000, [996_000, 1_004_000])).toEqual([998_000, 1_002_000]);
    // a cut exactly at a sample belongs to the "after" side
    expect(clipTimesToCuts(times, 1_000_000, [998_000])).toEqual([998_000, 1_002_000, 1_006_000]);
    expect(clipTimesToCuts([994_000], 1_000_000, [996_000])).toEqual([1_000_000]); // never empty
  });
});

// ---------------------------------------------------------------------------
// The planner, the compositor's motion estimate, and the exporter loop
// ---------------------------------------------------------------------------
import { createProject } from "@miraiclip/core";
import { Compositor } from "../src/compositor/compositor.js";
import { createBlurPlanner, cutsFromSnapshot, documentHardCuts } from "../src/export/blur-plan.js";
import { exportComposition } from "../src/export/exporter.js";
import { FakeBackend } from "./scene-fakes.js";

const SEC = 1_000_000;

function twoImages(): ReturnType<typeof createProject> {
  const project = createProject({ width: 1000, height: 500, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "img", kind: "image", src: "/a.png" } });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "clip/add", payload: { kind: "image", id: "a", trackId: "v1", assetId: "img", startUs: 0, durationUs: 2 * SEC } });
    project.dispatch({ type: "clip/add", payload: { kind: "image", id: "b", trackId: "v1", assetId: "img", startUs: 2 * SEC, durationUs: 2 * SEC } });
  });
  return project;
}

describe("hard cuts", () => {
  it("every clip edge is a cut, except the two sides of a transition", () => {
    const project = twoImages();
    expect(documentHardCuts(project.getState().doc)).toEqual([0, 2 * SEC, 4 * SEC]);
    project.dispatch({ type: "transition/add", payload: { id: "t", kind: "crossDissolve", fromClipId: "a", toClipId: "b", durationUs: SEC } });
    expect(documentHardCuts(project.getState().doc)).toEqual([0, 4 * SEC]);
  });

  it("reads a sequence's tl.cut times (seconds into the clip) as timeline µs", () => {
    const snapshot = '<div data-stage-cuts="[1.5,3]" data-x="1">';
    expect(cutsFromSnapshot(snapshot, { startUs: 10 * SEC })).toEqual([11_500_000, 13 * SEC]);
    expect(cutsFromSnapshot(snapshot, { startUs: 10 * SEC, animationOffsetUs: SEC })).toEqual([10_500_000, 12 * SEC]);
    expect(cutsFromSnapshot("<div>", { startUs: 0 })).toEqual([]);
  });
});

describe("compositor motion estimate", () => {
  it("measures keyframed travel in composition pixels, ignores appearing clips and opacity", () => {
    const project = twoImages();
    const compositor = new Compositor(project, new FakeBackend());
    compositor.renderAt(SEC);
    expect(compositor.motionPxBetween(SEC, SEC + 33_000)).toBe(0); // still
    project.dispatch({ type: "keyframe/set", payload: { clipId: "a", property: "x", timeUs: 0, value: 0.5 } });
    project.dispatch({ type: "keyframe/set", payload: { clipId: "a", property: "x", timeUs: 2 * SEC, value: 1.5 } });
    // 1000 px over 2 s → 50 px in 100 ms
    expect(compositor.motionPxBetween(SEC, SEC + 100_000)).toBeCloseTo(50, 3);
    // b only appears across the cut: no motion from it
    expect(compositor.motionPxBetween(2 * SEC - 10_000, 2 * SEC + 10_000)).toBe(0); // a leaves and b arrives: a cut, not motion
  });

  it("counts a slide transition's travel", () => {
    const project = twoImages();
    project.dispatch({ type: "transition/add", payload: { id: "t", kind: "slide", fromClipId: "a", toClipId: "b", durationUs: SEC } });
    const compositor = new Compositor(project, new FakeBackend());
    compositor.renderAt(2 * SEC);
    // the window is 1.5 s – 2.5 s; the slide covers 1000 px across it
    expect(compositor.motionPxBetween(1_900_000, 2_000_000)).toBeCloseTo(100, 0);
  });
});

describe("blur planner", () => {
  const options = resolveMotionBlur({})!;
  const project = twoImages();
  const doc = project.getState().doc;
  const planner = (motionPx: number, extra: Partial<Parameters<typeof createBlurPlanner>[0]> = {}) =>
    createBlurPlanner({ options, doc, compositor: { motionPxBetween: () => motionPx }, range: { startUs: 0, endUs: 4 * SEC }, outputScale: 1, ...extra });
  const frame = { startUs: SEC, endUs: SEC + 33_333, sampleUs: SEC + 16_667 };

  it("renders a still frame once, at the centre — exactly where an unblurred export samples", async () => {
    expect(await planner(0)(frame)).toEqual([frame.sampleUs]);
  });

  it("moving frames get a symmetric spread inside the open shutter", async () => {
    const times = await planner(24)(frame); // 24px / 6 + 1 = 5
    expect(times.length).toBe(5);
    const open = shutterUs(33_333, 180);
    expect(times[0]!).toBeGreaterThan(frame.sampleUs - open / 2 - 1);
    expect(times.at(-1)!).toBeLessThan(frame.sampleUs + open / 2 + 1);
    expect(times.map((t) => t - frame.sampleUs)).toEqual(times.map((_, i) => 0 - (times[times.length - 1 - i]! - frame.sampleUs)));
  });

  it("scales pixels with the output size", async () => {
    expect((await planner(24, { outputScale: 0.25 })(frame)).length).toBe(4); // 6 px → min samples
    expect((await planner(24, { outputScale: 2 })(frame)).length).toBe(9);
  });

  it("drops samples across a hard cut at a clip edge", async () => {
    const atCut = { startUs: 2 * SEC - 16_000, endUs: 2 * SEC + 17_333, sampleUs: 2 * SEC - 5_000 };
    const times = await planner(100)(atCut);
    expect(times.length).toBeGreaterThan(1);
    expect(times.every((t) => t < 2 * SEC)).toBe(true); // clip b is on the other side
    const afterCut = await planner(100)({ ...atCut, sampleUs: 2 * SEC + 5_000 });
    expect(afterCut.every((t) => t >= 2 * SEC)).toBe(true);
  });

  it("a scripted clip whose motion can't be measured counts as moving; a measured one uses its number", async () => {
    const withHtml = createProject({ width: 1000, height: 500, fps: 30 });
    withHtml.transaction(() => {
      withHtml.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      withHtml.dispatch({ type: "clip/add", payload: { kind: "html", id: "h", trackId: "v1", startUs: 0, durationUs: 4 * SEC, template: "<div></div>", params: {}, scripted: true } });
    });
    const base = { options, doc: withHtml.getState().doc, compositor: { motionPxBetween: () => 0 }, range: { startUs: 0, endUs: 4 * SEC }, outputScale: 1 };
    expect((await createBlurPlanner(base)(frame)).length).toBe(9); // 8 gaps assumed: 48 px / 6 + 1
    expect(await createBlurPlanner({ ...base, htmlMotion: async () => null })(frame).then((t) => t.length)).toBe(9);
    expect(await createBlurPlanner({ ...base, htmlMotion: async () => 0 })(frame)).toEqual([frame.sampleUs]);
    expect((await createBlurPlanner({ ...base, htmlMotion: async () => 60 })(frame)).length).toBe(11);
  });

  it("never samples outside the exported range", async () => {
    const times = await planner(500, { range: { startUs: 0, endUs: 40_000 } })({ startUs: 0, endUs: 33_333, sampleUs: 16_667 });
    expect(times.every((t) => t >= 0 && t < 40_000)).toBe(true);
  });
});

describe("exporter with blur", () => {
  class Sink {
    frames = 0;
    async addVideoFrame() { this.frames++; }
    async finalize() { return new Uint8Array(); }
    async cancel() {}
  }
  it("renders each planned time, accumulates 1/N, and copies a single-time frame", async () => {
    const calls: string[] = [];
    const accumulator = {
      canvas: {} as OffscreenCanvas,
      reset: () => calls.push("reset"),
      add: (w: number) => calls.push(`add ${w}`),
      resolve: () => calls.push("resolve"),
      copy: () => calls.push("copy"),
      destroy: () => undefined,
    };
    const rendered: number[] = [];
    const sink = new Sink();
    await exportComposition({
      startUs: 0, endUs: 100_000, fps: 30,
      renderFrame: async (t) => { rendered.push(t); },
      sink,
      blur: { accumulator, plan: ({ n, sampleUs }) => (n === 1 ? [sampleUs - 100, sampleUs, sampleUs + 100, sampleUs + 200] : [sampleUs]) },
    });
    expect(sink.frames).toBe(3);
    expect(calls).toEqual(["copy", "reset", "add 0.25", "add 0.25", "add 0.25", "add 0.25", "resolve", "copy"]);
    expect(rendered.length).toBe(1 + 4 + 1);
  });
});
