import { VideoPipeline, type VideoPipelineOptions } from "./video-pipeline.js";
import type { DemuxerFactory, FrameDecoderFactory } from "./types.js";

export interface MediaManagerOptions {
  openDemuxer: DemuxerFactory;
  createDecoder: FrameDecoderFactory;
  /**
   * Maximum simultaneously active pipelines (≈ hardware decoder instances).
   * Browsers cap these — some Safari configurations allow very few. Default 4.
   */
  maxActivePipelines?: number;
  /**
   * A pipeline used (acquired/touched) within this window is never evicted,
   * even over the cap — the cap is then temporarily exceeded instead. Evicting
   * a pipeline that is being ticked every frame just makes its holder
   * re-acquire it, evicting another live one: an acquire/evict livelock that
   * shows up as playback churning whenever more clips are simultaneously
   * visible than the cap allows. Default 500ms; 0 restores a hard cap.
   */
  evictionIdleMs?: number;
  /**
   * Decoded-frame memory shared by ALL pipelines (default 256 MiB). Each live
   * pipeline gets an equal share (never below `minPipelineBudgetBytes`), and
   * the shares are rebalanced as pipelines open and close — so total frame
   * memory stays bounded however many clips a timeline has. Before this was
   * global, every pipeline could hold 512 MiB on its own.
   */
  frameBudgetBytes?: number;
  /** Floor for one pipeline's share of the frame budget (default 24 MiB). */
  minPipelineBudgetBytes?: number;
  /**
   * A pipeline whose holders have all released it (its clips left the
   * playhead's neighbourhood) is disposed after this long (default 1500ms).
   * The short grace keeps scrubbing back and forth across a cut cheap.
   */
  idleReleaseMs?: number;
  pipeline?: VideoPipelineOptions;
  /** Clock for idle bookkeeping (tests). Defaults to Date.now. */
  now?: () => number;
}

export interface MediaManagerStats {
  pipelines: number;
  /** Pipelines nothing currently holds (waiting out `idleReleaseMs`). */
  idlePipelines: number;
  cachedFrames: number;
  cachedBytes: number;
  frameBudgetBytes: number;
}

interface Entry {
  /** Registered synchronously so concurrent acquires share one pipeline. */
  promise: Promise<VideoPipeline>;
  pipeline: VideoPipeline | undefined;
  lastUsed: number;
  lastUsedMs: number;
  /**
   * Holders (clip adapters) currently using this pipeline. `undefined` means
   * the entry was acquired without a holder (export, tests): it is managed
   * by the LRU cap only, never by idle release.
   */
  holders: Set<string> | undefined;
  /** When the last holder left (ms), or undefined while held. */
  idleSinceMs: number | undefined;
}

function disposeEntry(entry: Entry): void {
  if (entry.pipeline) entry.pipeline.dispose();
  else void entry.promise.then((pipeline) => pipeline.dispose()).catch(() => undefined);
}

/**
 * Central owner of decode resources. One pipeline per ASSET LANE (clips that
 * never overlap share a lane; overlapping clips of one asset get separate
 * lanes), a cap on simultaneously active pipelines, idle release once no clip
 * holds a pipeline, and one frame-memory budget shared by every pipeline.
 */
export class MediaManager {
  private readonly entries = new Map<string, Entry>();
  private readonly maxActive: number;
  private readonly evictionIdleMs: number;
  private readonly idleReleaseMs: number;
  private readonly minPipelineBudget: number;
  private frameBudget: number;
  private readonly initialFrameBudget: number;
  private readonly now: () => number;
  private tick = 0;
  private disposed = false;

  constructor(private readonly options: MediaManagerOptions) {
    this.maxActive = options.maxActivePipelines ?? 4;
    this.evictionIdleMs = options.evictionIdleMs ?? 500;
    this.idleReleaseMs = options.idleReleaseMs ?? 1_500;
    this.minPipelineBudget = options.minPipelineBudgetBytes ?? 24 * 1024 * 1024;
    this.frameBudget = options.frameBudgetBytes ?? 256 * 1024 * 1024;
    this.initialFrameBudget = this.frameBudget;
    this.now = options.now ?? Date.now;
  }

