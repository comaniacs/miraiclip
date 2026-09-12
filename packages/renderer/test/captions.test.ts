import { describe, expect, it } from "vitest";
import { createProject, type CaptionWord, type ProjectDocument } from "@miraiclip/core";
import {
  POP_SCALE,
  captionProgress,
  layoutCaption,
  wordAppearance,
} from "../src/captions/layout.js";
import { loadFontAssets, type FontEnv } from "../src/captions/fonts.js";
import { Compositor } from "../src/compositor/compositor.js";
import { FakeBackend } from "./scene-fakes.js";

const WORDS: CaptionWord[] = [
  { text: "made", startUs: 0, durationUs: 300_000 },
  { text: "with", startUs: 300_000, durationUs: 300_000 },
  // A gap 600ms → 800ms, then the last word.
  { text: "miraiclip", startUs: 800_000, durationUs: 400_000 },
];

describe("caption timing", () => {
  it("tracks the containing word and the started count", () => {
    expect(captionProgress(WORDS, -1)).toEqual({ activeIndex: -1, startedCount: 0 });
    expect(captionProgress(WORDS, 0)).toEqual({ activeIndex: 0, startedCount: 1 });
    expect(captionProgress(WORDS, 299_999)).toEqual({ activeIndex: 0, startedCount: 1 });
    expect(captionProgress(WORDS, 300_000)).toEqual({ activeIndex: 1, startedCount: 2 });
    // In the gap: nothing is active, but two words have started.
    expect(captionProgress(WORDS, 700_000)).toEqual({ activeIndex: -1, startedCount: 2 });
    expect(captionProgress(WORDS, 900_000)).toEqual({ activeIndex: 2, startedCount: 3 });
    // Past the last word: nothing active, everything started (karaoke stays lit).
    expect(captionProgress(WORDS, 2_000_000)).toEqual({ activeIndex: -1, startedCount: 3 });
  });

  it("presets: plain never lights, highlight/pop follow the active word, karaoke is progressive", () => {
    const at = (us: number) => captionProgress(WORDS, us);
    expect(wordAppearance("plain", 0, at(100_000)).highlighted).toBe(false);

    expect(wordAppearance("highlight", 0, at(100_000)).highlighted).toBe(true);
    expect(wordAppearance("highlight", 1, at(100_000)).highlighted).toBe(false);
    expect(wordAppearance("highlight", 0, at(400_000)).highlighted).toBe(false);

    // Karaoke: word 0 STAYS lit while word 1 is active.
    expect(wordAppearance("karaoke", 0, at(400_000)).highlighted).toBe(true);
    expect(wordAppearance("karaoke", 1, at(400_000)).highlighted).toBe(true);
    expect(wordAppearance("karaoke", 2, at(400_000)).highlighted).toBe(false);

    expect(wordAppearance("pop", 1, at(400_000))).toEqual({ highlighted: true, scale: POP_SCALE });
    expect(wordAppearance("pop", 0, at(400_000))).toEqual({ highlighted: false, scale: 1 });
  });
});

