import { describe, expect, it } from "vitest";
import {
  captionClipsFromAsrWords,
  captionClipsFromSubtitles,
  parseSubtitles,
  wordsFromCue,
} from "../src/captions.js";
import { createProject } from "../src/engine.js";
import type { CaptionClip } from "../src/types.js";

const SRT = `1
00:00:01,000 --> 00:00:02,500
Hello brave new

2
00:00:03,000 --> 00:00:04,000
<i>world</i> of video
`;

const VTT = `WEBVTT

NOTE this is a comment

00:00:01.000 --> 00:00:02.500 align:middle
Hello brave new
`;

describe("parseSubtitles", () => {
  it("parses SRT cues with µs timing and strips tags", () => {
    const cues = parseSubtitles(SRT);
    expect(cues).toEqual([
      { startUs: 1_000_000, endUs: 2_500_000, text: "Hello brave new" },
      { startUs: 3_000_000, endUs: 4_000_000, text: "world of video" },
    ]);
  });

  it("parses VTT (dot timestamps, headers/notes/settings ignored)", () => {
    const cues = parseSubtitles(VTT);
    expect(cues).toEqual([{ startUs: 1_000_000, endUs: 2_500_000, text: "Hello brave new" }]);
  });

  it("skips malformed and empty cues rather than throwing", () => {
    expect(parseSubtitles("garbage\n\n00:00:02,000 --> 00:00:01,000\nbackwards\n")).toEqual([]);
  });
});

describe("wordsFromCue", () => {
  it("splits the span evenly and the last word absorbs the remainder", () => {
    const words = wordsFromCue({ startUs: 0, endUs: 1_000_000, text: "a b c" });
    expect(words.map((w) => w.text)).toEqual(["a", "b", "c"]);
    expect(words[0]).toMatchObject({ startUs: 0, durationUs: 333_333 });
    expect(words[2]!.durationUs).toBe(1_000_000 - 2 * 333_333);
    const total = words.reduce((sum, w) => sum + w.durationUs, 0);
    expect(total).toBe(1_000_000); // tiles exactly
  });
});

describe("captionClipsFromSubtitles → dispatchable commands", () => {
  it("produces one caption clip per cue, dispatchable as-is", () => {
    const project = createProject({ width: 1080, height: 1920, fps: 30 });
    project.transaction(() => {
      project.dispatch({ type: "track/add", payload: { id: "captions", kind: "video" } });
      for (const command of captionClipsFromSubtitles(SRT, { trackId: "captions", style: { preset: "karaoke" } })) {
        project.dispatch(command);
      }
    });
    const clips = Object.values(project.getState().doc.clips) as CaptionClip[];
    expect(clips.length).toBe(2);
    expect(clips[0]).toMatchObject({ kind: "caption", startUs: 1_000_000, durationUs: 1_500_000 });
    expect(clips[0]!.style.preset).toBe("karaoke");
    expect(clips[0]!.words.map((w) => w.text)).toEqual(["Hello", "brave", "new"]);
    // Word times are clip-relative.
    expect(clips[0]!.words[0]!.startUs).toBe(0);
  });
});

describe("captionClipsFromAsrWords", () => {
  const words = [
    { text: "never", startS: 0.0, endS: 0.3 },
    { text: "gonna", startS: 0.3, endS: 0.55 },
    { text: "give", startS: 0.55, endS: 0.8 },
    // 1.2s silence gap → new group
    { text: "you", startS: 2.0, endS: 2.2 },
    { text: "up", startS: 2.2, endS: 2.5 },
  ];

  it("groups on silence gaps and keeps TRUE word timing (clip-relative)", () => {
    const commands = captionClipsFromAsrWords(words, { trackId: "captions", idPrefix: "cap" });
    expect(commands.length).toBe(2);
    const first = commands[0]!.payload as { id: string; startUs: number; durationUs: number; words: { startUs: number; durationUs: number }[] };
    expect(first.id).toBe("cap-1");
    expect(first.startUs).toBe(0);
    expect(first.durationUs).toBe(800_000);
    expect(first.words[1]).toMatchObject({ startUs: 300_000, durationUs: 250_000 });
    const second = commands[1]!.payload as { startUs: number };
    expect(second.startUs).toBe(2_000_000);
  });

  it("caps words per group", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      text: `w${i}`,
      startS: i * 0.2,
      endS: i * 0.2 + 0.15,
    }));
    const commands = captionClipsFromAsrWords(many, { trackId: "captions", maxWordsPerGroup: 6 });
    expect(commands.length).toBe(Math.ceil(20 / 6));
  });
});
