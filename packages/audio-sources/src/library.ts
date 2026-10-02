import type { AudioItem, AudioProvider, AudioQuery, AudioSearchResult, ResolvedAudio } from "./types.js";
import { startGeneration, type GenerationJob, type StartGenerationOptions } from "./generate/run.js";
import type { AudioGenerator, GenerateRequest } from "./generate/types.js";

/**
 * The set of providers (search) and generators (AI) an app offers. UIs, the
 * AI tools and the MCP server all read from one library, so adding a source
 * or swapping a generation vendor never touches them. Items from searches
 * are remembered, so an agent can add by id.
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
  /** Generators, optionally those that can make one kind. */
  generators(kind?: GenerateRequest["kind"]): AudioGenerator[];
  generator(id: string): AudioGenerator | undefined;
  /** Register a generator later (e.g. after `remoteGenerators()` resolves). Replaces one with the same id. */
  addGenerator(generator: AudioGenerator): void;
  /** Start a generation job (validated against the generator's kinds and limits). */
  generate(generatorId: string, request: GenerateRequest, options?: StartGenerationOptions): GenerationJob;
  /** Subscribe to generator registrations. */
  onGeneratorsChange(listener: () => void): () => void;
}

export interface CreateAudioLibraryOptions {
  generators?: AudioGenerator[];
}

export function createAudioLibrary(providers: AudioProvider[], options: CreateAudioLibraryOptions = {}): AudioLibrary {
  const byId = new Map<string, AudioProvider>();
  for (const p of providers) {
    if (byId.has(p.id)) throw new Error(`Duplicate audio provider id "${p.id}"`);
    byId.set(p.id, p);
  }
  const seen = new Map<string, AudioItem>();
  const gens = new Map<string, AudioGenerator>();
  for (const g of options.generators ?? []) {
    if (gens.has(g.id)) throw new Error(`Duplicate audio generator id "${g.id}"`);
    gens.set(g.id, g);
  }
  const genListeners = new Set<() => void>();
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
    resolve: (item, opts) => need(item.provider).resolve(item, opts),
    generators: (kind) => [...gens.values()].filter((g) => !kind || g.kinds.includes(kind)),
    generator: (id) => gens.get(id),
    addGenerator(generator) {
      gens.set(generator.id, generator);
      genListeners.forEach((l) => l());
    },
    generate(generatorId, request, opts) {
      const g = gens.get(generatorId);
      if (!g) throw new Error(`Unknown audio generator "${generatorId}"`);
      return startGeneration(g, request, opts);
    },
    onGeneratorsChange(listener) {
      genListeners.add(listener);
      return () => genListeners.delete(listener);
    },
  };
  return library;
}
