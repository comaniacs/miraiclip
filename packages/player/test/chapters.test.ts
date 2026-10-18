import { describe, expect, it } from "vitest";
import { chapterAt, chaptersFromMarkers, formatTime, normalizeChapters, parseVttChapters } from "../src/chapters.js";
import { resolveAssetSources } from "../src/engines.js";

describe("player chapters", () => {
  it("builds chapters from markers like core's markerChapters", () => {
    const chapters = chaptersFromMarkers(
      {
        b: { id: "b", timeUs: 2_000_000, label: "Demo", durationUs: 3_000_000 },
        a: { id: "a", timeUs: 0, label: "Intro" },
        c: { id: "c", timeUs: 6_000_000, label: "Wrap" },
      },
      10,
    );
    expect(chapters).toEqual([
      { id: "a", label: "Intro", start: 0, end: 2 },
      { id: "b", label: "Demo", start: 2, end: 5 },
      { id: "c", label: "Wrap", start: 6, end: 10 },
    ]);
    expect(chapterAt(chapters, 5.5)).toBeUndefined();
    expect(chapterAt(chapters, 6)?.id).toBe("c");
  });

  it("parses WebVTT chapter tracks and JSON lists", () => {
    const vtt = `WEBVTT\n\nintro\n00:00.000 --> 00:04.500\nIntro\n\n00:04.500 --> 01:02.000\nSetting up\n`;
    expect(parseVttChapters(vtt)).toEqual([
      { id: "intro", label: "Intro", start: 0, end: 4.5 },
      { id: "c2", label: "Setting up", start: 4.5, end: 62 },
    ]);
    expect(normalizeChapters([{ label: "B", start: 5 }, { title: "A", timeUs: 0 }], 9)).toEqual([
      { id: "c2", label: "A", start: 0, end: 5 },
      { id: "c1", label: "B", start: 5, end: 9 },
    ]);
    expect(normalizeChapters("nope", 1)).toEqual([]);
  });

  it("formats times and resolves relative asset paths against the document URL", () => {
    expect(formatTime(65.9)).toBe("1:05");
    expect(formatTime(3723)).toBe("1:02:03");
    const doc = { assets: { a: { src: "media/a.mp4" }, b: { src: "https://cdn.test/b.mp4" }, c: { src: "data:x" } } };
    const out = resolveAssetSources(doc, "https://site.test/videos/launch.json");
    expect(out.assets.a.src).toBe("https://site.test/videos/media/a.mp4");
    expect(out.assets.b.src).toBe("https://cdn.test/b.mp4");
    expect(out.assets.c.src).toBe("data:x");
    expect(doc.assets.a.src).toBe("media/a.mp4"); // not mutated
  });
});
