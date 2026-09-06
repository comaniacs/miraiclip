import { describe, expect, it } from "vitest";
import path from "node:path";
import { createProject, type ProjectDocument } from "@miraiclip/core";
import { contentTypeFor, resolveAssetSources } from "../src/assets.js";
import { parseCliArgs } from "../src/cli-args.js";

function docWith(assets: { id: string; src: string }[]): ProjectDocument {
  const project = createProject({ width: 320, height: 180, fps: 30 });
  project.transaction(() => {
    for (const a of assets) {
      project.dispatch({
        type: "asset/add",
        payload: { id: a.id, kind: "video", src: a.src, durationUs: 1_000_000 },
      });
    }
  });
  return project.getState().doc;
}

describe("resolveAssetSources", () => {
  it("rewrites local assets to /assets/<id> and maps their files", () => {
    const doc = docWith([{ id: "a", src: "media/clip.webm" }]);
    const { doc: rewritten, files } = resolveAssetSources(doc, {
      assetsDir: "/proj",
      exists: () => true,
    });
    expect(rewritten.assets["a"]!.src).toBe("/assets/a");
    expect(files.get("/assets/a")).toBe(path.resolve("/proj", "media/clip.webm"));
    // The input document is never mutated.
    expect(doc.assets["a"]!.src).toBe("media/clip.webm");
  });

  it("an explicit assets entry wins over the document src", () => {
    const doc = docWith([{ id: "a", src: "blob:whatever" }]);
    const { files } = resolveAssetSources(doc, {
      assets: { a: "/elsewhere/real.mp4" },
      exists: (p) => p === path.resolve("/elsewhere/real.mp4"),
    });
    expect(files.get("/assets/a")).toBe(path.resolve("/elsewhere/real.mp4"));
  });

  it("http(s) and data URLs pass through untouched", () => {
    const doc = docWith([
      { id: "web", src: "https://cdn.example.com/v.mp4" },
      { id: "inline", src: "data:video/mp4;base64,AAAA" },
    ]);
    const { doc: rewritten, files } = resolveAssetSources(doc, { exists: () => false });
    expect(rewritten.assets["web"]!.src).toBe("https://cdn.example.com/v.mp4");
    expect(rewritten.assets["inline"]!.src).toBe("data:video/mp4;base64,AAAA");
    expect(files.size).toBe(0);
  });

  it("a missing local file names the asset and how to fix it", () => {
    const doc = docWith([{ id: "gone", src: "nope.mp4" }]);
    expect(() => resolveAssetSources(doc, { exists: () => false })).toThrow(
      /asset "gone".*assets: \{ "gone"/s,
    );
  });

  it("asset ids are URL-encoded in the served path", () => {
    const doc = docWith([{ id: "my clip", src: "x.webm" }]);
    const { doc: rewritten } = resolveAssetSources(doc, { exists: () => true });
    expect(rewritten.assets["my clip"]!.src).toBe("/assets/my%20clip");
  });
});

describe("contentTypeFor", () => {
  it("maps common media extensions and falls back to octet-stream", () => {
    expect(contentTypeFor("/a/b.webm")).toBe("video/webm");
    expect(contentTypeFor("clip.MP4")).toBe("video/mp4");
    expect(contentTypeFor("song.wav")).toBe("audio/wav");
    expect(contentTypeFor("weird.bin")).toBe("application/octet-stream");
  });
});

describe("parseCliArgs", () => {
  it("parses a full invocation", () => {
    const parsed = parseCliArgs([
      "project.json", "--out", "out.webm", "--quality", "high", "--fps", "30",
      "--start", "1.5", "--end", "3", "--asset", "media=./clip.webm",
      "--assets-dir", "/media", "--browser", "/usr/bin/chrome", "--quiet",
    ]);
    expect(parsed.projectPath).toBe("project.json");
    expect(parsed.quiet).toBe(true);
    expect(parsed.options).toMatchObject({
      format: "webm", // inferred from --out
      out: "out.webm",
      quality: "high",
      fps: 30,
      range: { startUs: 1_500_000, endUs: 3_000_000 },
      assets: { media: "./clip.webm" },
      assetsDir: "/media",
      browser: { executablePath: "/usr/bin/chrome" },
    });
  });

  it("defaults format to mp4 unless the out path says webm", () => {
    expect(parseCliArgs(["p.json", "-o", "x.mp4"]).options.format).toBe("mp4");
    expect(parseCliArgs(["p.json", "-o", "x.webm"]).options.format).toBe("webm");
  });

  it("rejects missing out, lone --start, and unknown flags", () => {
    expect(() => parseCliArgs(["p.json"])).toThrow(/--out/);
    expect(() => parseCliArgs(["p.json", "-o", "x.mp4", "--start", "1"])).toThrow(/together/);
    expect(() => parseCliArgs(["p.json", "-o", "x.mp4", "--wat"])).toThrow(/unknown flag/);
  });
});
