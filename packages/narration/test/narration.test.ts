import { describe, expect, it } from "vitest";
import { applyCommands, createProject, evaluateClipAt, isAudioClip, isVideoClip, type Project } from "@miraiclip/core";
import type { Transcript } from "@miraiclip/transcript";
import { alignNarration, parseJsonReply, rewriteScript, scriptFromMarkers, scriptFromTranscript, synthesizeNarration, type NarrationTake, type Script } from "../src/index.js";

const S = 1_000_000;

function project(): Project {
  const p = createProject({ width: 1280, height: 720, fps: 30 });
  const r = applyCommands(p, [
    { type: "asset/add", payload: { id: "screen", kind: "video", src: "screen.webm", durationUs: 12 * S } },
    { type: "asset/add", payload: { id: "cam", kind: "video", src: "cam.webm", durationUs: 12 * S } },
    { type: "track/add", payload: { id: "v", kind: "video" } },
    { type: "track/add", payload: { id: "c", kind: "video" } },
    { type: "clip/add", payload: { kind: "video", id: "screen", trackId: "v", assetId: "screen", startUs: 0, durationUs: 12 * S } },
    { type: "clip/add", payload: { kind: "video", id: "cam", trackId: "c", assetId: "cam", startUs: 0, durationUs: 12 * S } },
    { type: "marker/add", payload: { id: "s1", timeUs: 0, label: "Open settings" } },
    { type: "marker/add", payload: { id: "s2", timeUs: 4 * S, label: "Turn on dark mode" } },
    { type: "marker/add", payload: { id: "s3", timeUs: 8 * S, label: "Save" } },
  ]);
  expect(r.ok).toBe(true);
  return p;
}

const transcript: Transcript = {
  assetId: "screen",
  language: "en",
  words: [
    { text: "So", startUs: 0.5 * S, endUs: 0.7 * S },
    { text: "um", startUs: 0.8 * S, endUs: 1.0 * S },
    { text: "open", startUs: 1.1 * S, endUs: 1.4 * S },
    { text: "settings.", startUs: 1.5 * S, endUs: 2.0 * S },
    { text: "Then", startUs: 4.5 * S, endUs: 4.8 * S },
    { text: "dark", startUs: 5.0 * S, endUs: 5.3 * S },
    { text: "mode.", startUs: 5.4 * S, endUs: 5.8 * S },
  ],
};

const take = (segmentId: string, seconds: number): NarrationTake => ({ segmentId, src: `${segmentId}.mp3`, mimeType: "audio/mpeg", durationUs: seconds * S, text: segmentId });
const apply = (p: Project, commands: { type: string; payload: Record<string, unknown> }[]) => {
  const r = applyCommands(p, commands);
  expect(r.ok, JSON.stringify(!r.ok && r.error)).toBe(true);
  return p.getState().doc;
};

describe("scripts", () => {
  it("one line per marker, filled with what was said (or the step name)", () => {
    const script = scriptFromMarkers(project().getState().doc, { transcript });
    expect(script.segments.map((s) => [s.id, s.startUs, s.text])).toEqual([
      ["line-s1", 0, "So um open settings."],
      ["line-s2", 4 * S, "Then dark mode."],
      ["line-s3", 8 * S, "Save"],
    ]);
  });

  it("speech before the first step goes into the first step's line", () => {
    const p = project();
    apply(p, [{ type: "marker/update", payload: { markerId: "s1", timeUs: 1.2 * S } }]);
    const script = scriptFromMarkers(p.getState().doc, { transcript });
    expect(script.segments[0]).toMatchObject({ startUs: 1.2 * S, text: "So um open settings." });
  });

  it("lines from the transcript break at long pauses", () => {
    const script = scriptFromTranscript(project().getState().doc, transcript);
    expect(script.segments.map((s) => s.text)).toEqual(["So um open settings.", "Then dark mode."]);
  });

  it("rewrite: word budgets from step lengths, JSON reply (even fenced), missing lines kept", async () => {
    const doc = project().getState().doc;
    const script = scriptFromMarkers(doc, { transcript });
    let sent: { steps: { id: string; maxWords: number; seconds: number }[] } = { steps: [] };
    let system = "";
    const model = {
      async complete(req: { messages: { role: string; content: string }[] }) {
        system = req.messages[0]!.content;
        sent = JSON.parse(req.messages[1]!.content);
        return { content: 'Here you go:\n```json\n{"segments":[{"id":"line-s1","text":"Open Settings."},{"id":"line-s2","text":"Now switch on dark mode."}]}\n```' };
      },
    };
    const out = await rewriteScript(model, doc, script, { style: "friendly", wordsPerSecond: 2.5 });
    expect(sent.steps.map((s) => [s.id, s.seconds, s.maxWords])).toEqual([
      ["line-s1", 4, 10],
      ["line-s2", 4, 10],
      ["line-s3", 4, 10],
    ]);
    expect(system).toContain("Tone: friendly.");
    expect(out.segments.map((s) => s.text)).toEqual(["Open Settings.", "Now switch on dark mode.", "Save"]);
    expect(() => parseJsonReply("no json here")).toThrow();
  });
});

