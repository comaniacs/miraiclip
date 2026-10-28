import type { AssetLicense } from "@miraiclip/core";
import { defaultFetch, getJson, provenance, US_PER_S } from "../common.js";
import {
  type FetchLike,
  type MediaItem,
  type MediaKind,
  type MediaProvider,
  MediaProviderError,
} from "../types.js";

/*
 * Pixabay: free photos and video. https://pixabay.com/api/docs/
 * The key goes in the query string. 100 requests / 60 s per key; responses must be
 * cached for 24 hours; no permanent hotlinking (copy files into your storage on
 * import); show where results come from. Standard keys get images up to 1280 px
 * (`largeImageURL`); full-resolution access is by request.
 */

export const PIXABAY_LICENSE: AssetLicense = {
  id: "Pixabay-Content-License",
  url: "https://pixabay.com/service/license-summary/",
  commercial: true,
  attributionRequired: false,
};

interface PixabayHitBase {
  id: number;
  pageURL: string;
  tags?: string;
  user?: string;
  user_id?: number;
}
interface PixabayImage extends PixabayHitBase {
  previewURL?: string;
  webformatURL?: string;
  largeImageURL?: string;
  fullHDURL?: string;
  imageURL?: string;
  imageWidth: number;
  imageHeight: number;
  imageSize?: number;
}
export interface PixabayRendition {
  url: string;
  width: number;
  height: number;
  size: number;
  thumbnail?: string;
}
interface PixabayVideo extends PixabayHitBase {
  duration?: number;
  videos: Partial<Record<"large" | "medium" | "small" | "tiny", PixabayRendition>>;
}
interface PixabayPage<T> {
  total: number;
  totalHits: number;
  hits: T[];
}

