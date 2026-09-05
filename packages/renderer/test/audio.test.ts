import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { AudioEngine } from "../src/audio/audio-engine.js";
import { FakeOutput, openFakeAudio, settle } from "./audio-fakes.js";

const CHUNK = 500_000;

function setup(options?: { trimStartUs?: number; startUs?: number; aheadUs?: number }) {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.dispatch({
    type: "asset/add",
    payload: { id: "vid", kind: "video", src: "/m.mp4", durationUs: 60_000_000 },
  });
  project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "video",
      id: "c1",
      trackId: "v1",
      assetId: "vid",
      startUs: options?.startUs ?? 0,
      durationUs: 10_000_000,
      trimStartUs: options?.trimStartUs ?? 0,
      volume: 0.8,
    },
  });
  const output = new FakeOutput();
  const engine = new AudioEngine(project, output, openFakeAudio(60_000_000), {
    aheadUs: options?.aheadUs ?? 2_000_000,
  });
  return { project, output, engine };
}

describe("AudioEngine", () => {
  it("schedules chunks against the output clock with clip gain", async () => {
    const { output, engine } = setup();
    engine.start(0);
    await settle();
    expect(output.scheduled.length).toBeGreaterThanOrEqual(4); // 2s ahead / 500ms
    const first = output.scheduled[0]!;
    expect(first.whenUs).toBe(output.nowUs); // timeline 0 plays now
    expect(first.offsetUs).toBe(0);
    expect(output.channels.get("c1")?.gainValue).toBeCloseTo(0.8);
    // Deadlines are spaced by chunk duration on the output clock.
    expect(output.scheduled[1]!.whenUs - first.whenUs).toBe(CHUNK);
    engine.dispose();
  });

  it("starting mid-chunk plays the straddling chunk with an offset", async () => {
    const { output, engine } = setup();
    engine.start(750_000); // halfway into chunk 1 (500k..1000k)
    await settle();
    const first = output.scheduled[0]!;
    expect(first.whenUs).toBe(output.nowUs);
    expect(first.offsetUs).toBe(250_000);
    expect(first.durationUs).toBe(250_000);
    engine.dispose();
  });

  it("maps media time through clip start and trim", async () => {
    const { output, engine } = setup({ startUs: 2_000_000, trimStartUs: 1_000_000 });
    engine.start(2_000_000); // clip's first sample = media 1s
    await settle();
    const first = output.scheduled[0]!;
    expect((first.native as { chunk: number }).chunk).toBe(2); // media 1s → chunk 2
    expect(first.whenUs).toBe(output.nowUs);
    engine.dispose();
  });

  it("parks at the window edge and resumes on pump", async () => {
    const { output, engine } = setup({ aheadUs: 1_000_000 });
    engine.start(0);
    await settle();
    const afterStart = output.scheduled.length; // ~2 chunks (1s window)
    expect(afterStart).toBeLessThanOrEqual(3);
    engine.pump(2_000_000); // clock advanced
    await settle();
    expect(output.scheduled.length).toBeGreaterThan(afterStart);
    engine.dispose();
  });

  it("stop halts scheduling; a later start re-anchors cleanly (seek)", async () => {
    const { output, engine } = setup();
    engine.start(0);
    await settle();
    engine.stop();
    const stopsAfter = output.channels.get("c1")!.stops;
    expect(stopsAfter).toBeGreaterThan(0);
    const count = output.scheduled.length;
    await settle();
    expect(output.scheduled.length).toBe(count); // nothing new after stop

    output.nowUs = 20_000_000;
    engine.start(5_000_000);
    await settle();
    const next = output.scheduled[count]!;
    expect(next.whenUs).toBe(20_000_000);
    expect((next.native as { chunk: number }).chunk).toBe(10); // media 5s
    engine.dispose();
  });

  it("does not schedule past the clip's end", async () => {
    const { output, engine } = setup({ aheadUs: 30_000_000 });
    engine.start(9_000_000); // clip ends at 10s
    await settle();
    const last = output.scheduled.at(-1)!;
    // Final chunk is clamped to the clip boundary.
    expect(last.durationUs).toBeLessThanOrEqual(CHUNK);
    const lastEndTimeline = 9_000_000 + output.scheduled.reduce((s, c) => s + c.durationUs, 0);
    expect(lastEndTimeline).toBeLessThanOrEqual(10_000_000);
    engine.dispose();
  });

  it("track mute and solo drive the gain to zero", async () => {
    const { project, output, engine } = setup();
    engine.start(0);
    await settle();
    project.dispatch({ type: "track/set-property", payload: { trackId: "v1", muted: true } });
    expect(output.channels.get("c1")?.gainValue).toBe(0);
    project.dispatch({ type: "track/set-property", payload: { trackId: "v1", muted: false } });
    expect(output.channels.get("c1")?.gainValue).toBeCloseTo(0.8);
    // Solo on another track silences this one.
    project.dispatch({ type: "track/add", payload: { id: "a1", kind: "audio" } });
    project.dispatch({ type: "track/set-property", payload: { trackId: "a1", solo: true } });
    expect(output.channels.get("c1")?.gainValue).toBe(0);
    engine.dispose();
  });

  it("assets without an audio track schedule nothing and don't crash", async () => {
    const project = createProject({ width: 100, height: 100, fps: 30 });
    project.dispatch({
      type: "asset/add",
      payload: { id: "silent", kind: "video", src: "/s.mp4" },
    });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "video",
        id: "c1",
        trackId: "v1",
        assetId: "silent",
        startUs: 0,
        durationUs: 5_000_000,
      },
    });
    const output = new FakeOutput();
    const engine = new AudioEngine(
      project,
      output,
      openFakeAudio(60_000_000, new Set(["silent"])),
    );
    engine.start(0);
    await settle();
    expect(output.scheduled).toHaveLength(0);
    engine.dispose();
  });

  it("rate scales output deadlines", async () => {
    const { output, engine } = setup();
    engine.start(0, 2);
    await settle();
    const [a, b] = output.scheduled;
    expect(b!.whenUs - a!.whenUs).toBe(CHUNK / 2); // 2× rate → half the wall time
    expect(a!.rate).toBe(2);
    engine.dispose();
  });
});
