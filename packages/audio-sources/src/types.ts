import type { AssetLicense, AssetSource, Us } from "@miraiclip/core";

/** What a sound is for. Providers map their own categories onto these. */
export type AudioKind = "music" | "sfx" | "voice";

/** One search result: enough to list, preview and credit it. */
export interface AudioItem {
  /** Provider id this item came from. */
  provider: string;
  /** The provider's id for the item (stable; used by `resolve` / `getItem`). */
  id: string;
  title: string;
  kind?: AudioKind;
  durationUs?: Us;
  creator?: string;
  /** A URL a plain `<audio>` element can play for previewing (no CORS needed). */
  previewUrl?: string;
  /** Where a person can see the item and its license on the provider's site. */
  landingUrl?: string;
  /** `null` when the provider gives no license (treat as not safe to use). */
  license: AssetLicense | null;
  /** The credit line the license asks for, when it asks for one. */
  attribution?: string;
  tags?: string[];
}

/** A search. Filters a provider can't apply server-side are applied to the page it returns. */
export interface AudioQuery {
  query: string;
  kind?: AudioKind;
  /** Only items whose license allows commercial use. */
  commercialOnly?: boolean;
  minDurationS?: number;
  maxDurationS?: number;
  /** 1-based. */
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export interface AudioSearchResult {
  items: AudioItem[];
  page: number;
  hasMore: boolean;
  total?: number;
}

/**
 * A playable file plus everything `asset/add` records about it. `src` is a
 * URL the renderer can fetch (Range + CORS) — apps that copy remote files
 * into their own storage replace it before importing (see `importAudio`).
 */
export interface ResolvedAudio {
  src: string;
  mimeType?: string;
  durationUs?: Us;
  name: string;
  source: AssetSource;
  license?: AssetLicense;
  attribution?: string;
  kind?: AudioKind;
}

export interface GenerateAudioRequest {
  prompt: string;
  kind: AudioKind;
  durationS?: number;
  signal?: AbortSignal;
}

export type AudioJobStatus = "queued" | "running" | "done" | "failed" | "canceled";

/** A generation in progress. `result` settles when the job finishes. */
export interface AudioJob {
  id: string;
  readonly status: AudioJobStatus;
  /** 0..1 when the provider reports it. */
  readonly progress?: number;
  result: Promise<ResolvedAudio>;
  cancel(): void;
}

export interface AudioProviderCapabilities {
  /** Kinds `search` can return. Absent: the provider can't search. */
  search?: AudioKind[];
  /** Kinds `generate` can produce. Absent: the provider can't generate. */
  generate?: AudioKind[];
}

/**
 * One audio source: a stock library, an in-app catalog, a generation service.
 * Network-facing adapters take `fetch` and a base URL so apps can route them
 * through their own backend (keys stay server-side, CORS is a non-issue).
 */
export interface AudioProvider {
  id: string;
  label: string;
  capabilities: AudioProviderCapabilities;
  /** Short note shown to users, e.g. terms of use. */
  notice?: string;
  search?(query: AudioQuery): Promise<AudioSearchResult>;
  /** Look up one item by id (lets an agent add by id after a search). */
  getItem?(id: string, options?: { signal?: AbortSignal }): Promise<AudioItem | null>;
  /** Turn an item into a playable file with its provenance. */
  resolve(item: AudioItem, options?: { signal?: AbortSignal }): Promise<ResolvedAudio>;
  generate?(request: GenerateAudioRequest): AudioJob;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