const tagsOf = (h: PixabayHitBase) =>
  (h.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

function title(h: PixabayHitBase, what: string) {
  const first = tagsOf(h).slice(0, 3).join(", ");
  return first ? first[0]?.toUpperCase() + first.slice(1) : `Pixabay ${what} ${h.id}`;
}

const creatorUrl = (h: PixabayHitBase) =>
  h.user && h.user_id ? `https://pixabay.com/users/${h.user}-${h.user_id}/` : undefined;

const imageItem = (h: PixabayImage): MediaItem => ({
  provider: "pixabay",
  id: String(h.id),
  kind: "photo",
  title: title(h, "photo"),
  creator: h.user,
  creatorUrl: creatorUrl(h),
  landingUrl: h.pageURL,
  thumbUrl: h.webformatURL ?? h.previewURL,
  previewUrl: h.largeImageURL ?? h.webformatURL,
  width: h.imageWidth,
  height: h.imageHeight,
  license: PIXABAY_LICENSE,
  attribution: h.user ? `Image by ${h.user} from Pixabay` : "Image from Pixabay",
  tags: tagsOf(h),
});

/** The rendition to import: medium (usually 1920×1080, always present), else the next one. */
export function pickPixabayRendition(v: PixabayVideo["videos"]): PixabayRendition | null {
  for (const k of ["medium", "large", "small", "tiny"] as const) {
    const r = v[k];
    if (r?.url && r.size > 0) return r;
  }
  return null;
}

const videoItem = (h: PixabayVideo): MediaItem => {
  const small = h.videos.small ?? h.videos.tiny;
  return {
    provider: "pixabay",
    id: String(h.id),
    kind: "video",
    title: title(h, "video"),
    creator: h.user,
    creatorUrl: creatorUrl(h),
    landingUrl: h.pageURL,
    thumbUrl: h.videos.medium?.thumbnail ?? small?.thumbnail,
    previewUrl: small?.url,
    width: h.videos.medium?.width,
    height: h.videos.medium?.height,
    durationUs: h.duration !== undefined ? Math.round(h.duration * US_PER_S) : undefined,
    license: PIXABAY_LICENSE,
    attribution: h.user ? `Video by ${h.user} from Pixabay` : "Video from Pixabay",
    tags: tagsOf(h),
  };
};

export interface PixabayOptions {
  apiKey: string;
  fetch?: FetchLike;
  /** Default https://pixabay.com */
  baseUrl?: string;
}

export function pixabayProvider(options: PixabayOptions): MediaProvider {
  const fetcher = options.fetch ?? defaultFetch();
  const base = (options.baseUrl ?? "https://pixabay.com").replace(/\/$/, "");
  const call = <T>(kind: MediaKind, params: Record<string, string>, signal?: AbortSignal) =>
    getJson<PixabayPage<T>>(
      fetcher,
      "pixabay",
      `${base}${kind === "photo" ? "/api/" : "/api/videos/"}?${new URLSearchParams({
        key: options.apiKey,
        safesearch: "true",
        ...(kind === "photo" ? { image_type: "photo" } : {}),
        ...params,
      })}`,
      signal ? { signal } : {},
    );

  return {
    id: "pixabay",
    label: "Pixabay",
    capabilities: { search: ["photo", "video"] },
    notice: "Photos and videos from Pixabay",
    homepage: "https://pixabay.com",

    async search({ query, kind, page = 1, pageSize = 20, signal }) {
      const perPage = Math.min(Math.max(pageSize, 3), 200);
      const body = await call<PixabayImage & PixabayVideo>(
        kind,
        { q: query.slice(0, 100), page: String(page), per_page: String(perPage) },
        signal,
      );
      if (!body) return { items: [], page, hasMore: false };
      const items = kind === "photo" ? body.hits.map(imageItem) : body.hits.map(videoItem);
      // Pixabay serves at most 500 hits per query.
      return { items, page, hasMore: page * perPage < Math.min(body.totalHits, 500) };
    },

    async getItem(kind, id, opts) {
      if (!/^\d{1,20}$/.test(id)) return null;
      // Pixabay answers an unknown id with 400 "[ERROR 400] "id" is out of range".
      let body: PixabayPage<PixabayImage & PixabayVideo> | null;
      try {
        body = await call<PixabayImage & PixabayVideo>(kind, { id }, opts?.signal);
      } catch (err) {
        if (err instanceof MediaProviderError && err.status === 400) return null;
        throw err;
      }
      const hit = body?.hits[0];
      if (!hit) return null;
      return kind === "photo" ? imageItem(hit) : videoItem(hit);
    },

    async resolve(item, opts) {
      const body = await call<PixabayImage & PixabayVideo>(item.kind, { id: item.id }, opts?.signal);
      const hit = body?.hits[0];
      if (!hit) throw new MediaProviderError("pixabay", `${item.kind} ${item.id} not found`, 404);
      if (item.kind === "photo") {
        // Full access gives the original; standard keys get the 1280 px rendition.
        const src = hit.imageURL ?? hit.fullHDURL ?? hit.largeImageURL;
        if (!src) throw new MediaProviderError("pixabay", `photo ${item.id} has no file`);
        const scale = hit.imageURL
          ? 1
          : Math.min(1, (hit.fullHDURL ? 1920 : 1280) / Math.max(hit.imageWidth, hit.imageHeight));
        return {
          ...provenance(item),
          src,
          width: Math.round(hit.imageWidth * scale),
          height: Math.round(hit.imageHeight * scale),
          ...(hit.imageURL && hit.imageSize ? { bytes: hit.imageSize } : {}),
        };
      }
      const r = pickPixabayRendition(hit.videos);
      if (!r) throw new MediaProviderError("pixabay", `video ${item.id} has no file`);
      return {
        ...provenance(item),
        src: r.url,
        mimeType: "video/mp4",
        bytes: r.size,
        width: r.width,
        height: r.height,
        durationUs: hit.duration !== undefined ? Math.round(hit.duration * US_PER_S) : undefined,
      };
    },
  };
}