  get activeCount(): number {
    return this.entries.size;
  }

  isActive(assetId: string): boolean {
    return this.entries.has(assetId);
  }

  private static keyOf(assetId: string, lane?: string): string {
    return lane === undefined ? assetId : `${assetId}\u0000${lane}`;
  }

  /**
   * The pipeline for an asset (lane), creating it — and evicting over the
   * cap — as needed. A `holder` registers the caller as a user of the
   * pipeline until `unhold`; held pipelines are never idle-released.
   */
  acquire(assetId: string, src: unknown, lane?: string, holder?: string): Promise<VideoPipeline> {
    if (this.disposed) return Promise.reject(new Error("MediaManager is disposed"));
    // A lane gives its owner a separate pipeline for the same asset — what two
    // clips of one asset decoding two positions at once (a transition overlap,
    // picture-in-picture of the same footage) need.
    const key = MediaManager.keyOf(assetId, lane);
    const existing = this.entries.get(key);
    if (existing) {
      existing.lastUsed = ++this.tick;
      existing.lastUsedMs = this.now();
      if (holder !== undefined) {
        (existing.holders ??= new Set()).add(holder);
        existing.idleSinceMs = undefined;
      }
      return existing.promise;
    }

    this.sweep();
    this.evictOverCap();

    const entry: Entry = {
      pipeline: undefined,
      lastUsed: ++this.tick,
      lastUsedMs: this.now(),
      promise: undefined!,
      holders: holder === undefined ? undefined : new Set([holder]),
      idleSinceMs: undefined,
    };
    entry.promise = (async () => {
      const demuxer = await this.options.openDemuxer(assetId, src);
      const pipeline = new VideoPipeline(demuxer, this.options.createDecoder, {
        ...this.options.pipeline,
        onMemoryPressure: () => {
          this.options.pipeline?.onMemoryPressure?.();
          this.reportMemoryPressure();
        },
        cache: { maxFrames: 120, ...this.options.pipeline?.cache, maxBytes: this.shareBytes() },
      });
      entry.pipeline = pipeline;
      // Evicted or disposed while opening — hand back a disposed pipeline.
      if (this.disposed || this.entries.get(key) !== entry) pipeline.dispose();
      else this.rebalance();
      return pipeline;
    })();
    // Registered before any await: concurrent acquires share this entry.
    this.entries.set(key, entry);
    this.rebalance();
    return entry.promise;
  }

  /**
   * Evict least-recently-used entries over the cap. Entries nobody holds go
   * first (any age); then the old rule — never one touched within
   * `evictionIdleMs`: evicting a live pipeline only makes its holder
   * re-acquire it, evicting another live one, in a loop. When every entry is
   * live the cap is temporarily exceeded instead.
   */
  private evictOverCap(): void {
    while (this.entries.size >= this.maxActive) {
      const now = this.now();
      let victim: string | undefined;
      let victimTick = Infinity;
      for (const [key, entry] of this.entries) {
        const unheld = entry.holders !== undefined && entry.holders.size === 0;
        if (unheld && entry.lastUsed < victimTick) {
          victimTick = entry.lastUsed;
          victim = key;
        }
      }
      if (victim === undefined) {
        for (const [key, entry] of this.entries) {
          if (entry.holders !== undefined && entry.holders.size > 0) continue; // a clip is using it
          if (now - entry.lastUsedMs < this.evictionIdleMs) continue; // in use
          if (entry.lastUsed < victimTick) {
            victimTick = entry.lastUsed;
            victim = key;
          }
        }
      }
      if (victim === undefined) break;
      this.drop(victim);
    }
  }

