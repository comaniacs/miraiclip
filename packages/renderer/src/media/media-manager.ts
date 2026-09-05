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
  pipeline?: VideoPipelineOptions;
}

interface Entry {
  /** Registered synchronously so concurrent acquires share one pipeline. */
  promise: Promise<VideoPipeline>;
  pipeline: VideoPipeline | undefined;
  lastUsed: number;
}

function disposeEntry(entry: Entry): void {
  if (entry.pipeline) entry.pipeline.dispose();
  else void entry.promise.then((pipeline) => pipeline.dispose()).catch(() => undefined);
}

/**
 * Central owner of decode resources. One pipeline per ASSET (clips sharing an
 * asset share the pipeline), a cap on simultaneously active pipelines with
 * least-recently-used release, and disposal that provably frees everything.
 */
export class MediaManager {
  private readonly entries = new Map<string, Entry>();
  private readonly maxActive: number;
  private tick = 0;
  private disposed = false;

  constructor(private readonly options: MediaManagerOptions) {
    this.maxActive = options.maxActivePipelines ?? 4;
  }

  get activeCount(): number {
    return this.entries.size;
  }

  isActive(assetId: string): boolean {
    return this.entries.has(assetId);
  }

  /**
   * The pipeline for an asset, creating it (and evicting the least recently
   * used one over the cap) as needed.
   */
  acquire(assetId: string, src: unknown): Promise<VideoPipeline> {
    if (this.disposed) return Promise.reject(new Error("MediaManager is disposed"));
    const existing = this.entries.get(assetId);
    if (existing) {
      existing.lastUsed = ++this.tick;
      return existing.promise;
    }

    while (this.entries.size >= this.maxActive) {
      let lruKey: string | undefined;
      let lruTick = Infinity;
      for (const [key, entry] of this.entries) {
        if (entry.lastUsed < lruTick) {
          lruTick = entry.lastUsed;
          lruKey = key;
        }
      }
      if (lruKey === undefined) break;
      const lru = this.entries.get(lruKey);
      this.entries.delete(lruKey);
      if (lru) disposeEntry(lru);
    }

    const entry: Entry = { pipeline: undefined, lastUsed: ++this.tick, promise: undefined! };
    entry.promise = (async () => {
      const demuxer = await this.options.openDemuxer(assetId, src);
      const pipeline = new VideoPipeline(
        demuxer,
        this.options.createDecoder,
        this.options.pipeline,
      );
      entry.pipeline = pipeline;
      // Evicted or disposed while opening — hand back a disposed pipeline.
      if (this.disposed || this.entries.get(assetId) !== entry) pipeline.dispose();
      return pipeline;
    })();
    // Registered before any await: concurrent acquires share this entry.
    this.entries.set(assetId, entry);
    return entry.promise;
  }

  /** Release one asset's pipeline (e.g. when its last clip is removed). */
  release(assetId: string): void {
    const entry = this.entries.get(assetId);
    if (!entry) return;
    this.entries.delete(assetId);
    disposeEntry(entry);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.entries.values()) disposeEntry(entry);
    this.entries.clear();
  }
}
