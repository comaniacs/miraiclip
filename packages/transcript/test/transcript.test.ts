import { describe, expect, it } from "vitest";
import { applyCommands, createProject, isCaptionClip, toSourceUs, type Project } from "@miraiclip/core";
import {
  captionCommands,
  createAsrHandler,
  cutCommands,
  deepgramAsr,
  deletedWords,
  detectFillers,
  detectRepeats,
  detectSilences,
  editByText,
  openAiAsr,
  planCleanup,
  rangesForWords,
  remoteAsr,
  transcriptOnTimeline,
  type Transcript,
} from "../src/index.js";

const S = 1_000_000;
const w = (text: string, start: number, end: number) => ({ text, startUs: Math.round(start * S), endUs: Math.round(end * S) });

// "Hello, um, welcome to the the demo. [2.5 s pause] Let's start."
const transcript: Transcript = {
  language: "en",
  assetId: "talk",
  words: [
    w("Hello,", 0.5, 0.9),
    w("um,", 1.0, 1.3),
    w("welcome", 1.4, 1.8),
    w("to", 1.85, 1.95),
    w("the", 2.0, 2.1),
    w("the", 2.2, 2.3),
    w("demo.", 2.35, 2.8),
    w("Let's", 5.3, 5.6),
    w("start.", 5.65, 6.0),
  ],
};

function project(): Project {
  const p = createProject({ width: 1280, height: 720, fps: 30 });
  const r = applyCommands(p, [
    { type: "asset/add", payload: { id: "talk", kind: "video", src: "talk.webm", durationUs: 8 * S } },
    { type: "asset/add", payload: { id: "cam", kind: "video", src: "cam.webm", durationUs: 8 * S } },
    { type: "track/add", payload: { id: "v", kind: "video" } },
    { type: "track/add", payload: { id: "c", kind: "video" } },
    { type: "clip/add", payload: { kind: "video", id: "talk", trackId: "v", assetId: "talk", startUs: 0, durationUs: 8 * S } },
    { type: "clip/add", payload: { kind: "video", id: "cam", trackId: "c", assetId: "cam", startUs: 0, durationUs: 8 * S } },
    { type: "marker/add", payload: { id: "m", timeUs: 5.3 * S, label: "Start" } },
  ]);
  expect(r.ok).toBe(true);
  return p;
}

const apply = (p: Project, commands: { type: string; payload: Record<string, unknown> }[]) => {
  const r = applyCommands(p, commands);
  expect(r.ok, JSON.stringify(!r.ok && r.error)).toBe(true);
  return p.getState().doc;
};

describe("detection", () => {
  it("finds fillers, stutters and long pauses", () => {
    expect(detectFillers(transcript).map((s) => s.text)).toEqual(["um,"]);
    const [filler] = detectFillers(transcript);
    // Widened to the middle of the pauses on each side.
    expect(filler).toMatchObject({ startUs: 0.95 * S, endUs: 1.35 * S });
    expect(detectRepeats(transcript)).toEqual([{ startUs: 2.0 * S, endUs: 2.2 * S, reason: "repeat", words: [4], text: "the" }]);
    const silences = detectSilences(transcript, { mediaDurationUs: 8 * S });
    expect(silences.map((s) => [s.startUs, s.endUs])).toEqual([
      [3.0 * S, 5.1 * S],
      [6.2 * S, 8 * S],
    ]);
  });

  it("phrases and custom filler lists", () => {
    const t: Transcript = { words: [w("you", 0, 0.1), w("know,", 0.15, 0.3), w("like", 0.4, 0.5), w("it", 0.6, 0.7)] };
    expect(detectFillers(t, { phrases: ["you know"] }).map((s) => s.words)).toEqual([[0, 1]]);
    expect(detectFillers(t, { fillers: ["like"] }).map((s) => s.text)).toEqual(["like"]);
  });
});

describe("text-based editing", () => {
  it("finds deleted words with a diff, ignoring punctuation and case", () => {
    expect(deletedWords(transcript, "Hello welcome to the demo. Let's start.")).toEqual([1, 4]);
    expect(deletedWords(transcript, "Hello welcome to demo start")).toEqual([1, 4, 5, 7]);
    expect(deletedWords(transcript, "hello, um, welcome to the the demo let's start")).toEqual([]);
    expect(rangesForWords(transcript, [7, 8])).toEqual([{ startUs: 4.05 * S, endUs: 6.0 * S }]); // from mid-pause to the end
  });

  it("deleting words ripples the media, its linked camera and later markers", () => {
    const p = project();
    const plan = editByText(p.getState().doc, transcript, "Hello, welcome to the demo. Let's start.", { linkedClipIds: ["cam"] });
    expect(plan.deleted).toEqual([1, 4]);
    const doc = apply(p, plan.commands);
    expect(plan.removedUs).toBe(0.4 * S + 0.175 * S); // each word plus half of the pause on either side
    // What the timeline says now.
    expect(transcriptOnTimeline(doc, transcript).map((x) => x.text).join(" ")).toBe("Hello, welcome to the demo. Let's start.");
    // The camera was cut at the same moments: both tracks end together.
    const ends = (track: string) => Math.max(...Object.values(doc.clips).filter((c) => c.trackId === track).map((c) => c.startUs + c.durationUs));
    expect(ends("v")).toBe(8 * S - plan.removedUs);
    expect(ends("c")).toBe(8 * S - plan.removedUs);
    expect(doc.markers!["m"]!.timeUs).toBe(5.3 * S - plan.removedUs);
    // No gaps on the media track.
    const pieces = Object.values(doc.clips).filter((c) => c.trackId === "v").sort((a, b) => a.startUs - b.startUs);
    for (let i = 1; i < pieces.length; i++) expect(pieces[i]!.startUs).toBe(pieces[i - 1]!.startUs + pieces[i - 1]!.durationUs);
    // One undo restores everything.
    p.undo();
    expect(Object.keys(p.getState().doc.clips).sort()).toEqual(["cam", "talk"]);
  });

  it("respects speed changes: the same words are cut at 2×", () => {
    const p = project();
    p.dispatch({ type: "clip/set-speed", payload: { clipId: "talk", speed: 2 } });
    const doc = apply(p, cutCommands(p.getState().doc, [{ startUs: 1 * S, endUs: 2 * S }], { clipIds: ["talk"] }).commands);
    const pieces = Object.values(doc.clips).filter((c) => c.trackId === "v").sort((a, b) => a.startUs - b.startUs);
    expect(pieces.map((c) => [c.startUs, c.durationUs])).toEqual([
      [0, 0.5 * S],
      [0.5 * S, 3 * S], // 4 s at 2× minus the 0.5 s cut
    ]);
    // The second piece starts at source 2 s.
    expect(toSourceUs(pieces[1]!, pieces[1]!.startUs)).toBe(2 * S);
  });
});