describe("synthesizeNarration", () => {
  it("generates, measures, stores, and reuses unchanged lines", async () => {
    const script: Script = { language: "en", segments: [{ id: "a", text: "Hello", startUs: 0 }, { id: "b", text: "World", startUs: S }] };
    // 0.5 s of 8-bit mono WAV at 8 kHz.
    const wav = new Uint8Array(44 + 4000);
    const v = new DataView(wav.buffer);
    wav.set([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32], 0);
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true);
    v.setUint32(28, 8000, true);
    wav.set([100, 97, 116, 97], 36);
    v.setUint32(40, 4000, true);
    const calls: string[] = [];
    const generator = { id: "fake", generate: async (req: { text: string }) => (calls.push(req.text), { data: wav, mimeType: "audio/wav" }) };
    const stored: string[] = [];
    const takes = await synthesizeNarration(generator, script, { store: async (_a, seg) => (stored.push(seg.id), `voice/${seg.id}.wav`) });
    expect(takes.map((t) => [t.segmentId, t.src, t.durationUs])).toEqual([
      ["a", "voice/a.wav", 500_000],
      ["b", "voice/b.wav", 500_000],
    ]);
    const edited = { ...script, segments: [script.segments[0]!, { ...script.segments[1]!, text: "Everyone" }] };
    const again = await synthesizeNarration(generator, edited, { store: async (_a, seg) => `voice/${seg.id}-2.wav`, reuse: takes });
    expect(calls).toEqual(["Hello", "World", "Everyone"]);
    expect(again.map((t) => t.src)).toEqual(["voice/a.wav", "voice/b-2.wav"]);
  });
});

describe("alignNarration", () => {
  const script = (p: Project) => scriptFromMarkers(p.getState().doc);

  it("freezes the step's last frame when a line is too long, keeping the camera in sync", () => {
    const p = project();
    const plan = alignNarration(p.getState().doc, script(p), [take("line-s1", 2), take("line-s2", 6), take("line-s3", 1)], { clipIds: ["screen"], linkedClipIds: ["cam"] });
    expect(plan.placements.map((x) => [x.segmentId, x.adjustment, x.deltaUs, x.startUs])).toEqual([
      ["line-s1", "none", 0, 0.25 * S],
      ["line-s2", "freeze", 2.6 * S, 4.25 * S],
      ["line-s3", "none", 0, 10.85 * S],
    ]);
    const doc = apply(p, plan.commands);
    // A held frame on both tracks, 8 s → 10.6 s.
    for (const track of ["v", "c"]) {
      const freeze = Object.values(doc.clips).find((c) => c.trackId === track && isVideoClip(c) && c.speed === 0)!;
      expect([freeze.startUs, freeze.durationUs]).toEqual([8 * S, 2.6 * S]);
    }
    expect(doc.markers!["s3"]!.timeUs).toBe(10.6 * S);
    // Voice clips, original muted.
    const voices = Object.values(doc.clips).filter((c) => c.trackId === "narration");
    expect(voices.map((c) => c.startUs).sort((a, b) => a - b)).toEqual([0.25 * S, 4.25 * S, 10.85 * S]);
    for (const c of Object.values(doc.clips)) if (c.trackId !== "narration" && (isVideoClip(c) || isAudioClip(c))) expect(c.volume).toBe(0);
    p.undo();
    expect(Object.keys(p.getState().doc.clips).sort()).toEqual(["cam", "screen"]);
  });

  it("slow: stretches the step instead (down to minSpeed)", () => {
    const p = project();
    const plan = alignNarration(p.getState().doc, script(p), [take("line-s2", 6)], { clipIds: ["screen"], fit: "slow" });
    const doc = apply(p, plan.commands);
    const slowed = Object.values(doc.clips).find((c) => c.trackId === "v" && c.startUs === 4 * S)!;
    expect(isVideoClip(slowed) && slowed.speed).toBeCloseTo(4 / 6.6, 3);
    expect(slowed.durationUs).toBeCloseTo(6.6 * S, -2);
    expect(plan.placements[0]).toMatchObject({ adjustment: "slow", deltaUs: 2.6 * S });
    // Slower than minSpeed allows → slow to the limit, then hold.
    const q = project();
    const plan2 = alignNarration(q.getState().doc, script(q), [take("line-s2", 10)], { clipIds: ["screen"], fit: "slow" });
    const doc2 = apply(q, plan2.commands);
    const pieces = Object.values(doc2.clips).filter((c) => c.trackId === "v").sort((a, b) => a.startUs - b.startUs);
    expect(pieces.map((c) => (isVideoClip(c) ? (c.speed ?? 1) : 1))).toEqual([1, 0.5, 0, 1]);
  });

  it("speedUp: a step with little to say plays faster", () => {
    const p = project();
    const plan = alignNarration(p.getState().doc, script(p), [take("line-s1", 1)], { clipIds: ["screen"], speedUp: { maxSpeed: 2 } });
    const doc = apply(p, plan.commands);
    expect(plan.placements[0]).toMatchObject({ adjustment: "speed", deltaUs: -2 * S });
    const first = Object.values(doc.clips).find((c) => c.trackId === "v" && c.startUs === 0)!;
    expect(isVideoClip(first) && first.speed).toBe(2);
    expect(doc.markers!["s2"]!.timeUs).toBe(2 * S);
    // The rest of the recording follows straight after.
    const total = Math.max(...Object.values(doc.clips).filter((c) => c.trackId === "v").map((c) => c.startUs + c.durationUs));
    expect(total).toBe(10 * S);
  });

  it("an overlay keyed to the recording keeps its place when later content moves", () => {
    const p = project();
    p.dispatch({ type: "track/add", payload: { id: "o", kind: "video" } });
    p.dispatch({ type: "clip/add", payload: { kind: "html", id: "badge", trackId: "o", startUs: 9 * S, durationUs: S, template: "<b>x</b>" } });
    const doc = apply(p, alignNarration(p.getState().doc, script(p), [take("line-s2", 6)], { clipIds: ["screen"] }).commands);
    expect(doc.clips["badge"]!.startUs).toBe(9 * S + 2.6 * S);
    expect(evaluateClipAt(doc.clips["badge"]!, 0).opacity).toBe(1);
  });
});
