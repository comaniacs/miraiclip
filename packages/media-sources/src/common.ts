import type { AssetSource } from "@miraiclip/core";
import { type FetchLike, type MediaItem, MediaProviderError } from "./types.js";

export const US_PER_S = 1_000_000;

/** GET JSON from a provider, mapping failures to MediaProviderError (404 → null). */
export async function getJson<T>(
  fetcher: FetchLike,
  provider: string,
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  let res: Response;
  try {
    res = await fetcher(url, init);
  } catch (err) {
    throw new MediaProviderError(provider, err instanceof Error ? err.message : String(err));
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new MediaProviderError(provider, `HTTP ${res.status}`, res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new MediaProviderError(provider, "unreadable response", res.status);
  }
}

/** Plain `fetch`, called late so tests and runtimes can replace the global. */
export const defaultFetch = (): FetchLike => (u, i) => fetch(u, i);

/** Where an item came from, as `asset/add` records it. */
export const sourceOf = (item: MediaItem): AssetSource => ({
  provider: item.provider,
  id: item.id,
  ...(item.landingUrl ? { url: item.landingUrl } : {}),
});

/** Provenance every resolved file carries. */
export const provenance = (item: MediaItem) => ({
  kind: item.kind,
  name: item.title,
  source: sourceOf(item),
  ...(item.license ? { license: item.license } : {}),
  ...(item.attribution ? { attribution: item.attribution } : {}),
});
