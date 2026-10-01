import { describe, expect, it } from "vitest";
import {
  captionsToSrt,
  captionsToText,
  captionsToVtt,
  createProject,
  parseSubtitles,
  retimeWords,
  type CaptionClip,
} from "../src/index.js";

function setup() {
  const project = createProject({ width: 1920, height: 1080, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "sub", kind: "video" } });
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "caption",
      id: "c1",
      trackId: "sub",
      startUs: 1_000_000,
      durationUs: 2_000_000,
      words: [
        { text: "hello", startUs: 0, durationUs: 1_000_000 },
        { text: "world", startUs: 1_000_000, durationUs: 1_000_000 },
      ],
    },
  });
  const clip = () => project.getState().doc.clips.c1 as CaptionClip;
  return { project, clip };
}

describe("caption style decorations", () => {
  it("accepts outline, shadow, case, word display, active box and the reveal preset", () => {
    const { project, clip } = setup();
    project.dispatch({
      type: "clip/set-property",
      payload: {
        clipId: "c1",
        style: {
          preset: "reveal",
          display: "word",
          textTransform: "uppercase",
          strokeColor: "#000000",
          strokeWidthFrac: 0.1,
          shadowColor: "#000000",
          shadowBlurFrac: 0.2,
          shadowOffsetFrac: 0,
          activeBackgroundColor: "#ff5700",
          backgroundColor: "#000000",
        },
      },
    });
    expect(clip().style).toMatchObject({ preset: "reveal", display: "word", textTransform: "uppercase", strokeWidthFrac: 0.1 });
  });

  it("clears decorations with null (switching styles must not leave a stale box)", () => {
    const { project, clip } = setup();
    project.dispatch({ type: "clip/set-property", payload: { clipId: "c1", style: { backgroundColor: "#000", strokeColor: "#fff" } } });
    project.dispatch({ type: "clip/set-property", payload: { clipId: "c1", style: { backgroundColor: null, strokeColor: null } } });
    expect("backgroundColor" in clip().style).toBe(false);
    expect("strokeColor" in clip().style).toBe(false);
  });

  it("leaves new documents without decoration keys", () => {
    const { clip } = setup();
    expect(Object.keys(clip().style).sort()).toEqual(["color", "fontFamily", "fontSizeFrac", "highlightColor", "preset"]);
  });

  it("rejects out-of-range decorations", () => {
    const { project } = setup();
    expect(() =>
      project.dispatch({ type: "clip/set-property", payload: { clipId: "c1", style: { strokeWidthFrac: 2 } } }),
    ).toThrow();
  });
});

describe("caption words", () => {
  it("replaces words via set-property (sorted), undoably", () => {
    const { project, clip } = setup();
    project.dispatch({
      type: "clip/set-property",
      payload: {
        clipId: "c1",
        words: [
          { text: "mundo", startUs: 1_000_000, durationUs: 1_000_000 },
          { text: "hola", startUs: 0, durationUs: 1_000_000 },
        ],
      },
    });
    expect(clip().words.map((w) => w.text)).toEqual(["hola", "mundo"]);
    project.undo();
    expect(clip().words.map((w) => w.text)).toEqual(["hello", "world"]);
  });

  it("rejects words on non-caption clips", () => {
    const { project } = setup();
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "t", trackId: "sub", startUs: 5_000_000, durationUs: 1_000_000, text: "x" } });
    expect(() =>
      project.dispatch({ type: "clip/set-property", payload: { clipId: "t", words: [{ text: "a", startUs: 0, durationUs: 1 }] } }),
    ).toThrow(/caption/);
  });

  it("retimeWords keeps timing for same-length edits and splits evenly otherwise", () => {
    const prev = [
      { text: "helo", startUs: 0, durationUs: 300_000 },
      { text: "world", startUs: 300_000, durationUs: 1_700_000 },
    ];
    expect(retimeWords(prev, "hello world", 2_000_000)).toEqual([
      { text: "hello", startUs: 0, durationUs: 300_000 },
      { text: "world", startUs: 300_000, durationUs: 1_700_000 },
    ]);
    const even = retimeWords(prev, "hola a todos", 3_000_000);
    expect(even.map((w) => [w.startUs, w.durationUs])).toEqual([
      [0, 1_000_000],
      [1_000_000, 1_000_000],
      [2_000_000, 1_000_000],
    ]);
    expect(retimeWords(prev, "   ", 2_000_000)).toEqual([]);
  });
});

describe("subtitle export", () => {
  const clips = [
    { startUs: 4_000_000, durationUs: 1_500_000, words: [{ text: "second", startUs: 0, durationUs: 1 }] },
    { startUs: 61_250_000, durationUs: 750_000, words: [{ text: "third", startUs: 0, durationUs: 1 }] },
    { startUs: 0, durationUs: 2_000_000, words: [{ text: "first", startUs: 0, durationUs: 1 }, { text: "cue", startUs: 1, durationUs: 1 }] },
  ];

  it("writes SRT in timeline order with comma milliseconds", () => {
    expect(captionsToSrt(clips)).toBe(
      "1\n00:00:00,000 --> 00:00:02,000\nfirst cue\n\n2\n00:00:04,000 --> 00:00:05,500\nsecond\n\n3\n00:01:01,250 --> 00:01:02,000\nthird\n",
    );
  });

  it("writes VTT and plain text", () => {
    expect(captionsToVtt(clips).startsWith("WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nfirst cue\n")).toBe(true);
    expect(captionsToText(clips)).toBe("first cue\nsecond\nthird\n");
  });

  it("round-trips through parseSubtitles", () => {
    for (const out of [captionsToSrt(clips), captionsToVtt(clips)]) {
      const cues = parseSubtitles(out);
      expect(cues.map((c) => [c.startUs, c.endUs, c.text])).toEqual([
        [0, 2_000_000, "first cue"],
        [4_000_000, 5_500_000, "second"],
        [61_250_000, 62_000_000, "third"],
      ]);
    }
  });
});

describe("variable font assets", () => {
  it("stores a weight range on font assets only", () => {
    const project = createProject({ width: 100, height: 100, fps: 30 });
    project.dispatch({ type: "asset/add", payload: { id: "f", kind: "font", src: "/f.woff2", family: "F", weightRange: [100, 900] } });
    expect(project.getState().doc.assets.f!.weightRange).toEqual([100, 900]);
    expect(() =>
      project.dispatch({ type: "asset/add", payload: { id: "v", kind: "video", src: "/v.mp4", weightRange: [100, 900] } }),
    ).toThrow(/font/);
    expect(() =>
      project.dispatch({ type: "asset/add", payload: { id: "g", kind: "font", src: "/g.woff2", family: "G", weightRange: [900, 100] } }),
    ).toThrow();
  });
});
