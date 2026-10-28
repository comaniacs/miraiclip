import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import {
  createMediaLibrary,
  type FetchLike,
  importMedia,
  interleave,
  type MediaProvider,
  PEXELS_LICENSE,
  pexelsProvider,
  pickPexelsFile,
  pixabayProvider,
  searchAll,
} from "../src/index.js";

type Call = { url: URL; headers: Headers };
function fakeFetch(route: (url: URL) => unknown | Response): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (input, init) => {
      const url = new URL(input);
      calls.push({ url, headers: new Headers(init?.headers) });
      const out = route(url);
      return out instanceof Response ? out : Response.json(out);
    },
  };
}

const pexelsPhoto = {
  id: 2014422,
  width: 3024,
  height: 3024,
  url: "https://www.pexels.com/photo/iced-coffee-in-a-glass-2014422/",
  photographer: "Aiko Tanaka",
  photographer_url: "https://www.pexels.com/@aiko",
  alt: "",
  src: {
    original: "https://images.pexels.com/photos/2014422/a.jpeg",
    large: "https://images.pexels.com/photos/2014422/a.jpeg?h=650",
    medium: "https://images.pexels.com/photos/2014422/a.jpeg?h=350",
  },
};
const pexelsVideo = {
  id: 857195,
  width: 3840,
  height: 2160,
  url: "https://www.pexels.com/video/neon-canal-at-night-857195/",
  image: "https://images.pexels.com/videos/857195/poster.jpeg",
  duration: 21,
  user: { name: "Jun Mori", url: "https://www.pexels.com/@jun" },
  video_files: [
    { quality: "uhd", file_type: "video/mp4", width: 3840, height: 2160, link: "https://v/4k.mp4" },
    {
      quality: "hd",
      file_type: "video/mp4",
      width: 1920,
      height: 1080,
      link: "https://v/1080.mp4",
    },
    { quality: "hd", file_type: "video/mp4", width: 1280, height: 720, link: "https://v/720.mp4" },
    { quality: "sd", file_type: "video/mp4", width: 960, height: 540, link: "https://v/540.mp4" },
    { quality: "hls", file_type: "video/mp4", width: null, height: null, link: "https://v/x.m3u8" },
  ],
};

describe("pexels", () => {
  it("searches photos with the key in Authorization and maps them", async () => {
    const f = fakeFetch(() => ({ page: 1, per_page: 80, total_results: 1, photos: [pexelsPhoto] }));
    const p = pexelsProvider({ apiKey: "pk", fetch: f.fetch });
    const r = await p.search({ query: "iced coffee", kind: "photo", pageSize: 500 });
    expect(f.calls[0]?.url.pathname).toBe("/v1/search");
    expect(f.calls[0]?.url.searchParams.get("per_page")).toBe("80");
    expect(f.calls[0]?.headers.get("authorization")).toBe("pk");
    expect(r.hasMore).toBe(false);
    expect(r.items[0]).toEqual({
      provider: "pexels",
      id: "2014422",
      kind: "photo",
      title: "Iced coffee in a glass",
      creator: "Aiko Tanaka",
      creatorUrl: "https://www.pexels.com/@aiko",
      landingUrl: pexelsPhoto.url,
      thumbUrl: pexelsPhoto.src.medium,
      previewUrl: pexelsPhoto.src.large,
      width: 3024,
      height: 3024,
      license: PEXELS_LICENSE,
      attribution: "Photo by Aiko Tanaka on Pexels",
    });
  });

  it("searches videos under /v1/videos and imports ≤ 1080p MP4", async () => {
    const f = fakeFetch((u) =>
      u.pathname.endsWith("/search")
        ? { page: 1, per_page: 20, total_results: 99, next_page: "x", videos: [pexelsVideo] }
        : pexelsVideo,
    );
    const p = pexelsProvider({ apiKey: "pk", fetch: f.fetch });
    const r = await p.search({ query: "neon", kind: "video" });
    expect(f.calls[0]?.url.pathname).toBe("/v1/videos/search");
    expect(r.hasMore).toBe(true);
    expect(r.items[0]).toMatchObject({
      kind: "video",
      durationUs: 21_000_000,
      previewUrl: "https://v/540.mp4",
      thumbUrl: pexelsVideo.image,
    });
    const file = await p.resolve(r.items[0] as never);
    expect(f.calls[1]?.url.pathname).toBe("/v1/videos/videos/857195");
    expect(file).toMatchObject({
      src: "https://v/1080.mp4",
      kind: "video",
      mimeType: "video/mp4",
      width: 1920,
      height: 1080,
      durationUs: 21_000_000,
      name: "Neon canal at night",
      source: { provider: "pexels", id: "857195" },
      license: PEXELS_LICENSE,
      attribution: "Video by Jun Mori on Pexels",
    });
  });

  it("picks the smallest MP4 when every file is over 1080p, and none from HLS", () => {
    expect(
      pickPexelsFile([
        { quality: "uhd", file_type: "video/mp4", width: 4096, height: 2160, link: "a" },
        { quality: "uhd", file_type: "video/mp4", width: 3840, height: 1440, link: "b" },
      ])?.link,
    ).toBe("b");
    expect(pickPexelsFile([{ quality: "hls", file_type: "video/mp4", link: "c" }])).toBeNull();
  });

  it("get: unknown ids and malformed ids are null without guessing", async () => {
    const f = fakeFetch(() => new Response("nope", { status: 404 }));
    const p = pexelsProvider({ apiKey: "pk", fetch: f.fetch });
    expect(await p.getItem("photo", "123")).toBeNull();
    expect(await p.getItem("photo", "../search?query=x")).toBeNull();
    expect(f.calls).toHaveLength(1);
  });

  it("surfaces rate limits as errors with the status", async () => {
    const f = fakeFetch(() => new Response("slow down", { status: 429 }));
    const p = pexelsProvider({ apiKey: "pk", fetch: f.fetch });
    await expect(p.search({ query: "x", kind: "photo" })).rejects.toMatchObject({
      provider: "pexels",
      status: 429,
    });
  });
});

