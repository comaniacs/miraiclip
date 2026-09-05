import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { createPlayer } from "../src/player.js";
import { FakeDemuxer, createFakeDecoder } from "./fakes.js";
import { FakeBackend } from "./scene-fakes.js";
import { FakeOutput, openFakeAudio, settle } from "./audio-fakes.js";

function setup(overrides: { noRaf?: boolean } = {}) {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.dispatch({
    type: "asset/add",
    payload: { id: "vid", kind: "video", src: "/m.mp4", durationUs: 10_000_000 },
  });
  project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "video",
      id: "c1",
      trackId: "v1",
      assetId: "vid",
      startUs: 0,
      durationUs: 4_000_000,
    },
  });

  const output = new FakeOutput();
  const backend = new FakeBackend();
  // Manual frame scheduler: the test drives "animation frames" by hand.
  const pending: (() => void)[] = [];
  // Manual interval scheduler: the test fires the hidden-tab pump by hand.
  let pump: (() => void) | undefined;
  const player = createPlayer(project, {
    backend,
    openDemuxer: async () => new FakeDemuxer(300, 30),
    createDecoder: createFakeDecoder,
    audioOutput: output,
    openAudio: openFakeAudio(60_000_000),
    raf: (callback) => (overrides.noRaf ? 0 : pending.push(callback) - 1),
    cancelRaf: () => undefined,
    schedule: (callback) => {
      pump = callback;
      return 1;
    },
    cancelSchedule: () => {
      pump = undefined;
    },
  });
  const tick = () => pending.splice(0).forEach((callback) => callback());
  return { project, output, backend, player, tick, firePump: () => pump?.() };
}

describe("createPlayer", () => {
  it("renders, pushes the playhead into the core, and mixes audio on play", async () => {
    const { project, output, player, backend, tick } = setup();
    tick();
    expect(backend.renders).toBeGreaterThan(0);

    player.play();
    expect(output.resumed).toBe(1);
    expect(player.playing).toBe(true);
    await settle();
    expect(output.scheduled.length).toBeGreaterThan(0); // audio flowing

    output.nowUs += 1_000_000; // audio clock advances 1s
    tick();
    expect(player.timeUs).toBe(1_000_000); // master clock = audio clock
    expect(project.getState().playheadUs).toBe(1_000_000);
    expect(project.canUndo()).toBe(true); // setup commands only —
    project.undo(); // playhead moves never entered history
    expect(project.getState().doc.clips["c1"]).toBeUndefined();
    player.destroy();
  });

  it("pause stops audio; seek re-anchors it while playing", async () => {
    const { output, player } = setup();
    player.play();
    await settle();
    player.pause();
    expect(player.playing).toBe(false);
    expect(output.channels.get("c1")!.stops).toBeGreaterThan(0);

    player.play();
    await settle();
    const before = output.scheduled.length;
    output.nowUs += 500_000;
    player.seek(3_000_000);
    await settle();
    expect(player.timeUs).toBe(3_000_000);
    const next = output.scheduled[before]!;
    expect(next.whenUs).toBe(output.nowUs); // re-anchored at seek
    player.destroy();
  });

  it("keeps audio scheduling rolling in a hidden tab (no animation frames)", async () => {
    // rAF never fires — the tab is hidden — but the audio clock keeps running.
    const { output, player, firePump } = setup({ noRaf: true });
    player.play();
    await settle();
    const initiallyScheduled = output.scheduled.length;
    expect(initiallyScheduled).toBeGreaterThan(0);
    // Playback progresses past the initial scheduling window; only the
    // interval pump can extend it.
    output.nowUs += 2_500_000;
    firePump();
    await settle();
    expect(output.scheduled.length).toBeGreaterThan(initiallyScheduled);
    // End of composition is also detected without animation frames.
    output.nowUs += 5_000_000;
    firePump();
    expect(player.playing).toBe(false);
    expect(player.timeUs).toBe(4_000_000);
    player.destroy();
  });

  it("pauses at the end of the composition", async () => {
    const { output, player, tick } = setup();
    player.play();
    output.nowUs += 5_000_000; // past the 4s composition
    tick();
    expect(player.playing).toBe(false);
    expect(player.timeUs).toBe(4_000_000);
    expect(player.durationUs).toBe(4_000_000);
    player.destroy();
    expect(output.closed).toBe(true);
  });
});