  /**
   * Mark an asset's pipeline (or a lane's) as in use WITHOUT acquiring it.
   * Holders cache the pipeline they acquired and never call acquire again, so
   * without this the LRU order freezes at acquisition time — and the eviction
   * picks the pipeline that has been held (and ticked every frame) longest,
   * i.e. exactly the one still on screen. Call it from the per-frame tick.
   */
  touch(assetId: string, lane?: string): void {
    const entry = this.entries.get(MediaManager.keyOf(assetId, lane));
    if (!entry) return;
    entry.lastUsed = ++this.tick;
    entry.lastUsedMs = this.now();
  }

  /**
   * `holder` no longer uses the pipeline (its clip left the neighbourhood of
   * the playhead, was deleted, or moved to another lane). Once no holder
   * remains the pipeline is released after `idleReleaseMs` (see `sweep`).
   */
  unhold(assetId: string, lane: string | undefined, holder: string): void {
    const entry = this.entries.get(MediaManager.keyOf(assetId, lane));
    if (!entry?.holders?.delete(holder)) return;
    if (entry.holders.size === 0) entry.idleSinceMs = this.now();
  }

  /**
   * Dispose pipelines nobody has held for `idleReleaseMs`. Cheap; the player
   * calls it from its pump, and every acquire calls it first.
   */
  sweep(): void {
    if (this.disposed) return;
    const now = this.now();
    let changed = false;
    for (const [key, entry] of this.entries) {
      if (entry.holders === undefined || entry.holders.size > 0) continue;
      if (entry.idleSinceMs !== undefined && now - entry.idleSinceMs >= this.idleReleaseMs) {
        this.entries.delete(key);
        disposeEntry(entry);
        changed = true;
      }
    }
    if (changed) this.rebalance();
  }

  /**
   * The platform is under memory pressure (a decoder was reclaimed, the GPU
   * context was lost…): shrink the frame budget by a quarter, down to one
   * minimum share per live pipeline. Playback degrades (shorter decode-ahead)
   * instead of the page being killed.
   */
  reportMemoryPressure(): void {
    const floor = this.minPipelineBudget * Math.max(1, this.entries.size);
    this.frameBudget = Math.max(floor, Math.floor(this.frameBudget * 0.75));
    this.rebalance();
  }

  /** Restore the configured frame budget (e.g. after the app is foregrounded). */
  resetMemoryBudget(): void {
    this.frameBudget = this.initialFrameBudget;
    this.rebalance();
  }

  stats(): MediaManagerStats {
    let cachedFrames = 0;
    let cachedBytes = 0;
    let idlePipelines = 0;
    for (const entry of this.entries.values()) {
      if (entry.holders !== undefined && entry.holders.size === 0) idlePipelines++;
      if (!entry.pipeline) continue;
      cachedFrames += entry.pipeline.cacheSize;
      cachedBytes += entry.pipeline.cacheBytes;
    }
    return {
      pipelines: this.entries.size,
      idlePipelines,
      cachedFrames,
      cachedBytes,
      frameBudgetBytes: this.frameBudget,
    };
  }

  /** Release one asset's pipeline (e.g. when its last clip is removed). */
  release(assetId: string): void {
    if (!this.entries.has(assetId)) return;
    this.drop(assetId);
  }

  /**
   * Drop every pipeline (decoders, caches, open demuxers). Clips that still need
   * their footage re-acquire it, opening the source anew, so a host whose media
   * links changed (they expire) gets fresh connections without rebuilding the player.
   */
  releaseAll(): void {
    for (const key of [...this.entries.keys()]) this.drop(key);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.entries.values()) disposeEntry(entry);
    this.entries.clear();
  }

  private drop(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    disposeEntry(entry);
    this.rebalance();
  }

  /** One pipeline's share of the frame budget, given the live pipeline count. */
  private shareBytes(): number {
    const share = Math.floor(this.frameBudget / Math.max(1, this.entries.size));
    const cap = this.options.pipeline?.cache?.maxBytes;
    const bytes = Math.max(this.minPipelineBudget, share);
    return cap === undefined ? bytes : Math.min(cap, bytes);
  }

  private rebalance(): void {
    const bytes = this.shareBytes();
    for (const entry of this.entries.values()) entry.pipeline?.setCacheBudget(bytes);
  }
}
