import { describe, expect, it } from "vitest";
import { createProject, type AudioClip } from "@miraiclip/core";
import { AudioEngine } from "../src/audio/audio-engine.js";
import { clipFades, fadeGainAt, gainFor, volumeAutomation } from "../src/audio/mapping.js";
import { accumulatePeaks, computeWaveformPeaks, peaksForRange } from "../src/audio/waveform.js";
import type { AudioChunk, AudioTrackSource } from "../src/audio/types.js";
import { planAudioJobs } from "../src/export/offline-audio.js";
import { FakeOutput, openFakeAudio, settle } from "./audio-fakes.js";

function setup(fades: { fadeInUs?: number; fadeOutUs?: number }, volume = 1) {
  const project = createProject({ width: 640, height: 360, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "a", kind: "audio", src: "s.mp3", durationUs: 10_000_000 } });
    project.dispatch({ type: "track/add", payload: { id: "t1", kind: "audio" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "audio", id: "c1", trackId: "t1", assetId: "a", startUs: 1_000_000, durationUs: 4_000_000, volume, ...fades },
    });
  });
  const doc = project.getState().doc;
  return { project, doc, clip: doc.clips.c1 as AudioClip };
}

describe("audio fades", () => {
  it("ramps linearly in from the clip start and out to its end", () => {
    const { clip } = setup({ fadeInUs: 1_000_000, fadeOutUs: 2_000_000 });
    expect(fadeGainAt(clip, 1_000_000)).toBe(0);
    expect(fadeGainAt(clip, 1_500_000)).toBeCloseTo(0.5);
    expect(fadeGainAt(clip, 2_500_000)).toBe(1);
    expect(fadeGainAt(clip, 4_000_000)).toBeCloseTo(0.5);
    expect(fadeGainAt(clip, 5_000_000)).toBe(0);
  });

  it("scales fades that overlap so they meet inside the clip", () => {
    const { clip } = setup({ fadeInUs: 3_000_000, fadeOutUs: 3_000_000 });
    expect(clipFades(clip)).toEqual({ inUs: 2_000_000, outUs: 2_000_000 });
    expect(fadeGainAt(clip, 3_000_000)).toBeCloseTo(1);
  });

  it("gainFor multiplies volume, fades and the track gate", () => {
    const { doc, clip } = setup({ fadeInUs: 1_000_000 }, 0.8);
    expect(gainFor(clip, doc, 1_500_000)).toBeCloseTo(0.4);
    expect(gainFor(clip, doc)).toBeCloseTo(0.8); // static
  });

  it("automation has corner points that reproduce the envelope exactly", () => {
    const { doc, clip } = setup({ fadeInUs: 1_000_000, fadeOutUs: 1_000_000 }, 0.5);
    const points = volumeAutomation(clip, doc, 1_000_000, 5_000_000)!;
    expect(points.map((p) => p.atTimelineUs)).toEqual([1_000_000, 2_000_000, 4_000_000, 5_000_000]);
    expect(points.map((p) => p.value)).toEqual([0, 0.5, 0.5, 0]);
  });

  it("no fades, no keyframes → no automation", () => {
    const { doc, clip } = setup({});
    expect(volumeAutomation(clip, doc, 1_000_000, 5_000_000)).toBeNull();
  });

  it("live playback schedules the fade automation", async () => {
    const { project } = setup({ fadeInUs: 1_000_000 });
    const output = new FakeOutput();
    const engine = new AudioEngine(project, output, openFakeAudio(10_000_000));
    engine.start(1_000_000);
    await settle();
    const automation = output.channels.get("c1")!.automation!;
    expect(automation[0]!.value).toBe(0);
    expect(automation.find((p) => p.atOutputUs === output.nowUs + 1_000_000)?.value).toBeCloseTo(1);
    engine.dispose();
  });

  it("export plans a job for a faded clip", () => {
    const { doc } = setup({ fadeOutUs: 500_000 });
    expect(planAudioJobs(doc, { startUs: 0, endUs: 6_000_000 })).toHaveLength(1);
  });
});

function pcmChunk(timestampUs: number, sampleRate: number, channels: number[][]): AudioChunk {
  const data = channels.map((c) => Float32Array.from(c));
  return {
    timestampUs,
    durationUs: (data[0]!.length / sampleRate) * 1_000_000,
    native: { numberOfChannels: data.length, sampleRate, getChannelData: (i: number) => data[i]! },
  };
}

describe("waveform peaks", () => {
  it("takes the max |sample| per bucket across channels", () => {
    // 10 samples/s, buckets of 0.5 s → 5 samples per bucket.
    const peaks = new Float32Array(2);
    accumulatePeaks(peaks, 500_000, pcmChunk(0, 10, [
      [0.1, -0.3, 0.2, 0, 0, 0.1, 0.1, 0.1, 0.1, 0.1],
      [0, 0, 0, 0, 0, 0, 0, -0.9, 0, 0],
    ]));
    expect(peaks[0]).toBeCloseTo(0.3);
    expect(peaks[1]).toBeCloseTo(0.9);
  });

  it("streams a source and clamps to 0..1", async () => {
    const chunks = [pcmChunk(0, 4, [[0.5, 0.5, 0.5, 0.5]]), pcmChunk(1_000_000, 4, [[1.5, 0, 0, 0]])];
    const source: AudioTrackSource = {
      async *chunksFrom() {
        yield* chunks;
      },
      dispose() {},
    };
    const wf = await computeWaveformPeaks(source, { durationUs: 2_000_000, bucketsPerSecond: 1 });
    expect(Array.from(wf.peaks)).toEqual([0.5, 1]);
    expect(wf.bucketUs).toBe(1_000_000);
  });

  it("downsamples a media range to drawing columns", () => {
    const wf = { peaks: Float32Array.from([0.1, 0.2, 0.9, 0.3]), bucketUs: 1_000_000, durationUs: 4_000_000 };
    expect(Array.from(peaksForRange(wf, 0, 4_000_000, 2)).map((v) => +v.toFixed(2))).toEqual([0.2, 0.9]);
    expect(Array.from(peaksForRange(wf, 2_000_000, 3_000_000, 2)).map((v) => +v.toFixed(2))).toEqual([0.9, 0.9]);
  });
});
