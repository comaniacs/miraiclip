/**
 * Freesound (freesound.org): a large library of sound effects and field
 * recordings under CC0 / CC BY / CC BY-NC.
 *
 * Terms: the Freesound API is free for NON-COMMERCIAL use; commercial apps
 * need an agreement with the Freesound team, regardless of each sound's
 * license. Token auth gives search and the MP3 previews (used as the file
 * here); original-quality downloads require OAuth2 and are out of scope.
 *
 * API: https://freesound.org/docs/api/ (GET /search/text/, GET /sounds/{id}/).
 * Keep the key server-side: point `baseUrl` at a proxy that adds
 * `Authorization: Token <key>`, or pass `token` only in trusted environments.
 */
import { defaultFetch, getJson, joinUrl, matchesQuery, secondsToUs } from "../common.js";
import { creditLine, parseCreativeCommons } from "../licenses.js";
import type { AudioItem, AudioProvider, AudioQuery, AudioSearchResult, FetchLike } from "../types.js";

export interface FreesoundProviderOptions {
  /** API key. Omit when `baseUrl` is a proxy that authenticates for you. */
  token?: string;
  /** Default "https://freesound.org/apiv2". */
  baseUrl?: string;
  fetch?: FetchLike;
  id?: string;
  label?: string;
}

export interface FreesoundSound {
  id: number;
  name?: string;
  username?: string;
  license?: string;
  duration?: number; // seconds
  url?: string; // landing page
  tags?: string[];
  previews?: Record<string, string>;
}

interface FreesoundSearch {
  count?: number;
  next?: string | null;
  results?: FreesoundSound[];
}

const FIELDS = "id,name,username,license,duration,url,tags,previews";

export function freesoundItem(raw: FreesoundSound, provider = "freesound"): AudioItem {
  const license = parseCreativeCommons(raw.license ?? null);
  const title = (raw.name ?? "").replace(/\.(wav|mp3|aiff?|flac|ogg)$/i, "").trim() || `Sound ${raw.id}`;
  const item: AudioItem = { provider, id: String(raw.id), title, license, kind: "sfx" };
  const durationUs = secondsToUs(raw.duration);
  if (durationUs) item.durationUs = durationUs;
  if (raw.username) item.creator = raw.username;
  const preview = raw.previews?.["preview-hq-mp3"] ?? raw.previews?.["preview-lq-mp3"];
  if (preview) item.previewUrl = preview;
  if (raw.url) item.landingUrl = raw.url;
  if (license?.attributionRequired) item.attribution = creditLine(title, raw.username, license, raw.url);
  if (raw.tags?.length) item.tags = raw.tags;
  return item;
}

export function freesoundProvider(options: FreesoundProviderOptions = {}): AudioProvider {
  const id = options.id ?? "freesound";
  const base = options.baseUrl ?? "https://freesound.org/apiv2";
  const doFetch = options.fetch ?? defaultFetch();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Token ${options.token}`;

  return {
    id,
    label: options.label ?? "Freesound",
    capabilities: { search: ["sfx", "music"] },
    notice: "Freesound's API is for non-commercial use unless you have an agreement with Freesound.",

    async search(query: AudioQuery): Promise<AudioSearchResult> {
      const page = query.page ?? 1;
      const filters: string[] = [];
      if (query.minDurationS !== undefined || query.maxDurationS !== undefined) {
        filters.push(`duration:[${query.minDurationS ?? 0} TO ${query.maxDurationS ?? "*"}]`);
      }
      if (query.commercialOnly) filters.push('license:("Attribution" OR "Creative Commons 0")');
      const data = await getJson<FreesoundSearch>(
        id,
        doFetch,
        joinUrl(base, "/search/text/", {
          query: query.query,
          page,
          page_size: Math.min(query.pageSize ?? 20, 150),
          fields: FIELDS,
          filter: filters.join(" ") || undefined,
        }),
        { headers, ...(query.signal ? { signal: query.signal } : {}) },
      );
      // Freesound has no music/sfx category: kind filters are not applied.
      const items = (data.results ?? []).map((r) => freesoundItem(r, id)).filter((item) => {
        const { kind: _ignored, ...rest } = query;
        return matchesQuery(item, rest);
      });
      const result: AudioSearchResult = { items, page, hasMore: !!data.next };
      if (typeof data.count === "number") result.total = data.count;
      return result;
    },

    async getItem(itemId, opts) {
      try {
        const raw = await getJson<FreesoundSound>(id, doFetch, joinUrl(base, `/sounds/${encodeURIComponent(itemId)}/`, { fields: FIELDS }), {
          headers,
          ...(opts?.signal ? { signal: opts.signal } : {}),
        });
        return freesoundItem(raw, id);
      } catch (err) {
        if ((err as { status?: number }).status === 404) return null;
        throw err;
      }
    },

    async resolve(item) {
      if (!item.previewUrl) throw new Error(`[${id}] no preview URL for item ${item.id}`);
      return {
        src: item.previewUrl,
        mimeType: "audio/mpeg",
        name: item.title,
        source: { provider: id, id: item.id, ...(item.landingUrl ? { url: item.landingUrl } : {}) },
        ...(item.durationUs ? { durationUs: item.durationUs } : {}),
        ...(item.license ? { license: item.license } : {}),
        ...(item.attribution ? { attribution: item.attribution } : {}),
        kind: item.kind ?? "sfx",
      };
    },
  };
}
