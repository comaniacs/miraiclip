import type { AudioItem, AudioQuery, FetchLike } from "./types.js";

/** A provider request failed (network, HTTP status, or an unexpected payload). */
export class AudioSourceError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "AudioSourceError";
  }
}

export function defaultFetch(): FetchLike {
  if (typeof fetch !== "function") throw new Error("No global fetch: pass `fetch` to the provider.");
  return (input, init) => fetch(input, init);
}

export async function getJson<T>(provider: string, doFetch: FetchLike, url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await doFetch(url, init);
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new AudioSourceError(provider, `request failed: ${(err as Error)?.message ?? err}`);
  }
  if (!res.ok) throw new AudioSourceError(provider, `HTTP ${res.status}`, res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new AudioSourceError(provider, "response was not JSON", res.status);
  }
}

/** Client-side filters for what a provider can't filter server-side. */
export function matchesQuery(item: AudioItem, query: AudioQuery): boolean {
  if (query.commercialOnly && !item.license?.commercial) return false;
  if (query.kind && item.kind && item.kind !== query.kind) return false;
  const s = item.durationUs !== undefined ? item.durationUs / 1_000_000 : undefined;
  if (s !== undefined && query.minDurationS !== undefined && s < query.minDurationS) return false;
  if (s !== undefined && query.maxDurationS !== undefined && s > query.maxDurationS) return false;
  return true;
}

export function joinUrl(base: string, path: string, params?: Record<string, string | number | undefined>): string {
  const url = base.replace(/\/+$/, "") + path;
  const search = Object.entries(params ?? {})
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return search ? `${url}?${search}` : url;
}

export const secondsToUs = (s: number | undefined | null): number | undefined =>
  typeof s === "number" && Number.isFinite(s) && s > 0 ? Math.round(s * 1_000_000) : undefined;
