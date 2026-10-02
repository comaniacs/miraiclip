/**
 * Any service behind your own backend, through a small JSON contract — the
 * way to plug in a commercial library or a provider whose keys must stay
 * server-side, without writing a client adapter:
 *
 *   GET  {endpoint}/search?q=&kind=&commercialOnly=&minDurationS=&maxDurationS=&page=&pageSize=
 *        → AudioSearchResult (items[].provider is overwritten with this provider's id)
 *   GET  {endpoint}/items/{id}           → AudioItem | 404
 *   POST {endpoint}/resolve  { item }    → ResolvedAudio
 *
 * Generation has its own contract: see generate/http.ts.
 */
import { defaultFetch, getJson, joinUrl } from "../common.js";
import type { AudioItem, AudioKind, AudioProvider, AudioSearchResult, FetchLike, ResolvedAudio } from "../types.js";

export interface HttpProviderOptions {
  id: string;
  label: string;
  endpoint: string;
  kinds?: AudioKind[];
  headers?: Record<string, string>;
  fetch?: FetchLike;
  notice?: string;
}

export function httpProvider(options: HttpProviderOptions): AudioProvider {
  const doFetch = options.fetch ?? defaultFetch();
  const headers = { Accept: "application/json", ...options.headers };
  const own = (item: AudioItem): AudioItem => ({ ...item, provider: options.id });

  return {
    id: options.id,
    label: options.label,
    capabilities: { search: options.kinds ?? ["music", "sfx", "voice"] },
    ...(options.notice ? { notice: options.notice } : {}),

    async search(query) {
      const data = await getJson<AudioSearchResult>(
        options.id,
        doFetch,
        joinUrl(options.endpoint, "/search", {
          q: query.query,
          kind: query.kind,
          commercialOnly: query.commercialOnly ? "true" : undefined,
          minDurationS: query.minDurationS,
          maxDurationS: query.maxDurationS,
          page: query.page,
          pageSize: query.pageSize,
        }),
        { headers, ...(query.signal ? { signal: query.signal } : {}) },
      );
      return { ...data, items: (data.items ?? []).map(own) };
    },

    async getItem(id, opts) {
      try {
        return own(
          await getJson<AudioItem>(options.id, doFetch, joinUrl(options.endpoint, `/items/${encodeURIComponent(id)}`), {
            headers,
            ...(opts?.signal ? { signal: opts.signal } : {}),
          }),
        );
      } catch (err) {
        if ((err as { status?: number }).status === 404) return null;
        throw err;
      }
    },

    async resolve(item, opts) {
      return getJson<ResolvedAudio>(options.id, doFetch, joinUrl(options.endpoint, "/resolve"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
        ...(opts?.signal ? { signal: opts.signal } : {}),
      });
    },
  };
}