describe("planCleanup + captions", () => {
  it("removes fillers, stutters and pauses in one cut, then captions what's left with true timing", () => {
    const p = project();
    const plan = planCleanup(p.getState().doc, transcript, { linkedClipIds: ["cam"] });
    expect(plan.spans.map((s) => s.reason)).toEqual(["filler", "repeat", "silence", "silence"]);
    const doc = apply(p, plan.commands);
    const said = transcriptOnTimeline(doc, transcript);
    expect(said.map((x) => x.text)).toEqual(["Hello,", "welcome", "to", "the", "demo.", "Let's", "start."]);
    // The 2.5 s pause is down to 0.4 s.
    const demo = said.find((x) => x.text === "demo.")!;
    const lets = said.find((x) => x.text === "Let's")!;
    expect(lets.timelineStartUs - demo.timelineEndUs).toBe(0.4 * S); // 0.2 s kept on each side

    const captions = apply(p, captionCommands(doc, transcript, { trackId: "cap" }));
    const clips = Object.values(captions.clips).filter(isCaptionClip).sort((a, b) => a.startUs - b.startUs);
    expect(clips.flatMap((c) => c.words.map((x) => x.text))).toEqual(said.map((x) => x.text));
    // Each word lands exactly where the timeline plays it.
    const first = clips[0]!;
    expect(first.startUs + first.words[0]!.startUs).toBe(said[0]!.timelineStartUs);
  });
});

describe("ASR adapters", () => {
  const audio = new Uint8Array([1, 2, 3]);

  it("OpenAI: multipart verbose_json with word timestamps, punctuation restored from segments", async () => {
    let seen: { url: string; form?: FormData; auth?: string } = { url: "" };
    const provider = openAiAsr({
      apiKey: "sk-test",
      fetch: async (url, init) => {
        seen = { url, form: init?.body as FormData, auth: (init?.headers as Record<string, string>)["Authorization"] };
        return Response.json({
          language: "english",
          text: "Hello, world.",
          segments: [{ text: " Hello, world.", start: 0, end: 1 }],
          words: [
            { word: "Hello", start: 0, end: 0.4 },
            { word: "world", start: 0.5, end: 0.9 },
          ],
        });
      },
    });
    const t = await provider.transcribe(audio, { language: "en" });
    expect(seen.url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(seen.auth).toBe("Bearer sk-test");
    expect(seen.form!.get("response_format")).toBe("verbose_json");
    expect(seen.form!.getAll("timestamp_granularities[]")).toContain("word");
    expect(t).toEqual({ language: "en", words: [w("Hello,", 0, 0.4), w("world.", 0.5, 0.9)] });
  });

  it("Deepgram: raw audio body, filler words on, punctuated words and speakers", async () => {
    let url = "";
    const provider = deepgramAsr({
      apiKey: "dg",
      diarize: true,
      fetch: async (u) => {
        url = u;
        return Response.json({
          results: { channels: [{ detected_language: "en", alternatives: [{ words: [{ word: "uh", punctuated_word: "Uh,", start: 0, end: 0.2, confidence: 0.9, speaker: 0 }] }] }] },
        });
      },
    });
    const t = await provider.transcribe(audio);
    expect(url).toContain("filler_words=true");
    expect(url).toContain("diarize=true");
    expect(t.words).toEqual([{ text: "Uh,", startUs: 0, endUs: 0.2 * S, confidence: 0.9, speaker: "0" }]);
  });

  it("handler + remote proxy: the browser never holds the key", async () => {
    const fake = { id: "fake", label: "Fake", transcribe: async () => ({ language: "en", words: [w("hi", 0, 1)] }) };
    const handle = createAsrHandler([fake], { basePath: "/api/asr" });
    const remote = remoteAsr("https://app.test/api/asr", "fake", { fetch: async (url, init) => (await handle(new Request(url, init)))! });
    expect(await remote.transcribe(audio, { language: "en" })).toEqual({ language: "en", words: [w("hi", 0, 1)] });
    const missing = await handle(new Request("https://app.test/api/asr/nope/transcribe", { method: "POST", body: audio }));
    expect(missing!.status).toBe(404);
    expect(await handle(new Request("https://app.test/other"))).toBeNull();
  });
});