const pixabayImage = {
  id: 195893,
  pageURL: "https://pixabay.com/photos/lanterns-dusk-195893/",
  tags: "lanterns, dusk, street",
  webformatURL: "https://pixabay.com/get/w640.jpg",
  largeImageURL: "https://pixabay.com/get/w1280.jpg",
  imageWidth: 4000,
  imageHeight: 5000,
  imageSize: 9_800_000,
  user: "hana",
  user_id: 42,
};
const pixabayVideo = {
  id: 31377,
  pageURL: "https://pixabay.com/videos/rain-window-31377/",
  tags: "rain, window, loop",
  duration: 12,
  user: "yui",
  user_id: 7,
  videos: {
    large: { url: "", width: 0, height: 0, size: 0, thumbnail: "" },
    medium: { url: "https://cdn/m.mp4", width: 1920, height: 1080, size: 84e6, thumbnail: "t.jpg" },
    small: { url: "https://cdn/s.mp4", width: 1280, height: 720, size: 30e6, thumbnail: "ts.jpg" },
  },
};

describe("pixabay", () => {
  it("searches photos with key, safesearch and photo type; caps hasMore at 500 hits", async () => {
    const f = fakeFetch(() => ({ total: 9000, totalHits: 500, hits: [pixabayImage] }));
    const p = pixabayProvider({ apiKey: "xk", fetch: f.fetch });
    const r = await p.search({
      query: "lanterns".repeat(20),
      kind: "photo",
      page: 25,
      pageSize: 20,
    });
    const q = f.calls[0]?.url.searchParams;
    expect(f.calls[0]?.url.pathname).toBe("/api/");
    expect(q?.get("key")).toBe("xk");
    expect(q?.get("safesearch")).toBe("true");
    expect(q?.get("image_type")).toBe("photo");
    expect(q?.get("q")).toHaveLength(100);
    expect(r.hasMore).toBe(false); // page 25 × 20 = 500
    expect(r.items[0]).toMatchObject({
      provider: "pixabay",
      id: "195893",
      title: "Lanterns, dusk, street",
      creatorUrl: "https://pixabay.com/users/hana-42/",
      attribution: "Image by hana from Pixabay",
      tags: ["lanterns", "dusk", "street"],
    });
  });

  it("imports the 1280 px rendition on a standard key, sized to match", async () => {
    const f = fakeFetch(() => ({ total: 1, totalHits: 1, hits: [pixabayImage] }));
    const p = pixabayProvider({ apiKey: "xk", fetch: f.fetch });
    const item = (await p.getItem("photo", "195893")) as never;
    expect(await p.resolve(item)).toMatchObject({
      src: pixabayImage.largeImageURL,
      kind: "photo",
      width: 1024,
      height: 1280,
    });
  });

  it("imports the medium video rendition (large is often empty)", async () => {
    const f = fakeFetch(() => ({ total: 1, totalHits: 1, hits: [pixabayVideo] }));
    const p = pixabayProvider({ apiKey: "xk", fetch: f.fetch });
    const item = (await p.getItem("video", "31377")) as never;
    expect(f.calls[0]?.url.pathname).toBe("/api/videos/");
    expect(await p.resolve(item)).toMatchObject({
      src: "https://cdn/m.mp4",
      mimeType: "video/mp4",
      bytes: 84e6,
      width: 1920,
      height: 1080,
      durationUs: 12_000_000,
    });
  });

  it("an unknown id (Pixabay answers 400) is null", async () => {
    const f = fakeFetch(() => new Response('[ERROR 400] "id" is out of range', { status: 400 }));
    const p = pixabayProvider({ apiKey: "xk", fetch: f.fetch });
    expect(await p.getItem("photo", "999")).toBeNull();
  });
});

