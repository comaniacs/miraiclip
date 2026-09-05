import { FrameCache, type FrameCacheOptions } from "./frame-cache.js";
import type {
  EncodedChunkLike,
  FrameDecoder,
  FrameDecoderFactory,
  Us,
  VideoFrameHandle,
  VideoTrackDemuxer,
  VideoTrackInfo,
} from "./types.js";

export interface VideoPipelineOptions {
  /** How far past the target to keep decoding ahead (default 1s). */
  aheadUs?: Us;
  /**
   * A forward jump larger than this triggers a fresh keyframe seek instead of
   * decoding through the gap (default 3s). Backward jumps always re-seek.
   */
  reseekGapUs?: Us;
  cache?: FrameCacheOptions;
}

/**
 * Per-asset decode pipeline with continuous streaming: one decoder is kept
 * alive and fed forward as the playhead advances (with an ahead budget as
 * backpressure). A fresh keyframe seek happens only on a backward jump or a
 * large forward jump — linear playback never tears the decoder down, which is
 * what keeps preview smooth. A `prime()` whose target invalidates the current
 * decode position aborts the in-flight feed via a generation counter.
 */
export class VideoPipeline {
  private readonly cache: FrameCache;
  private readonly aheadUs: Us;
  private readonly reseekGapUs: Us;
  private disposed = false;

  private epoch = 0;
  private decoder: FrameDecoder | null = null;
  private iterator: AsyncGenerator<EncodedChunkLike, void, undefined> | null = null;
  private iteratorDone = false;
  /**
   * Target of the current stream's seek: the stream is guaranteed to produce
   * every frame from here forward, so a target at or past it never needs a
   * re-seek just because its frame hasn't *arrived* yet.
   */
  private streamStartUs = Number.POSITIVE_INFINITY;
  /**
   * Highest chunk timestamp fed to the decoder, kept MONOTONIC: with B-frames,
   * chunks arrive in decode order and their timestamps oscillate.
   */
  private maxFedUs = Number.NEGATIVE_INFINITY;
  /**
   * Contiguity watermark: the highest timestamp below which EVERY frame of
   * this stream has arrived in the cache at least once. Frame conversions
   * complete slightly out of order (each is an async GPU copy), and decode
   * runs far faster than realtime — so "newest arrival is far past the
   * target" says nothing about whether the target's own frame arrived. A
   * missing frame at or below the watermark was provably evicted (re-seek);
   * above it, it is still in flight (wait — a re-seek would discard it).
   */
  private contiguousThroughUs = Number.NEGATIVE_INFINITY;
  /** Arrivals above the watermark, waiting for the gap below them to fill. */
  private pendingArrivalsUs: Us[] = [];
  private targetUs = 0;
  private needsReseek = true;
  private decodeError: Error | undefined;
  private pumpPromise: Promise<void> | null = null;
  /**
   * Set on a hard seek: frames ending at or before this are decode lead-in
   * (needed by the decoder, never presentable) and are closed instead of
   * cached. Cleared the moment the first presentable frame arrives. This is
   * the canonical WebCodecs seek pattern — it makes a seek snap straight to
   * the target instead of fast-forwarding through the GOP.
   */
  private settleUntilUs: Us | null = null;
  /**
   * Estimated frame duration, MEASURED from consecutive arrival timestamps —
   * never from reported frame durations, which some streams omit entirely (the
   * fallback then claims 33ms for a 60fps file, making the time-based ahead
   * window feed twice the frames the byte budget can hold). Sizes the budgeted
   * ahead window; smoothed to ride out out-of-order conversion completions.
   */
  private frameDurationUs: Us = 33_333;
  private lastArrivedUs: Us | undefined;

  constructor(
    private readonly demuxer: VideoTrackDemuxer,
    private readonly createDecoder: FrameDecoderFactory,
    options: VideoPipelineOptions = {},
  ) {
    this.aheadUs = options.aheadUs ?? 1_000_000;
    this.reseekGapUs = options.reseekGapUs ?? 3_000_000;
    // The byte budget matters as much as the frame count: 120 uncapped 4K
    // ImageBitmaps is ~4 GB of GPU-adjacent memory.
    this.cache = new FrameCache(
      options.cache ?? { maxFrames: 120, maxBytes: 512 * 1024 * 1024 },
    );
  }

  frameAt(us: Us): VideoFrameHandle | undefined {
    return this.cache.frameAt(us);
  }

  private infoPromise: Promise<VideoTrackInfo> | undefined;

