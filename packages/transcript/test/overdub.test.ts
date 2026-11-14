import { describe, expect, it } from "vitest";
import { applyCommands, createProject, type Project, type ProjectDocument } from "@miraiclip/core";
import { OverdubPlanError, overdubSlot, planOverdub, type Transcript } from "../src/index.js";

const sec = (n: number) => Math.round(n * 1_000_000);
const WORDS: Transcript["words"] = (
  [
    ["I", 0.2, 0.4],
    ["am", 0.5, 0.7],
    ["eighteen", 0.8, 1.4],
    ["years", 1.6, 1.9],
    ["old.", 2.0, 2.4],
  ] as const
).map(([text, s, e]) => ({ text, startUs: sec(s), endUs: sec(e) }));
const TRANSCRIPT: Transcript = { language: "en", assetId: "A", words: WORDS };
const EIGHTEEN = { assetId: "A", from: 2, to: 2, replaces: "eighteen" };

/** A 10 s clip of asset A on one track, optionally moved or trimmed. */
function doc(over: { startUs?: number; trimStartUs?: number } = {}): ProjectDocument {
  const p: Project = createProject({ width: 1080, height: 1920, fps: 30 });
  const trim = over.trimStartUs ?? 0;
  const r = applyCommands(p, [
    { type: "asset/add", payload: { id: "A", kind: "video", src: "asset://A", durationUs: sec(10) } },
    { type: "track/add", payload: { id: "v", kind: "video" } },
    {
      type: "clip/add",
      payload: { kind: "video", id: "A-clip", trackId: "v", assetId: "A", startUs: over.startUs ?? 0, trimStartUs: trim, durationUs: sec(10) - trim },
    },
  ]);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return p.getState().doc;
}

const take = (seconds: number, id = "T1") => ({ assetId: id, durationUs: sec(seconds), name: "Overdub", src: `asset://${id}` });

function applied(d: ProjectDocument, commands: Parameters<typeof applyCommands>[1]) {
  const p = createProject(structuredClone(d), { historyLimit: 1 });
  const r = applyCommands(p, commands);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return p.getState().doc;
}

describe("overdub", () => {
  it("finds the words and the pause after them on the timeline", () => {
    const slot = overdubSlot(doc(), TRANSCRIPT, EIGHTEEN);
    expect(slot).toMatchObject({ startUs: sec(0.8), endUs: sec(1.56), said: "eighteen" });
    expect(slot.spans).toHaveLength(1);
  });

  it("mutes only the old words and puts the new speech in their place", () => {
    const d = doc();
    const plan = planOverdub(d, overdubSlot(d, TRANSCRIPT, EIGHTEEN), take(0.5));
    const after = applied(d, plan.commands);
    const clips = Object.values(after.clips);
    const under = clips.filter((c) => c.trackId === "v" && c.startUs < sec(1.4) && c.startUs + c.durationUs > sec(0.9));
    expect(under.every((c) => (c as { volume?: number }).volume === 0)).toBe(true);
    const outside = clips.filter((c) => c.trackId === "v" && (c.startUs + c.durationUs <= sec(0.8) || c.startUs >= sec(1.56)));
    expect(outside.every((c) => (c as { volume?: number }).volume !== 0)).toBe(true);
    const spoken = after.clips["overdub-T1"];
    expect(spoken).toMatchObject({ trackId: "overdub", startUs: sec(0.8) });
    expect(after.tracks.overdub?.name).toBe("Overdub");
    expect(plan.speed).toBe(1);
  });

  it("speeds slightly long speech up to fit, and refuses what can't fit", () => {
    const d = doc();
    const slot = overdubSlot(d, TRANSCRIPT, EIGHTEEN);
    const fit = planOverdub(d, slot, take(0.84));
    expect(fit.speed).toBeCloseTo(0.84 / 0.76, 3);
    const clip = applied(d, fit.commands).clips["overdub-T1"];
    expect((clip?.startUs ?? 0) + (clip?.durationUs ?? 0)).toBeLessThanOrEqual(sec(1.56) + 1);
    expect(() => planOverdub(d, slot, take(1.2))).toThrowError(OverdubPlanError);
    expect(() => planOverdub(d, slot, take(1.2))).toThrowError(/room for 0.8 s/);
    // A looser limit takes it.
    expect(planOverdub(d, slot, take(1.2), { maxSpeedup: 2 }).speed).toBeGreaterThan(1.5);
  });

  it("follows a moved clip and a trim", () => {
    expect(overdubSlot(doc({ startUs: sec(3) }), TRANSCRIPT, EIGHTEEN).startUs).toBe(sec(3.8));
    expect(() => overdubSlot(doc({ trimStartUs: sec(1) }), TRANSCRIPT, EIGHTEEN)).toThrowError(/cut or trimmed/);
    expect(overdubSlot(doc({ trimStartUs: sec(0.5) }), TRANSCRIPT, EIGHTEEN).startUs).toBe(sec(0.3));
  });

  it("refuses cut words, a changed transcript and a bad pick", () => {
    expect(() => overdubSlot(doc({ trimStartUs: sec(2) }), TRANSCRIPT, EIGHTEEN)).toThrowError(/cut or trimmed/);
    expect(() => overdubSlot(doc(), TRANSCRIPT, { ...EIGHTEEN, replaces: "nineteen" })).toThrowError(/changed/);
    expect(() => overdubSlot(doc(), TRANSCRIPT, { ...EIGHTEEN, from: 3, to: 2 })).toThrowError(/next to each other/);
    expect(() => overdubSlot(doc(), TRANSCRIPT, { ...EIGHTEEN, to: 9 })).toThrowError(/next to each other/);
    expect(() => overdubSlot(doc(), TRANSCRIPT, { ...EIGHTEEN, to: 3 }, { maxWords: 1 })).toThrowError(/up to 1 words/);
  });

  it("replaces several words, and the last word of the clip", () => {
    const d = doc();
    expect(overdubSlot(d, TRANSCRIPT, { assetId: "A", from: 2, to: 3 })).toMatchObject({ startUs: sec(0.8), endUs: sec(1.96), said: "eighteen years" });
    const last = overdubSlot(d, TRANSCRIPT, { assetId: "A", from: 4, to: 4 });
    expect(last).toMatchObject({ startUs: sec(2.0), endUs: sec(2.4) });
    applied(d, planOverdub(d, last, take(0.3)).commands);
  });
});