describe("caption layout", () => {
  // Fake measurement: 10px per character.
  const measure = (words: CaptionWord[]) => (i: number) => words[i]!.text.length * 10;

  it("wraps greedily at maxWidth and centers each line", () => {
    const words: CaptionWord[] = [
      { text: "aaaa", startUs: 0, durationUs: 1 }, // 40px
      { text: "bb", startUs: 1, durationUs: 1 }, // 20px
      { text: "cccccc", startUs: 2, durationUs: 1 }, // 60px
    ];
    // Line 1: 40 + 10 + 20 = 70 ≤ 80; adding cccccc (10+60) would exceed 80.
    const layout = layoutCaption(words, {
      maxWidthPx: 80,
      lineHeightPx: 20,
      spaceWidthPx: 10,
      measure: measure(words),
    });
    expect(layout.widthPx).toBe(70);
    expect(layout.heightPx).toBe(40);
    // Line 1 centers around 0: aaaa center at -35+20=-15, bb at -35+40+10+10=25.
    expect(layout.positions[0]).toEqual({ xPx: -15, yPx: -10 });
    expect(layout.positions[1]).toEqual({ xPx: 25, yPx: -10 });
    // Line 2: cccccc alone, centered.
    expect(layout.positions[2]).toEqual({ xPx: 0, yPx: 10 });
  });

  it("never wraps a single over-wide word (it gets its own line)", () => {
    const words: CaptionWord[] = [{ text: "aaaaaaaaaaaa", startUs: 0, durationUs: 1 }]; // 120px
    const layout = layoutCaption(words, {
      maxWidthPx: 80,
      lineHeightPx: 20,
      spaceWidthPx: 10,
      measure: measure(words),
    });
    expect(layout.widthPx).toBe(120);
    expect(layout.positions[0]).toEqual({ xPx: 0, yPx: 0 });
  });
});

describe("font asset loading", () => {
  function docWith(assets: Record<string, { kind: string; src: string; family?: string }>): ProjectDocument {
    const project = createProject({ width: 100, height: 100, fps: 30 });
    project.transaction(() => {
      for (const [id, a] of Object.entries(assets)) {
        project.dispatch({ type: "asset/add", payload: { id, ...a } });
      }
    });
    return project.getState().doc;
  }

  function fakeEnv() {
    const created: string[] = [];
    const added: string[] = [];
    const env: FontEnv = {
      available: true,
      createFace: (family, src) => {
        created.push(`${family}|${src}`);
        return {
          load: () =>
            src.includes("broken") ? Promise.reject(new Error("404")) : Promise.resolve(family),
        };
      },
      addFace: () => added.push("added"),
    };
    return { env, created, added };
  }

  it("loads each font once, skips non-font assets, and dedupes across calls", async () => {
    const doc = docWith({
      f1: { kind: "font", src: "/f1.woff2", family: "Brand" },
      img: { kind: "image", src: "/a.png" },
    });
    const { env, created, added } = fakeEnv();
    expect(await loadFontAssets(doc, env)).toBe(true);
    expect(created).toEqual(["Brand|/f1.woff2"]);
    expect(added).toEqual(["added"]);
    // Second call: nothing new to load.
    expect(await loadFontAssets(doc, env)).toBe(false);
    expect(created.length).toBe(1);
  });

  it("a failing font logs and resolves false without blocking the good ones", async () => {
    const doc = docWith({
      bad: { kind: "font", src: "/broken.woff2", family: "Broken" },
      good: { kind: "font", src: "/ok.woff2", family: "Ok" },
    });
    const { env, added } = fakeEnv();
    expect(await loadFontAssets(doc, env)).toBe(true); // the good one landed
    expect(added).toEqual(["added"]);
  });

  it("no-ops outside a browser (no FontFace)", async () => {
    const doc = docWith({ f1: { kind: "font", src: "/f.woff2", family: "X" } });
    expect(await loadFontAssets(doc, { ...fakeEnv().env, available: false })).toBe(false);
  });
});

describe("caption clips in the compositor", () => {
  it("creates a caption node via the backend and toggles visibility by time", () => {
    const project = createProject({ width: 1000, height: 500, fps: 30 });
    project.transaction(() => {
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({
        type: "clip/add",
        payload: {
          kind: "caption",
          id: "cap",
          trackId: "v1",
          startUs: 1_000_000,
          durationUs: 1_000_000,
          words: [{ text: "hello", startUs: 0, durationUs: 500_000 }],
        },
      });
    });
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend);
    const node = backend.nodes.find((n) => n.kind === "caption")!;
    expect(node).toBeDefined();
    compositor.renderAt(500_000);
    expect(node.visible).toBe(false);
    compositor.renderAt(1_500_000);
    expect(node.visible).toBe(true);
    compositor.destroy();
  });
});
