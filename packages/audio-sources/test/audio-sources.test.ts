import { describe, expect, it } from "vitest";
import { createProject, creditsFor, licenseReport, type AudioClip } from "@miraiclip/core";
import {
  audioToolDefinitions,
  createAudioLibrary,
  freesoundProvider,
  httpProvider,
  importAudio,
  openverseProvider,
  parseCreativeCommons,
  runAudioTool,
  staticProvider,
  type FetchLike,
} from "../src/index.js";

/** A fetch that answers from a route table and records requests. */
function fakeFetch(routes: Record<string, unknown | ((url: string, init?: RequestInit) => unknown)>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, ...(init ? { init } : {}) });
    const match = Object.keys(routes).find((r) => url.includes(r));
    if (!match) return new Response("not found", { status: 404 });
    const route = routes[match];
    const body = typeof route === "function" ? (route as (u: string, i?: RequestInit) => unknown)(url, init) : route;
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { fn, calls };
}

const project = () => createProject({ width: 1280, height: 720, fps: 30 });

describe("parseCreativeCommons", () => {
  it("reads codes, names and deed URLs", () => {
    expect(parseCreativeCommons("cc0")).toMatchObject({ id: "CC0-1.0", commercial: true, attributionRequired: false });
    expect(parseCreativeCommons("by-nc", "3.0")).toMatchObject({ id: "CC-BY-NC-3.0", commercial: false, attributionRequired: true });
    expect(parseCreativeCommons("http://creativecommons.org/licenses/by-sa/4.0/")).toMatchObject({
      id: "CC-BY-SA-4.0",
      url: "https://creativecommons.org/licenses/by-sa/4.0/",
      commercial: true,
    });
    expect(parseCreativeCommons("https://creativecommons.org/publicdomain/zero/1.0/")?.id).toBe("CC0-1.0");
    expect(parseCreativeCommons("Attribution Noncommercial")).toMatchObject({ id: "CC-BY-NC-4.0", commercial: false });
    expect(parseCreativeCommons("Creative Commons 0")?.id).toBe("CC0-1.0");
    expect(parseCreativeCommons("pdm")?.attributionRequired).toBe(false);
    expect(parseCreativeCommons("all rights reserved")).toBeNull();
  });
});

describe("openverseProvider", () => {
  const raw = {
    id: "ov-1",
    title: "Morning Walk",
    url: "https://cdn.example/walk.mp3",
    foreign_landing_url: "https://jamendo.example/walk",
    creator: "Jane",
    license: "by",
    license_version: "4.0",
    license_url: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "\"Morning Walk\" by Jane is licensed under CC BY 4.0.",
    category: "music",
    duration: 92_000,
    filetype: "mp3",
  };
  it("maps search params and results", async () => {
    const { fn, calls } = fakeFetch({ "/v1/audio/?": { result_count: 1, page_count: 3, results: [raw, { ...raw, id: "ov-2", license: "by-nc", license_url: null, category: "sound_effect", duration: 1200 }] } });
    const ov = openverseProvider({ fetch: fn, baseUrl: "/api/openverse" });
    const res = await ov.search!({ query: "walk", kind: "music", commercialOnly: true, maxDurationS: 120 });
    expect(calls[0]!.url).toBe("/api/openverse/v1/audio/?q=walk&page=1&page_size=20&category=music&license_type=commercial");
    // The NC sound effect is filtered out client-side (commercial + kind).
    expect(res.items.map((i) => i.id)).toEqual(["ov-1"]);
    expect(res.items[0]).toMatchObject({ kind: "music", durationUs: 92_000_000, creator: "Jane", previewUrl: raw.url, license: { id: "CC-BY-4.0" } });
    expect(res.hasMore).toBe(true);
    const resolved = await ov.resolve(res.items[0]!);
    expect(resolved).toMatchObject({ src: raw.url, mimeType: "audio/mpeg", source: { provider: "openverse", id: "ov-1", url: raw.foreign_landing_url }, attribution: raw.attribution });
  });

  it("getItem returns null on 404", async () => {
    const { fn } = fakeFetch({});
    expect(await openverseProvider({ fetch: fn }).getItem!("nope")).toBeNull();
  });
});

