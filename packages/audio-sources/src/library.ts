import type { AudioItem, AudioProvider, AudioQuery, AudioSearchResult, ResolvedAudio } from "./types.js";

/**
 * The set of providers an app offers. UIs, the AI tools and the MCP server
 * all read from one library, so adding a source never touches them.
 * Items from searches are remembered, so an agent can add by id.
 */
export interface AudioLibrary {
  providers(): AudioProvider[];
  get(id: string): AudioProvider | undefined;
  /** Providers that can search, optionally for one kind. */
  searchable(kind?: AudioQuery["kind"]): AudioProvider[];
  search(providerId: string, query: AudioQuery): Promise<AudioSearchResult>;
  /** Search several providers at once; failures are reported per provider. */
  searchAll(query: AudioQuery, providerIds?: string[]): Promise<{ provider: string; result?: AudioSearchResult; error?: string }[]>;
  /** A previously seen item, or a lookup through the provider's `getItem`. */
  item(providerId: string, itemId: string): Promise<AudioItem | null>;
  resolve(item: AudioItem, options?: { signal?: AbortSignal }): Promise<ResolvedAudio>;
}

export function createAudioLibrary(providers: AudioProvider[]): AudioLibrary {
  const byId = new Map<string, AudioProvider>();
  for (const p of providers) {
    if (byId.has(p.id)) throw new Error(`Duplicate audio provider id "${p.id}"`);
    byId.set(p.id, p);
  }
  const seen = new Map<string, AudioItem>();
  const key = (provider: string, id: string) => `${provider}\u0000${id}`;
  const need = (id: string) => {
    const p = byId.get(id);
    if (!p) throw new Error(`Unknown audio provider "${id}"`);
    return p;
  };

  const library: AudioLibrary = {
    providers: () => [...byId.values()],
    get: (id) => byId.get(id),
    searchable: (kind) =>
      [...byId.values()].filter((p) => p.search && p.capabilities.search && (!kind || p.capabilities.search.includes(kind))),
    async search(providerId, query) {
      const p = need(providerId);
      if (!p.search) throw new Error(`Audio provider "${providerId}" can't search`);
      const result = await p.search(query);
      for (const item of result.items) seen.set(key(item.provider, item.id), item);
      return result;
    },
    async searchAll(query, providerIds) {
      const targets = providerIds ? providerIds.map(need) : library.searchable(query.kind);
      return Promise.all(
        targets.map(async (p) => {
          try {
            return { provider: p.id, result: await library.search(p.id, query) };
          } catch (err) {
            return { provider: p.id, error: (err as Error)?.message ?? String(err) };
          }
        }),
      );
    },
    async item(providerId, itemId) {
      const cached = seen.get(key(providerId, itemId));
      if (cached) return cached;
      const p = need(providerId);
      const found = p.getItem ? await p.getItem(itemId) : null;
      if (found) seen.set(key(providerId, itemId), found);
      return found;
    },
    resolve: (item, options) => need(item.provider).resolve(item, options),
  };
  return library;
}
