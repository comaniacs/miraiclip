import { describe, expect, it } from "vitest";
import { createProject, planSoundFromEvents } from "../src/index.js";

const US = 1_000_000;
const events = [
  { name: "land", t: 2, kind: "land", pan: -0.5 },
  { name: "press", t: 8.6, kind: "click", pan: 0.2 },
  { name: "shake", t: 8.6, kind: "shake", pan: 0 },
  { name: "tap", t: 8.64, kind: "click", pan: 0.2 },
  { name: "odd", t: 11, kind: "whoosh", pan: 0 },
];
const sounds = { land: { assetId: "thud", durationUs: 600_000 }, click: { assetId: "tick", durationUs: 200_000 }, shake: { assetId: "boom", durationUs: 3 * US } };

describe("planSoundFromEvents", () => {
  const plan = planSoundFromEvents({ events, sequenceStartUs: 10 * US, sounds, trackId: "sfx", music: { clipId: "m", startUs: 0, durationUs: 40 * US, volume: 0.8 } });

  it("places one clip per hit at its time on the composition timeline, with one sound per kind", () => {
    expect(plan.placements.map((p) => [p.clipId, p.assetId, p.atUs / US])).toEqual([["sfx1", "thud", 12], ["sfx2", "tick", 18.6], ["sfx3", "boom", 18.6]]);
    expect(plan.placements[2]!.durationUs).toBe(1.5 * US); // capped
    expect(plan.placements[0]!.pan).toBe(-0.5);
  });

  it("skips kinds with no sound and too-close repeats, and says why", () => {
    expect(plan.skipped.map((s) => s.eventName)).toEqual(["tap", "odd"]);
    expect(plan.skipped.find((s) => s.eventName === "odd")!.reason).toMatch(/whoosh/);
    expect(plan.skipped.find((s) => s.eventName === "tap")!.reason).toMatch(/too close/);
  });

  it("ducks the music under the hits and releases it, merging hits that are close", () => {
    expect(plan.ducks).toHaveLength(2);
    const k = plan.commands.filter((c) => c.type === "keyframe/set").map((c) => (c.payload as { timeUs: number; value: number }));
    expect(k).toHaveLength(8);
    expect(k[0]).toEqual(expect.objectContaining({ timeUs: 12 * US - 100_000, value: 0.8 }));
    expect(k[1]!.value).toBeCloseTo(0.28);
    expect(k[3]).toEqual(expect.objectContaining({ value: 0.8 }));
  });

  it("produces commands the engine accepts", () => {
    const project = createProject({ width: 1920, height: 1080, fps: 30 } as never);
    const run = (type: string, payload: object) => project.dispatch({ type, payload } as never);
    run("track/add", { id: "sfx", kind: "audio" });
    run("track/add", { id: "mus", kind: "audio" });
    for (const id of ["thud", "tick", "boom", "song"]) run("asset/add", { id, kind: "audio", name: id, src: `${id}.wav`, durationUs: 60 * US });
    run("clip/add", { id: "m", kind: "audio", trackId: "mus", assetId: "song", startUs: 0, durationUs: 40 * US, trimStartUs: 0, volume: 0.8 });
    for (const c of plan.commands) project.dispatch(c as never);
    const doc = project.toJSON();
    expect(Object.keys(doc.clips).filter((id) => id.startsWith("sfx"))).toHaveLength(3);
  });

  it("avoids existing clip ids", () => {
    const p = planSoundFromEvents({ events: events.slice(0, 1), sequenceStartUs: 0, sounds, trackId: "sfx", existingClipIds: ["sfx1", "sfx2"] });
    expect(p.placements[0]!.clipId).toBe("sfx3");
  });
});
