import type { AssetLicense, AssetSource, Us } from "@miraiclip/core";

/** What a stock item is. (Sound has its own package: @miraiclip/audio-sources.) */
export type MediaKind = "photo" | "video";

/** One search result: enough to list, preview and credit it. */
export interface MediaItem {
  /** Provider id this item came from ("pexels", "pixabay", yours). */
  provider: string;
  /** The provider's id for the item (stable; used by `getItem` and `resolve`). */
  id: string;
  kind: MediaKind;
  title: string;
  creator?: string | undefined;
  creatorUrl?: string | undefined;
  /** Where a person can see the item and its license on the provider's site. */
  landingUrl?: string | undefined;
  /** A small image for a grid (photos, and video posters). */
  thumbUrl?: string | undefined;
  /** Something a plain `<img>` or `<video>` can preview. Temporary: never store it. */
  previewUrl?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  /** Videos. */
  durationUs?: Us | undefined;
  /** `null` when the provider gives no license (treat as not safe to use). */
  license: AssetLicense | null;
  /** The credit line to keep with the asset ("Photo by Aiko on Pexels"). */
  attribution?: string | undefined;
  tags?: string[] | undefined;
}

/** A search. */
export interface MediaQuery {
  query: string;
  kind: MediaKind;
  /** 1-based. */
  page?: number | undefined;
  pageSize?: number | undefined;
  signal?: AbortSignal | undefined;
}

export interface MediaSearchResult {
  items: MediaItem[];
  page: number;
  hasMore: boolean;
}

/**
 * The file to import plus everything `asset/add` records about it. `src` is the
 * provider's file URL; libraries generally ask you not to hotlink, so apps copy it into
 * their own storage and replace `src` before importing (see `importMedia`).
 */
export interface ResolvedMedia {
  src: string;
  kind: MediaKind;
  mimeType?: string | undefined;
  /** When the provider says. */
  bytes?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  durationUs?: Us | undefined;
  name: string;
  source: AssetSource;
  license?: AssetLicense | undefined;
  attribution?: string | undefined;
}

export interface MediaProviderCapabilities {
  /** Kinds `search` can return. */
  search: MediaKind[];
}

/**
 * One photo/video library. Network-facing adapters take `fetch` and a base URL so apps
 * can route them through their own backend (keys stay server-side).
 */
export interface MediaProvider {
  id: string;
  label: string;
  capabilities: MediaProviderCapabilities;
  /** Short note to show with its results, e.g. "Photos and videos provided by Pexels". */
  notice?: string | undefined;
  /** The library's site, to link the notice to. */
  homepage?: string | undefined;
  search(query: MediaQuery): Promise<MediaSearchResult>;
  /**
   * Look an item up again by id. Servers should import from this, never from an item a
   * client sent: the license and file come from the provider, not the request.
   */
  getItem(kind: MediaKind, id: string, options?: { signal?: AbortSignal }): Promise<MediaItem | null>;
  /** The file to import, with its provenance. */
  resolve(item: MediaItem, options?: { signal?: AbortSignal }): Promise<ResolvedMedia>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** A provider request failed (network, HTTP status, or an unexpected payload). */
export class MediaProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${provider}: ${message}`);
    this.name = "MediaProviderError";
  }
}
