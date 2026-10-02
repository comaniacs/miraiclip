/**
 * Openverse (openverse.org): openly licensed audio aggregated from Freesound,
 * Jamendo, Wikimedia Commons, ccMixter and others. No key needed for
 * anonymous use (rate-limited; register for higher limits). Licenses are
 * per item and include non-commercial ones — use `commercialOnly` to filter.
 *
 * API: https://api.openverse.org/v1/ (GET /audio/, GET /audio/{id}/).
 */
import type { AssetLicense } from "@miraiclip/core";
import { defaultFetch, getJson, joinUrl, matchesQuery, secondsToUs } from "../common.js";
import { creditLine, parseCreativeCommons } from "../licenses.js";
import type { AudioItem, AudioKind, AudioProvider, AudioQuery, AudioSearchResult, FetchLike } from "../types.js";

export interface OpenverseProviderOptions {
  /** Default "https://api.openverse.org". Point at your backend proxy to avoid CORS/rate limits. */
  baseUrl?: string;
  /** OAuth access token for registered apps (higher rate limits). */
  accessToken?: string;
  /** Restrict to these upstream sources, e.g. ["freesound", "jamendo", "wikimedia_audio"]. */
  sources?: string[];
  fetch?: FetchLike;
  id?: string;
  label?: string;
}

/** The parts of an Openverse audio result this adapter reads. */
export interface OpenverseAudio {
  id: string;
  title?: string | null;
  url?: string | null;
  foreign_landing_url?: string | null;
  creator?: string | null;
  license?: string | null;
  license_version?: string | null;
  license_url?: string | null;
  attribution?: string | null;
  category?: string | null;
  duration?: number | null; // milliseconds
  filetype?: string | null;
  tags?: { name: string }[] | null;
  source?: string | null;
}

interface OpenverseSearch {
  result_count?: number;
  page_count?: number;
  page?: number;
  results?: OpenverseAudio[];
}

const CATEGORY: Record<AudioKind, string | undefined> = { music: "music", sfx: "sound_effect", voice: undefined };

function kindOf(category: string | null | undefined): AudioKind | undefined {
  if (category === "music") return "music";
  if (category === "sound_effect") return "sfx";
  if (category === "podcast" || category === "audio_book" || category === "news") return "voice";
  return undefined;
}

export function openverseItem(raw: OpenverseAudio, provider = "openverse"): AudioItem {
  const license: AssetLicense | null =
    parseCreativeCommons(raw.license_url ?? null) ?? parseCreativeCommons(raw.license ?? null, raw.license_version ?? null);
  const title = raw.title?.trim() || "Untitled";
  const item: AudioItem = { provider, id: raw.id, title, license };
  const kind = kindOf(raw.category);
  if (kind) item.kind = kind;
  const durationUs = secondsToUs(typeof raw.duration === "number" ? raw.duration / 1000 : undefined);
  if (durationUs) item.durationUs = durationUs;
  if (raw.creator) item.creator = raw.creator;
  if (raw.url) item.previewUrl = raw.url;
  if (raw.foreign_landing_url) item.landingUrl = raw.foreign_landing_url;
  if (license?.attributionRequired) {
    item.attribution = raw.attribution?.trim() || creditLine(title, raw.creator ?? undefined, license, raw.foreign_landing_url ?? undefined);
  }
  const tags = raw.tags?.map((t) => t.name).filter(Boolean);
  if (tags?.length) item.tags = tags;
  return item;
}

export function openverseProvider(options: OpenverseProviderOptions = {}): AudioProvider {
  const id = options.id ?? "openverse";
  const base = options.baseUrl ?? "https://api.openverse.org";
  const doFetch = options.fetch ?? defaultFetch();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  const urls = new Map<string, { url: string; filetype?: string }>();

  const remember = (raw: OpenverseAudio) => {
    if (raw.url) urls.set(raw.id, { url: raw.url, ...(raw.filetype ? { filetype: raw.filetype } : {}) });
    return openverseItem(raw, id);
  };

  return {
    id,
    label: options.label ?? "Openverse",
    capabilities: { search: ["music", "sfx", "voice"] },
    notice: "Openly licensed audio from many sources. Check each item's license; some are non-commercial.",

    async search(query: AudioQuery): Promise<AudioSearchResult> {
      const page = query.page ?? 1;
      const pageSize = Math.min(query.pageSize ?? 20, 20); // anonymous max
      const data = await getJson<OpenverseSearch>(
        id,
        doFetch,
        joinUrl(base, "/v1/audio/", {
          q: query.query,
          page,
          page_size: pageSize,
          category: query.kind ? CATEGORY[query.kind] : undefined,
          license_type: query.commercialOnly ? "commercial" : undefined,
          source: options.sources?.join(","),
        }),
        { headers, ...(query.signal ? { signal: query.signal } : {}) },
      );
      const items = (data.results ?? []).map(remember).filter((item) => matchesQuery(item, query));
      const result: AudioSearchResult = { items, page, hasMore: page < (data.page_count ?? page) };
      if (typeof data.result_count === "number") result.total = data.result_count;
      return result;
    },

    async getItem(itemId, opts) {
      try {
        const raw = await getJson<OpenverseAudio>(id, doFetch, joinUrl(base, `/v1/audio/${encodeURIComponent(itemId)}/`), {
          headers,
          ...(opts?.signal ? { signal: opts.signal } : {}),
        });
        return remember(raw);
      } catch (err) {
        if ((err as { status?: number }).status === 404) return null;
        throw err;
      }
    },

    async resolve(item) {
      const file = urls.get(item.id) ?? (item.previewUrl ? { url: item.previewUrl } : null);
      if (!file) throw new Error(`[${id}] no file URL for item ${item.id}`);
      const resolved = {
        src: file.url,
        name: item.title,
        source: { provider: id, id: item.id, ...(item.landingUrl ? { url: item.landingUrl } : {}) },
        ...(file.filetype ? { mimeType: mimeOf(file.filetype) } : {}),
        ...(item.durationUs ? { durationUs: item.durationUs } : {}),
        ...(item.license ? { license: item.license } : {}),
        ...(item.attribution ? { attribution: item.attribution } : {}),
        ...(item.kind ? { kind: item.kind } : {}),
      };
      return resolved;
    },
  };
}

export function mimeOf(filetype: string): string {
  const t = filetype.toLowerCase();
  return (
    { mp3: "audio/mpeg", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", wav: "audio/wav", flac: "audio/flac", m4a: "audio/mp4", aac: "audio/aac", webm: "audio/webm" } as Record<string, string>
  )[t] ?? `audio/${t}`;
}
