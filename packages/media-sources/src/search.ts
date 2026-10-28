import type { MediaItem, MediaKind, MediaProvider, MediaQuery } from "./types.js";

/** One result list from several providers; see `searchAll`. */
export interface MixedResult {
  items: MediaItem[];
  hasMore: boolean;
  /** Providers that answered (show their `notice` under the results). */
  providers: MediaProvider[];
  /** Providers that failed or timed out this time, with why. */
  failed: { provider: string; error: string }[];
}

/** a1 b1 a2 b2 …: no single library crowds out the rest. */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const l of lists) {
      const item = l[i];
      if (item !== undefined) out.push(item);
    }
  }
  return out;
}

export const providersFor = (providers: readonly MediaProvider[], kind: MediaKind) =>
  providers.filter((p) => p.capabilities.search.includes(kind));

/**
 * Ask every provider that serves `query.kind` for the same page in parallel and
 * interleave the answers. A provider that fails or exceeds `timeoutMs` (default 8 s) is
 * skipped and reported, so one outage doesn't empty the panel. Items with no license
 * are dropped: nobody could say how they may be used.
 */
export async function searchAll(
  providers: readonly MediaProvider[],
  query: MediaQuery,
  options: { timeoutMs?: number } = {},
): Promise<MixedResult> {
  const relevant = providersFor(providers, query.kind);
  const timeoutMs = options.timeoutMs ?? 8000;
  const results = await Promise.allSettled(
    relevant.map((p) => {
      const signal = AbortSignal.any(
        [AbortSignal.timeout(timeoutMs), query.signal].filter((s): s is AbortSignal => !!s),
      );
      return p.search({ ...query, signal });
    }),
  );
  const lists: MediaItem[][] = [];
  const failed: MixedResult["failed"] = [];
  const answered: MediaProvider[] = [];
  let hasMore = false;
  results.forEach((r, i) => {
    const p = relevant[i] as MediaProvider;
    if (r.status === "fulfilled") {
      answered.push(p);
      lists.push(r.value.items.filter((it) => it.license !== null));
      hasMore ||= r.value.hasMore;
    } else {
      failed.push({
        provider: p.id,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });
  return { items: interleave(lists), hasMore, providers: answered, failed };
}

/** The set of providers an app offers, looked up by id. */
export interface MediaLibrary {
  providers(): MediaProvider[];
  get(id: string): MediaProvider | undefined;
  searchAll(query: MediaQuery, options?: { timeoutMs?: number }): Promise<MixedResult>;
  /** Look an item up again through its provider (never trust a client-sent item). */
  item(provider: string, kind: MediaKind, id: string, signal?: AbortSignal): Promise<MediaItem | null>;
}

export function createMediaLibrary(providers: readonly MediaProvider[]): MediaLibrary {
  const byId = new Map<string, MediaProvider>();
  for (const p of providers) {
    if (byId.has(p.id)) throw new Error(`Duplicate media provider id "${p.id}"`);
    byId.set(p.id, p);
  }
  return {
    providers: () => [...byId.values()],
    get: (id) => byId.get(id),
    searchAll: (query, options) => searchAll([...byId.values()], query, options),
    async item(provider, kind, id, signal) {
      const p = byId.get(provider);
      if (!p) throw new Error(`Unknown media provider "${provider}"`);
      return p.getItem(kind, id, signal ? { signal } : {});
    },
  };
}