  /** Track metadata (native size, duration, fps) — fetched once, then cached. */
  info(): Promise<VideoTrackInfo> {
    this.infoPromise ??= this.demuxer.info();
    return this.infoPromise;
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  /** Ensure frames around `targetUs` are decoded into the cache. */
  prime(targetUs: Us): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.targetUs = targetUs;
    // Re-seek decisions must be DETERMINISTIC in stream state, never in decode
    // timing: frames land in the cache asynchronously (decoder callback plus a
    // GPU copy), so "chunk was fed but frame isn't cached" is the normal
    // in-flight state, not a miss. Inferring "behind" from it re-seeks in a
    // loop, and each re-seek discards the in-flight frames that would have
    // ended the loop — black video with a pegged CPU on slow-to-convert (4K)
    // streams. So: re-seek only when the target is before what this stream
    // can ever produce, provably evicted, or a far forward jump.
    const covering = this.cache.frameAt(targetUs);
    // Duration-defensive: streams reporting zero frame durations must not make
    // every cached frame look like a miss.
    const coverageUs = Math.max(covering?.durationUs ?? 0, 33_333);
    const cached = !!covering && targetUs < covering.timestampUs + coverageUs;
    const beforeStream = targetUs < this.streamStartUs;
    const evicted = !cached && targetUs <= this.contiguousThroughUs;
    const streamPosUs = Math.max(
      this.streamStartUs === Number.POSITIVE_INFINITY ? 0 : this.streamStartUs,
      this.maxFedUs,
    );
    const jumpedFar = targetUs > streamPosUs + this.reseekGapUs;
    if (!this.decoder || beforeStream || evicted || jumpedFar) {
      this.needsReseek = true;
      this.epoch++; // abort any in-flight feed
    }
    if (!this.pumpPromise) {
      this.pumpPromise = this.pump().finally(() => {
        this.pumpPromise = null;
      });
    }
    return this.pumpPromise;
  }

  /**
   * The ahead window in time, capped by what the byte budget can actually
   * hold. Decoding a fixed 1s ahead regardless of frame size overruns the
   * cache at 4K (60 frames ≈ 2 GB into a ~15-frame budget): frames the
   * playhead is about to reach get evicted the moment they arrive, which
   * looks like an eviction and forces a re-seek every few hundred ms. The
   * window adapts instead: big frames → decode less ahead.
   */
  private effectiveAheadUs(): Us {
    const size = this.cache.size;
    if (size === 0) return this.aheadUs;
    const bytesPerFrame = this.cache.byteSize / size;
    if (bytesPerFrame <= 0) return this.aheadUs;
    const budgetFrames = Math.max(
      4,
      Math.floor((this.cache.byteBudget * 0.75) / bytesPerFrame),
    );
    return Math.min(this.aheadUs, budgetFrames * this.frameDurationUs);
  }

  /**
   * Advance the contiguity watermark through (possibly out-of-order) arrivals.
   * The watermark is anchored below the seek target at reseek time — NEVER at
   * the first arrival: after a seek the first conversion is often the slowest
   * (pipeline warmup), so a later frame lands first, and anchoring there would
   * put the still-in-flight target "below the watermark" → misread as evicted
   * → re-seek → the same race on the new stream, forever.
   */
  private recordArrival(timestampUs: Us): void {
    if (timestampUs <= this.contiguousThroughUs) return;
    this.pendingArrivalsUs.push(timestampUs);
    let advanced = true;
    while (advanced) {
      advanced = false;
      for (let i = 0; i < this.pendingArrivalsUs.length; i++) {
        const ts = this.pendingArrivalsUs[i]!;
        if (ts <= this.contiguousThroughUs) {
          this.pendingArrivalsUs.splice(i, 1);
          i--;
          continue;
        }
        // "Next frame" tolerance: 2× the measured spacing absorbs jitter.
        if (ts <= this.contiguousThroughUs + 2 * this.frameDurationUs) {
          this.contiguousThroughUs = ts;
          this.pendingArrivalsUs.splice(i, 1);
          advanced = true;
          break;
        }
      }
    }
    // Safety valve: a frame the decoder never emits must not stall the
    // watermark forever (that would disable eviction re-seeks for the stream).
    // Sized well above the decoder's in-flight depth so a mere straggler —
    // decode runs at hundreds of fps — can never trip it.
    if (this.pendingArrivalsUs.length > 120) {
      this.contiguousThroughUs = Math.min(...this.pendingArrivalsUs);
      this.pendingArrivalsUs = this.pendingArrivalsUs.filter(
        (ts) => ts > this.contiguousThroughUs,
      );
    }
  }

