import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { gainFor, isAudible, mapChunkToTimeline } from "../src/audio/mapping.js";
import { planAudioJobs } from "../src/export/offline-audio.js";

function docWith(mutate?: (project: ReturnType<typeof createProject>) => void) {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.dispatch({
    type: "asset/add",
    payload: { id: "a", kind: "video", src: "/a.mp4", durationUs: 60_000_000 },
  });
  project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "video",
      id: "c1",
      trackId: "t1",
      assetId: "a",
      startUs: 1_000_000,
      durationUs: 4_000_000,
      trimStartUs: 500_000,
    },
  });
  mutate?.(project);
  return project.getState().doc;
}

describe("audio mapping (shared preview/export math)", () => {
  const clip = () => docWith().clips["c1"]! as never;

  it("maps media chunks through clip start and trim", () => {
    // Chunk at media 500ms (= the trim point) plays at the clip start, 1s.
    const mapped = mapChunkToTimeline(clip(), 500_000, 200_000, 0);
    expect(mapped).toEqual({
      playFromTimelineUs: 1_000_000,
      offsetIntoChunkUs: 0,
      durationUs: 200_000,
    });
  });

  it("clamps a chunk straddling the window start", () => {
    const mapped = mapChunkToTimeline(clip(), 500_000, 200_000, 1_100_000);
    expect(mapped).toEqual({
      playFromTimelineUs: 1_100_000,
      offsetIntoChunkUs: 100_000,
      durationUs: 100_000,
    });
  });

  it("clips a chunk crossing the clip end and reports past-end after it", () => {
    // Clip ends at 5s = media 4.5s. Chunk at media 4.4–4.6s → plays 100ms.
    const mapped = mapChunkToTimeline(clip(), 4_400_000, 200_000, 0);
    expect(mapped).toEqual({
      playFromTimelineUs: 4_900_000,
      offsetIntoChunkUs: 0,
      durationUs: 100_000,
    });
    expect(mapChunkToTimeline(clip(), 4_600_000, 200_000, 0)).toBe("past-end");
    expect(mapChunkToTimeline(clip(), 0, 200_000, 1_000_000)).toBe("behind");
  });
});

describe("planAudioJobs", () => {
  const range = { startUs: 0, endUs: 10_000_000 };

  it("plans one job per audible overlapping clip with trim-adjusted start", () => {
    const jobs = planAudioJobs(docWith(), range);
    expect(jobs.length).toBe(1);
    expect(jobs[0]).toMatchObject({ clipId: "c1", assetId: "a", fromMediaUs: 500_000, gain: 1 });
  });

  it("range starting mid-clip advances the media start", () => {
    const jobs = planAudioJobs(docWith(), { startUs: 2_000_000, endUs: 10_000_000 });
    expect(jobs[0]!.fromMediaUs).toBe(1_500_000); // trim 0.5s + 1s into the clip
  });

  it("skips non-overlapping, muted, and soloed-out clips", () => {
    const doc = docWith((p) => {
      p.dispatch({ type: "track/add", payload: { id: "t2", kind: "video" } });
      p.dispatch({
        type: "clip/add",
        payload: { kind: "video", id: "far", trackId: "t2", assetId: "a", startUs: 50_000_000, durationUs: 1_000_000 },
      });
      p.dispatch({ type: "track/set-property", payload: { trackId: "t1", muted: true } });
    });
    expect(planAudioJobs(doc, range)).toEqual([]); // c1 muted, far out of range
  });

  it("solo on another track silences the rest", () => {
    const doc = docWith((p) => {
      p.dispatch({ type: "track/add", payload: { id: "t2", kind: "video" } });
      p.dispatch({ type: "track/set-property", payload: { trackId: "t2", solo: true } });
    });
    expect(planAudioJobs(doc, range)).toEqual([]);
  });

  it("isAudible covers video and audio, not text/image", () => {
    expect(isAudible({ kind: "video" } as never)).toBe(true);
    expect(isAudible({ kind: "audio" } as never)).toBe(true);
    expect(isAudible({ kind: "text" } as never)).toBe(false);
    expect(isAudible({ kind: "image" } as never)).toBe(false);
  });

  it("gainFor multiplies clip volume with track state", () => {
    const doc = docWith((p) => {
      p.dispatch({ type: "clip/set-property", payload: { clipId: "c1", volume: 0.5 } });
    });
    expect(gainFor(doc.clips["c1"]! as never, doc)).toBe(0.5);
  });
});
