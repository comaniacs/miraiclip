import type { AssetLicense } from "@miraiclip/core";
import { defaultFetch, getJson, provenance, US_PER_S } from "../common.js";
import {
  type FetchLike,
  type MediaItem,
  type MediaProvider,
  MediaProviderError,
  type ResolvedMedia,
} from "../types.js";

/*
 * Pexels: free photos and video. https://www.pexels.com/api/documentation/
 * Auth: the key itself in `Authorization`. Default limits 200/hour, 20,000/month (raised
 * on request). Show a prominent link to Pexels and credit the creator; files may be
 * downloaded and used.
 */

export const PEXELS_LICENSE: AssetLicense = {
  id: "Pexels-License",
  url: "https://www.pexels.com/license/",
  commercial: true,
  attributionRequired: false,
};

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer?: string;
  photographer_url?: string;
  alt?: string;
  src: Record<string, string | undefined>;
}
export interface PexelsVideoFile {
  quality?: string | null;
  file_type?: string | null;
  width?: number | null;
  height?: number | null;
  link: string;
}
interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image?: string;
  duration?: number;
  user?: { name?: string; url?: string };
  video_files?: PexelsVideoFile[];
}
interface PexelsPage<T> {
  page: number;
  per_page: number;
  total_results: number;
  next_page?: string;
  photos?: T[];
  videos?: T[];
}

/** "iced-coffee-in-a-glass-12345/" → "Iced coffee in a glass" (Pexels titles live in the URL). */
function titleFromUrl(url: string, fallback: string): string {
  const slug = /\/(?:photo|video)\/([^/]+?)-\d+\/?$/.exec(url)?.[1];
  if (!slug) return fallback;
  const words = slug.replace(/-/g, " ").trim();
  return words ? words[0]?.toUpperCase() + words.slice(1) : fallback;
}

const photoItem = (p: PexelsPhoto): MediaItem => ({
  provider: "pexels",
  id: String(p.id),
  kind: "photo",
  title: p.alt?.trim() || titleFromUrl(p.url, `Pexels photo ${p.id}`),
  creator: p.photographer,
  creatorUrl: p.photographer_url,
  landingUrl: p.url,
  thumbUrl: p.src.medium ?? p.src.small,
  previewUrl: p.src.large ?? p.src.medium,
  width: p.width,
  height: p.height,
  license: PEXELS_LICENSE,
  attribution: p.photographer ? `Photo by ${p.photographer} on Pexels` : "Photo from Pexels",
});

/**
 * The file to import: the largest MP4 no bigger than `maxShortSide` (default 1080), or
 * the smallest MP4 when every file is bigger. HLS playlists are never picked.
 */
export function pickPexelsFile(
  files: PexelsVideoFile[] = [],
  maxShortSide = 1080,
): PexelsVideoFile | null {
  const mp4 = files.filter(
    (f) => (f.file_type ?? "") === "video/mp4" && f.quality !== "hls" && f.link,
  );
  const short = (f: PexelsVideoFile) => Math.min(f.width ?? 0, f.height ?? 0);
  const fits = mp4.filter((f) => short(f) <= maxShortSide).sort((a, b) => short(b) - short(a));
  return fits[0] ?? mp4.sort((a, b) => short(a) - short(b))[0] ?? null;
}

const videoItem = (v: PexelsVideo): MediaItem => {
  const preview = pickPexelsFile(v.video_files, 540);
  return {
    provider: "pexels",
    id: String(v.id),
    kind: "video",
    title: titleFromUrl(v.url, `Pexels video ${v.id}`),
    creator: v.user?.name,
    creatorUrl: v.user?.url,
    landingUrl: v.url,
    thumbUrl: v.image,
    previewUrl: preview?.link,
    width: v.width,
    height: v.height,
    durationUs: v.duration !== undefined ? Math.round(v.duration * US_PER_S) : undefined,
    license: PEXELS_LICENSE,
    attribution: v.user?.name ? `Video by ${v.user.name} on Pexels` : "Video from Pexels",
  };
};

export interface PexelsOptions {
  apiKey: string;
  fetch?: FetchLike;
  /** Default https://api.pexels.com */
  baseUrl?: string;
  /** Largest video imported, by its shorter side (default 1080). */
  maxVideoShortSide?: number;
}

export function pexelsProvider(options: PexelsOptions): MediaProvider {
  const fetcher = options.fetch ?? defaultFetch();
  const base = (options.baseUrl ?? "https://api.pexels.com").replace(/\/$/, "");
  const init = (signal?: AbortSignal): RequestInit => ({
    headers: { Authorization: options.apiKey },
    ...(signal ? { signal } : {}),
  });
  return {
    id: "pexels",
    label: "Pexels",
    capabilities: { search: ["photo", "video"] },
    notice: "Photos and videos provided by Pexels",
    homepage: "https://www.pexels.com",

    async search({ query, kind, page = 1, pageSize = 20, signal }) {
      const qs = new URLSearchParams({
        query,
        page: String(page),
        per_page: String(Math.min(pageSize, 80)),
      });
      const path = kind === "photo" ? "/v1/search" : "/v1/videos/search";
      const body = await getJson<PexelsPage<PexelsPhoto & PexelsVideo>>(
        fetcher,
        "pexels",
        `${base}${path}?${qs}`,
        init(signal),
      );
      if (!body) return { items: [], page, hasMore: false };
      const items =
        kind === "photo" ? (body.photos ?? []).map(photoItem) : (body.videos ?? []).map(videoItem);
      return { items, page, hasMore: Boolean(body.next_page) };
    },

    async getItem(kind, id, opts) {
      if (!/^\d{1,20}$/.test(id)) return null;
      const path = kind === "photo" ? `/v1/photos/${id}` : `/v1/videos/videos/${id}`;
      const body = await getJson<PexelsPhoto & PexelsVideo>(
        fetcher,
        "pexels",
        `${base}${path}`,
        init(opts?.signal),
      );
      if (!body) return null;
      return kind === "photo" ? photoItem(body) : videoItem(body);
    },

    async resolve(item, opts): Promise<ResolvedMedia> {
      if (item.kind === "photo") {
        const body = await getJson<PexelsPhoto>(
          fetcher,
          "pexels",
          `${base}/v1/photos/${item.id}`,
          init(opts?.signal),
        );
        const src = body?.src.original;
        if (!body || !src) throw new MediaProviderError("pexels", `photo ${item.id} has no file`);
        return { ...provenance(item), src, width: body.width, height: body.height };
      }
      const body = await getJson<PexelsVideo>(
        fetcher,
        "pexels",
        `${base}/v1/videos/videos/${item.id}`,
        init(opts?.signal),
      );
      const file = pickPexelsFile(body?.video_files, options.maxVideoShortSide);
      if (!body || !file) throw new MediaProviderError("pexels", `video ${item.id} has no MP4`);
      return {
        ...provenance(item),
        src: file.link,
        mimeType: "video/mp4",
        width: file.width ?? undefined,
        height: file.height ?? undefined,
        durationUs: body.duration !== undefined ? Math.round(body.duration * US_PER_S) : undefined,
      };
    },
  };
}
