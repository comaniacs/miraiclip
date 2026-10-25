import { describe, expect, it } from "vitest";
import { analyzeBeats, beatAlignment, decodeAndAnalyzeBeats, snapToBeat } from "../src/index.js";
import { fixtures, prng, render } from "./beatsynth.js";

/** Fixtures whose bar has a clear first beat (a bass note or accent only on beat 1). */
const CLEAR_DOWNBEAT = new Set([72, 90, 140, 174, 70, 132]);

describe("analyzeBeats", () => {
  for (const track of fixtures()) {
    it(`${track.name}: tempo within 1 BPM, every beat within 40 ms`, () => {
      const { samples, sampleRate, expectedBeats } = render(track);
      const r = analyzeBeats({ samples, sampleRate });
      expect(Math.abs(r.bpm - track.bpm), `bpm ${r.bpm}`).toBeLessThanOrEqual(1);
      expect(r.confidence).toBeGreaterThan(0.6);
      // Every true beat is found, and nothing is found off the grid.
      for (const t of expectedBeats) expect(Math.abs(snapToBeat(t, r.beats) - t), `beat at ${t.toFixed(3)} s`).toBeLessThanOrEqual(0.04);
      for (const b of r.beats) expect(Math.abs(snapToBeat(b, expectedBeats) - b), `extra beat at ${b} s`).toBeLessThanOrEqual(0.04);
      expect(r.offset).toBe(r.beats[0]);
      expect(Math.abs(r.offset - track.startS)).toBeLessThanOrEqual(0.04);
      if (CLEAR_DOWNBEAT.has(track.bpm)) {
        const spb = 60 / track.bpm;
        for (const d of r.downbeats) expect(Math.abs(Math.round((d - track.startS) / spb) % 4), `downbeat at ${d} s`).toBe(0);
      }
      expect(r.downbeats.length).toBeGreaterThanOrEqual(Math.floor(r.beats.length / 4));
    });
  }

  it("keeps the octave and the beat: 70/72 don't read as 140/144, 174 not as 87, swung 82 not as 109 (¾ beat)", () => {
    const bpms = fixtures()
      .filter((t) => [70, 72, 82, 174].includes(t.bpm))
      .map((t) => analyzeBeats(render(t)).bpm);
    expect(bpms.map(Math.round).sort()).toEqual([174, 70, 72, 82].sort());
  });

  it("accepts several channels and an AudioBuffer-like object", () => {
    const { samples, sampleRate } = render(fixtures()[4]!);
    const stereo = analyzeBeats({ channels: [samples, samples], sampleRate });
    const buffer = analyzeBeats({ numberOfChannels: 1, sampleRate, getChannelData: () => samples });
    expect(stereo.bpm).toBeCloseTo(120, 0);
    expect(buffer.bpm).toBeCloseTo(120, 0);
  });

  it("is unsure about noise and finds nothing in silence", () => {
    const rand = prng(99);
    const noise = new Float32Array(22050 * 20).map(() => (rand() * 2 - 1) * 0.3);
    expect(analyzeBeats({ samples: noise, sampleRate: 22050 }).confidence).toBeLessThan(0.3);
    expect(analyzeBeats({ samples: new Float32Array(22050 * 5), sampleRate: 22050 })).toEqual({ bpm: 0, confidence: 0, beats: [], downbeats: [], offset: 0, durationS: 5 });
    expect(analyzeBeats({ samples: new Float32Array(0), sampleRate: 22050 }).beats).toEqual([]);
  });

  it("decoding needs Web Audio, and says so in Node", async () => {
    await expect(decodeAndAnalyzeBeats(new ArrayBuffer(8))).rejects.toThrow(/Web Audio/);
  });
});

describe("beatAlignment and snapToBeat", () => {
  const beats = [0.5, 1, 1.5, 2];
  it("snaps to the nearest beat", () => {
    expect(snapToBeat(0.74, beats)).toBe(0.5);
    expect(snapToBeat(0.76, beats)).toBe(1);
    expect(snapToBeat(-3, beats)).toBe(0.5);
    expect(snapToBeat(9, beats)).toBe(2);
    expect(snapToBeat(1.2, [])).toBe(1.2);
  });
  it("measures the share of times on the beat, within ±80 ms by default", () => {
    const r = beatAlignment([0.52, 1.07, 1.3, 2], beats);
    expect(r.share).toBe(0.75);
    expect(r.offBeat).toEqual([{ time: 1.3, nearest: 1.5, offsetS: -0.2 }]);
    expect(beatAlignment([1.07], beats, 0.05).share).toBe(0);
    expect(beatAlignment([], beats).share).toBe(1);
    expect(beatAlignment([1], []).share).toBe(0);
  });
});