describe("freesoundProvider", () => {
  it("authenticates, filters by duration, and uses the HQ preview", async () => {
    const { fn, calls } = fakeFetch({
      "/search/text/": {
        count: 1,
        next: null,
        results: [{ id: 42, name: "whoosh.wav", username: "sam", license: "http://creativecommons.org/publicdomain/zero/1.0/", duration: 1.4, url: "https://freesound.org/s/42/", previews: { "preview-hq-mp3": "https://cdn.fs/42-hq.mp3" } }],
      },
    });
    const fs = freesoundProvider({ token: "k", fetch: fn });
    const res = await fs.search!({ query: "whoosh", maxDurationS: 3 });
    expect(calls[0]!.url).toContain("filter=duration%3A%5B0%20TO%203%5D");
    expect((calls[0]!.init!.headers as Record<string, string>).Authorization).toBe("Token k");
    expect(res.items[0]).toMatchObject({ id: "42", title: "whoosh", kind: "sfx", license: { id: "CC0-1.0" }, previewUrl: "https://cdn.fs/42-hq.mp3" });
    expect(res.items[0]!.attribution).toBeUndefined(); // CC0
    expect((await fs.resolve(res.items[0]!)).src).toBe("https://cdn.fs/42-hq.mp3");
  });
});

const demo = staticProvider({
  id: "demo",
  label: "Demo library",
  entries: [
    { id: "sunny", title: "Sunny Steps", src: "/media/audio/sunny-steps.webm", kind: "music", durationUs: 27_000_000, tags: ["upbeat", "acoustic"], license: parseCreativeCommons("cc0") },
    { id: "whoosh", title: "Whoosh", src: "/media/audio/sfx-whoosh.webm", kind: "sfx", durationUs: 900_000, tags: ["transition"], license: parseCreativeCommons("cc0") },
    { id: "jam", title: "Jam", src: "/jam.mp3", kind: "music", durationUs: 60_000_000, creator: "Ann", license: parseCreativeCommons("by-nc"), attribution: "“Jam” by Ann, CC BY-NC 4.0" },
  ],
});

describe("staticProvider", () => {
  it("matches title/tags and filters", async () => {
    expect((await demo.search!({ query: "upbeat" })).items.map((i) => i.id)).toEqual(["sunny"]);
    expect((await demo.search!({ query: "", kind: "music", commercialOnly: true })).items.map((i) => i.id)).toEqual(["sunny"]);
    expect((await demo.search!({ query: "", maxDurationS: 5 })).items.map((i) => i.id)).toEqual(["whoosh"]);
  });

  it("ranks by matching words and ignores kind words like \"music\"", async () => {
    expect((await demo.search!({ query: "upbeat acoustic music" })).items.map((i) => i.id)).toEqual(["sunny"]);
    expect((await demo.search!({ query: "calm upbeat" })).items.map((i) => i.id)).toEqual(["sunny"]);
    expect((await demo.search!({ query: "sunny whoosh transition" })).items.map((i) => i.id)).toEqual(["whoosh", "sunny"]);
    expect((await demo.search!({ query: "lullaby" })).items).toEqual([]);
  });
});

describe("httpProvider", () => {
  it("speaks the backend contract", async () => {
    const { fn, calls } = fakeFetch({
      "/search": { items: [{ provider: "x", id: "a1", title: "A", license: null }], page: 1, hasMore: false },
      "/resolve": (_u: string, init?: RequestInit) => ({ src: "https://s/a1.mp3", name: JSON.parse(String(init!.body)).item.title, source: { provider: "studio", id: "a1" } }),
    });
    const p = httpProvider({ id: "studio", label: "Studio", endpoint: "https://api.example/audio", fetch: fn });
    const res = await p.search!({ query: "calm", commercialOnly: true });
    expect(calls[0]!.url).toBe("https://api.example/audio/search?q=calm&commercialOnly=true");
    expect(res.items[0]!.provider).toBe("studio");
    expect(await p.resolve(res.items[0]!)).toMatchObject({ src: "https://s/a1.mp3", name: "A" });
  });
});

describe("importAudio", () => {
  it("adds asset + clip in one undo step, on a free (or new) audio track", async () => {
    const p = project();
    const resolved = await demo.resolve((await demo.getItem!("jam"))!);
    const a = importAudio(p, resolved, { atUs: 1_000_000, volume: 0.3, fadeInUs: 500_000 });
    let doc = p.getState().doc;
    expect(doc.assets[a.assetId]).toMatchObject({ kind: "audio", name: "Jam", source: { provider: "demo", id: "jam" }, license: { id: "CC-BY-NC-4.0" } });
    expect(doc.tracks[a.trackId!]).toMatchObject({ kind: "audio", name: "Music" });
    expect(doc.clips[a.clipId!]).toMatchObject({ startUs: 1_000_000, durationUs: 60_000_000, volume: 0.3, fadeInUs: 500_000 });

    // Overlapping second import → a second track; non-overlapping → reuse.
    const b = importAudio(p, resolved, { atUs: 2_000_000 });
    const c = importAudio(p, resolved, { atUs: 70_000_000 });
    expect(b.trackId).not.toBe(a.trackId);
    expect(c.trackId).toBe(a.trackId);

    expect(creditsFor(p.getState().doc)).toEqual(["“Jam” by Ann, CC BY-NC 4.0"]);
    expect(licenseReport(p.getState().doc, { commercial: true }).map((i) => i.kind)).toContain("non-commercial");

    p.undo();
    p.undo();
    p.undo();
    doc = p.getState().doc;
    expect(Object.keys(doc.assets)).toHaveLength(0);
    expect(Object.keys(doc.clips)).toHaveLength(0);
  });
});