  private async pump(): Promise<void> {
    while (!this.disposed) {
      const epoch = this.epoch;

      if (this.needsReseek) {
        this.needsReseek = false;
        await this.reseek(this.targetUs, epoch);
        if (epoch !== this.epoch || this.disposed) continue;
      }
      if (!this.decoder || !this.iterator) return;

      while (
        this.maxFedUs < this.targetUs + this.effectiveAheadUs() &&
        !this.iteratorDone &&
        !this.disposed &&
        !this.needsReseek &&
        !this.decodeError &&
        epoch === this.epoch
      ) {
        const { value, done } = await this.iterator.next();
        // dispose()/reseek can land while awaiting the chunk read.
        if (this.disposed || epoch !== this.epoch || !this.decoder) break;
        if (done) {
          this.iteratorDone = true;
          break;
        }
        this.decoder.decode(value);
        this.maxFedUs = Math.max(this.maxFedUs, value.timestampUs);
      }

      if (this.disposed) return;
      if (epoch !== this.epoch || this.needsReseek) continue;
      if (this.decodeError) {
        const error = this.decodeError;
        this.decodeError = undefined;
        throw error;
      }
      // Drain remaining frames when the stream is exhausted.
      if (this.iteratorDone && this.decoder) await this.decoder.flush();
      return;
    }
  }

  private async reseek(targetUs: Us, epoch: number): Promise<void> {
    // Claim coverage immediately: primes landing during the (async) seek must
    // not schedule another one for the same region. If this seek is aborted,
    // the abort's own needsReseek re-runs it with the latest target.
    this.streamStartUs = targetUs;
    // Reuse the live decoder: reset() drops pending frames (so no stale ones
    // arrive) and avoids re-initializing a hardware decoder on every seek.
    if (!this.decoder) {
      const decoder = this.createDecoder();
      decoder.onFrame = (frame) => {
        if (this.disposed) {
          frame.close();
          return;
        }
        if (this.settleUntilUs !== null) {
          // Strictly-before check: a frame starting AT the target is always
          // presentable, even if the stream reports zero frame durations.
          if (
            frame.timestampUs < this.settleUntilUs &&
            frame.timestampUs + frame.durationUs <= this.settleUntilUs
          ) {
            frame.close(); // post-seek lead-in: decoded but never shown
            return;
          }
          this.settleUntilUs = null; // reached the target — presentable from here
        }
        this.cache.put(frame);
        if (this.lastArrivedUs !== undefined) {
          const deltaUs = frame.timestampUs - this.lastArrivedUs;
          if (deltaUs > 1_000 && deltaUs < 200_000) {
            this.frameDurationUs = Math.round(
              this.frameDurationUs * 0.8 + deltaUs * 0.2,
            );
          }
        }
        this.lastArrivedUs = frame.timestampUs;
        this.recordArrival(frame.timestampUs);
        this.cache.evict(this.targetUs);
      };
      decoder.onError = (error) => {
        this.decodeError = error;
      };
      this.decoder = decoder;
    } else {
      this.decoder.reset();
    }
    this.decodeError = undefined;

    const config = await this.demuxer.decoderConfig(); // cached after first call
    if (epoch !== this.epoch || this.disposed) return;
    this.decoder.configure(config);

    // A hard seek lands in a different GOP: drop the old frames so the display
    // holds the last correct frame instead of flashing stale content, then the
    // new GOP decodes in. The demuxer does the single keyframe seek internally.
    this.cache.clear();
    if (this.iterator) void this.iterator.return?.(undefined);
    this.iterator = this.demuxer.chunksFrom(targetUs);
    this.iteratorDone = false;
    this.maxFedUs = Number.NEGATIVE_INFINITY;
    // Anchor just below the target: the first presentable frame (the one
    // covering the target) sits within a couple of frame-durations of it, so
    // contiguous advancement reaches it — but an out-of-order later arrival
    // cannot leapfrog the watermark past frames still in flight.
    this.contiguousThroughUs = targetUs - 2 * this.frameDurationUs;
    this.pendingArrivalsUs = [];
    this.lastArrivedUs = undefined;
    this.settleUntilUs = targetUs;
  }

  private teardownDecoder(): void {
    if (this.iterator) {
      void this.iterator.return?.(undefined);
      this.iterator = null;
    }
    if (this.decoder) {
      this.decoder.onFrame = (frame) => frame.close();
      this.decoder.close();
      this.decoder = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.epoch++;
    this.teardownDecoder();
    this.cache.clear();
    this.demuxer.dispose();
  }
}