describe("mixed search", () => {
  const fake = (id: string, n: number, fail = false): MediaProvider => ({
    id,
    label: id,
    capabilities: { search: ["photo"] },
    search: async () => {
      if (fail) throw new Error("down");
      return {
        items: Array.from({ length: n }, (_, i) => ({
          provider: id,
          id: String(i),
          kind: "photo" as const,
          title: `${id}${i}`,
          license: i === 1 && id === "b" ? null : PEXELS_LICENSE,
        })),
        hasMore: n > 1,
      };
    },
    getItem: async () => null,
    resolve: async () => {
      throw new Error("unused");
    },
  });

  it("interleaves providers, drops unlicensed items and reports failures", async () => {
    const r = await searchAll([fake("a", 3), fake("b", 2), fake("c", 0, true)], {
      query: "x",
      kind: "photo",
    });
    expect(r.items.map((i) => i.title)).toEqual(["a0", "b0", "a1", "a2"]);
    expect(r.hasMore).toBe(true);
    expect(r.providers.map((p) => p.id)).toEqual(["a", "b"]);
    expect(r.failed).toEqual([{ provider: "c", error: "down" }]);
  });

  it("asks only providers that serve the kind", async () => {
    const r = await searchAll([fake("a", 2)], { query: "x", kind: "video" });
    expect(r).toEqual({ items: [], hasMore: false, providers: [], failed: [] });
    expect(interleave([[1, 2, 3], [], [4]])).toEqual([1, 4, 2, 3]);
  });
});

describe("importMedia", () => {
  const resolved = {
    src: "https://store/a.mp4",
    kind: "video" as const,
    name: "Neon canal",
    durationUs: 4_000_000,
    width: 1920,
    height: 1080,
    source: { provider: "pexels", id: "857195" },
    license: PEXELS_LICENSE,
    attribution: "Video by Jun Mori on Pexels",
  };
  it("adds asset with provenance and a clip in one undo step", () => {
    const p = createProject({ width: 1280, height: 720, fps: 30 });
    const r = importMedia(p, resolved);
    const doc = p.getState().doc;
    expect(doc.assets[r.assetId]).toMatchObject({
      kind: "video",
      source: resolved.source,
      license: PEXELS_LICENSE,
      attribution: resolved.attribution,
    });
    expect(doc.clips[r.clipId as string]).toMatchObject({ kind: "video", durationUs: 4_000_000 });
    p.undo();
    expect(Object.keys(p.getState().doc.assets)).toHaveLength(0);
    expect(Object.keys(p.getState().doc.clips)).toHaveLength(0);
  });
  it("photos become image clips of 5 s by default", () => {
    const p = createProject({ width: 1280, height: 720, fps: 30 });
    const r = importMedia(p, { ...resolved, kind: "photo", src: "https://store/a.jpg" });
    expect(p.getState().doc.clips[r.clipId as string]).toMatchObject({
      kind: "image",
      durationUs: 5_000_000,
    });
  });
});

describe("library", () => {
  it("rejects duplicate ids and looks items up through the provider", async () => {
    const f = fakeFetch(() => pexelsPhoto);
    const p = pexelsProvider({ apiKey: "k", fetch: f.fetch });
    expect(() => createMediaLibrary([p, p])).toThrow(/Duplicate/);
    const item = await createMediaLibrary([p]).item("pexels", "photo", "2014422");
    expect(item?.id).toBe("2014422");
  });
});