describe("AI tools", () => {
  it("defines tools and runs search → add by id", async () => {
    const lib = createAudioLibrary([demo]);
    const defs = audioToolDefinitions(lib) as { name: string; input_schema: { properties: Record<string, { enum?: string[] }> } }[];
    expect(defs.map((d) => d.name)).toEqual(["search_audio", "add_audio"]);
    expect(defs[0]!.input_schema.properties.provider!.enum).toEqual(["demo"]);
    expect((audioToolDefinitions(lib, { style: "openai" })[0] as { type: string }).type).toBe("function");

    const p = project();
    const search = await runAudioTool("search_audio", { query: "transition", kind: "sfx" }, { library: lib, project: p });
    expect(search).toEqual({ ok: true, result: { items: [{ provider: "demo", id: "whoosh", title: "Whoosh", kind: "sfx", durationS: 0.9, license: "CC0-1.0", commercial: true }] } });

    const stored: string[] = [];
    const added = await runAudioTool(
      "add_audio",
      { provider: "demo", id: "whoosh", atSeconds: 2.5, volume: 0.8 },
      { library: lib, project: p, store: async (r) => (stored.push(r.src), { ...r, src: "https://cdn.me/whoosh.webm" }) },
    );
    expect(added.ok).toBe(true);
    const clip = Object.values(p.getState().doc.clips)[0] as AudioClip;
    expect(clip).toMatchObject({ startUs: 2_500_000, volume: 0.8 });
    expect(p.getState().doc.assets[clip.assetId]!.src).toBe("https://cdn.me/whoosh.webm");
    expect(stored).toEqual(["/media/audio/sfx-whoosh.webm"]);

    expect(await runAudioTool("add_audio", { provider: "demo", id: "missing" }, { library: lib, project: p })).toMatchObject({ ok: false });
    expect(await runAudioTool("nope", {}, { library: lib, project: p })).toMatchObject({ ok: false });
  });

  it("add_audio replaceClipId swaps a clip in one undo step, inheriting its place", async () => {
    const lib = createAudioLibrary([demo]);
    const p = project();
    await runAudioTool("add_audio", { provider: "demo", id: "jam", atSeconds: 1, volume: 0.6, durationSeconds: 20 }, { library: lib, project: p });
    const old = Object.values(p.getState().doc.clips)[0] as AudioClip;
    const swapped = await runAudioTool("add_audio", { provider: "demo", id: "sunny", replaceClipId: old.id }, { library: lib, project: p });
    expect(swapped).toMatchObject({ ok: true, result: { replaced: old.id } });
    const clips = Object.values(p.getState().doc.clips) as AudioClip[];
    expect(clips).toHaveLength(1);
    // Same track, start and volume; length capped by the new file (27 s > 20 s, so 20 s).
    expect(clips[0]).toMatchObject({ trackId: old.trackId, startUs: 1_000_000, durationUs: 20_000_000, volume: 0.6 });
    p.undo();
    expect((Object.values(p.getState().doc.clips) as AudioClip[]).map((c) => c.id)).toEqual([old.id]);
    expect(await runAudioTool("add_audio", { provider: "demo", id: "sunny", replaceClipId: "nope" }, { library: lib, project: p })).toMatchObject({ ok: false, error: expect.stringMatching(/no clip/) });
  });

  it("searchAll reports provider failures without failing the rest", async () => {
    const broken = openverseProvider({ fetch: async () => new Response("", { status: 503 }) });
    const lib = createAudioLibrary([demo, broken]);
    const runs = await lib.searchAll({ query: "sunny" });
    expect(runs.find((r) => r.provider === "demo")!.result!.items).toHaveLength(1);
    expect(runs.find((r) => r.provider === "openverse")!.error).toContain("HTTP 503");
    expect(() => createAudioLibrary([demo, demo])).toThrow(/Duplicate/);
  });
});
