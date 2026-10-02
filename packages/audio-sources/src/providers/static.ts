/**
 * An in-app catalog: files you ship or host yourself (a curated, cleared
 * library). Search matches title, tags and creator; everything is local, so
 * it works offline and needs no keys.
 */
import { matchesQuery } from "../common.js";
import type { AudioItem, AudioProvider, AudioQuery, AudioSearchResult, AudioKind } from "../types.js";
import type { AssetLicense } from "@miraiclip/core";

export interface StaticAudioEntry {
  id: string;
  title: string;
  src: string;
  kind?: AudioKind;
  durationUs?: number;
  creator?: string;
  license?: AssetLicense | null;
  attribution?: string;
  tags?: string[];
  landingUrl?: string;
  mimeType?: string;
}

export interface StaticProviderOptions {
  id: string;
  label: string;
  entries: StaticAudioEntry[];
  notice?: string;
}

export function staticProvider(options: StaticProviderOptions): AudioProvider {
  const byId = new Map(options.entries.map((e) => [e.id, e]));
  const toItem = (e: StaticAudioEntry): AudioItem => {
    const item: AudioItem = { provider: options.id, id: e.id, title: e.title, license: e.license ?? null, previewUrl: e.src };
    if (e.kind) item.kind = e.kind;
    if (e.durationUs) item.durationUs = e.durationUs;
    if (e.creator) item.creator = e.creator;
    if (e.attribution) item.attribution = e.attribution;
    if (e.tags) item.tags = e.tags;
    if (e.landingUrl) item.landingUrl = e.landingUrl;
    return item;
  };
  const kinds = [...new Set(options.entries.map((e) => e.kind).filter((k): k is AudioKind => !!k))];

  return {
    id: options.id,
    label: options.label,
    capabilities: { search: kinds.length ? kinds : ["music", "sfx"] },
    ...(options.notice ? { notice: options.notice } : {}),

    async search(query: AudioQuery): Promise<AudioSearchResult> {
      const words = query.query.toLowerCase().split(/\s+/).filter(Boolean);
      const all = options.entries.map(toItem).filter((item) => {
        if (!matchesQuery(item, query)) return false;
        const hay = [item.title, item.creator, ...(item.tags ?? [])].join(" ").toLowerCase();
        return words.every((w) => hay.includes(w));
      });
      const page = query.page ?? 1;
      const size = query.pageSize ?? 20;
      return { items: all.slice((page - 1) * size, page * size), page, hasMore: page * size < all.length, total: all.length };
    },

    async getItem(id) {
      const e = byId.get(id);
      return e ? toItem(e) : null;
    },

    async resolve(item) {
      const e = byId.get(item.id);
      if (!e) throw new Error(`[${options.id}] unknown item ${item.id}`);
      return {
        src: e.src,
        name: e.title,
        source: { provider: options.id, id: e.id, ...(e.landingUrl ? { url: e.landingUrl } : {}) },
        ...(e.mimeType ? { mimeType: e.mimeType } : {}),
        ...(e.durationUs ? { durationUs: e.durationUs } : {}),
        ...(e.license ? { license: e.license } : {}),
        ...(e.attribution ? { attribution: e.attribution } : {}),
        ...(e.kind ? { kind: e.kind } : {}),
      };
    },
  };
}
