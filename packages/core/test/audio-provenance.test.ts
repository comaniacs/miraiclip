import { describe, expect, it } from "vitest";
import { createProject, creditsFor, describeProject, licenseReport, type AudioClip } from "../src/index.js";

function setup() {
  const project = createProject({ width: 1920, height: 1080, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "a1", kind: "audio" } });
  project.dispatch({
    type: "asset/add",
    payload: {
      id: "song",
      kind: "audio",
      src: "https://example.com/song.mp3",
      durationUs: 30_000_000,
      name: "Calm Piano",
      source: { provider: "openverse", id: "abc", url: "https://openverse.org/audio/abc" },
      license: { id: "CC-BY-4.0", url: "https://creativecommons.org/licenses/by/4.0/", commercial: true, attributionRequired: true },
      attribution: "“Calm Piano” by Jane Doe (CC BY 4.0)",
    },
  });
  project.dispatch({
    type: "clip/add",
    payload: { kind: "audio", id: "c1", trackId: "a1", assetId: "song", startUs: 0, durationUs: 10_000_000, fadeInUs: 1_000_000, fadeOutUs: 2_000_000 },
  });
  const clip = () => project.getState().doc.clips.c1 as AudioClip;
  return { project, clip };
}

describe("asset provenance", () => {
  it("stores name, source, license and attribution on asset/add", () => {
    const { project } = setup();
    const asset = project.getState().doc.assets.song!;
    expect(asset.name).toBe("Calm Piano");
    expect(asset.source).toEqual({ provider: "openverse", id: "abc", url: "https://openverse.org/audio/abc" });
    expect(asset.license?.commercial).toBe(true);
  });

  it("leaves plain assets without provenance keys", () => {
    const project = createProject({ width: 100, height: 100, fps: 30 });
    project.dispatch({ type: "asset/add", payload: { id: "v", kind: "video", src: "/v.mp4" } });
    expect(Object.keys(project.getState().doc.assets.v!).sort()).toEqual(["id", "kind", "src"]);
  });

  it("asset/set-property sets and clears fields, undoably", () => {
    const { project } = setup();
    project.dispatch({ type: "asset/set-property", payload: { id: "song", attribution: null, name: "Piano" } });
    const asset = () => project.getState().doc.assets.song!;
    expect("attribution" in asset()).toBe(false);
    expect(asset().name).toBe("Piano");
    project.undo();
    expect(asset().attribution).toContain("Jane Doe");
    expect(() => project.dispatch({ type: "asset/set-property", payload: { id: "nope", name: "x" } })).toThrow(/no asset/);
  });

  it("rejects malformed licenses", () => {
    const { project } = setup();
    expect(() =>
      project.dispatch({ type: "asset/set-property", payload: { id: "song", license: { id: "CC0-1.0" } as never } }),
    ).toThrow();
  });
});

describe("audio fades", () => {
  it("stores fades on add and clears them with null", () => {
    const { project, clip } = setup();
    expect(clip().fadeInUs).toBe(1_000_000);
    project.dispatch({ type: "clip/set-property", payload: { clipId: "c1", fadeInUs: null, fadeOutUs: 500_000 } });
    expect("fadeInUs" in clip()).toBe(false);
    expect(clip().fadeOutUs).toBe(500_000);
  });

  it("splitting keeps each fade on its outer edge", () => {
    const { project, clip } = setup();
    project.dispatch({ type: "clip/split", payload: { clipId: "c1", atUs: 4_000_000, newClipId: "c2" } });
    const right = project.getState().doc.clips.c2 as AudioClip;
    expect(clip().fadeInUs).toBe(1_000_000);
    expect("fadeOutUs" in clip()).toBe(false);
    expect(right.fadeOutUs).toBe(2_000_000);
    expect("fadeInUs" in right).toBe(false);
  });

  it("rejects fades on clips without audio", () => {
    const { project } = setup();
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "t", trackId: "v1", startUs: 0, durationUs: 1_000_000, text: "x" } });
    expect(() => project.dispatch({ type: "clip/set-property", payload: { clipId: "t", fadeInUs: 1 } })).toThrow(/audio/);
  });

  it("shows up in the AI project summary", () => {
    const { project } = setup();
    const summary = describeProject(project.getState().doc);
    expect(summary).toContain('song "Calm Piano": audio');
    expect(summary).toContain("license CC-BY-4.0");
    expect(summary).toMatch(/fade-in .*fade-out/);
  });
});

describe("credits and license report", () => {
  it("credits used assets that ask for attribution, once each", () => {
    const { project } = setup();
    project.dispatch({ type: "clip/add", payload: { kind: "audio", id: "c3", trackId: "a1", assetId: "song", startUs: 20_000_000, durationUs: 1_000_000 } });
    expect(creditsFor(project.getState().doc)).toEqual(["“Calm Piano” by Jane Doe (CC BY 4.0)"]);
  });

  it("ignores unused assets and builds a fallback credit line", () => {
    const { project } = setup();
    project.dispatch({
      type: "asset/add",
      payload: { id: "sfx", kind: "audio", src: "/s.wav", name: "Whoosh", source: { provider: "freesound", id: "9" }, license: { id: "CC-BY-4.0", commercial: true, attributionRequired: true } },
    });
    expect(creditsFor(project.getState().doc)).toHaveLength(1); // sfx unused
    project.dispatch({ type: "clip/add", payload: { kind: "audio", id: "c4", trackId: "a1", assetId: "sfx", startUs: 12_000_000, durationUs: 1_000_000 } });
    expect(creditsFor(project.getState().doc)).toContain("Whoosh (CC-BY-4.0)");
  });

  it("reports non-commercial, unknown and missing-attribution assets", () => {
    const { project } = setup();
    project.dispatch({
      type: "asset/add",
      payload: { id: "nc", kind: "audio", src: "/nc.mp3", source: { provider: "freesound", id: "1" }, license: { id: "CC-BY-NC-4.0", commercial: false, attributionRequired: true } },
    });
    project.dispatch({ type: "asset/add", payload: { id: "mystery", kind: "audio", src: "/m.mp3", source: { provider: "openverse", id: "2" } } });
    project.dispatch({ type: "asset/add", payload: { id: "mine", kind: "audio", src: "/mine.mp3" } });
    for (const [i, id] of ["nc", "mystery", "mine"].entries()) {
      project.dispatch({ type: "clip/add", payload: { kind: "audio", id: `x${i}`, trackId: "a1", assetId: id, startUs: 11_000_000 + i * 2_000_000, durationUs: 1_000_000 } });
    }
    const doc = project.getState().doc;
    expect(licenseReport(doc).map((i) => `${i.assetId}:${i.kind}`).sort()).toEqual(["mystery:unknown-license", "nc:missing-attribution"]);
    expect(licenseReport(doc, { commercial: true }).map((i) => `${i.assetId}:${i.kind}`).sort()).toEqual([
      "mystery:unknown-license",
      "nc:missing-attribution",
      "nc:non-commercial",
    ]);
  });
});
