import { FrameCache, type FrameCacheOptions } from "./frame-cache.js";
import type {
  EncodedChunkLike,
  FrameDecoder,
  FrameDecoderFactory,
  Us,
  VideoFrameHandle,
  VideoTrackDemuxer,
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
  /** Keyframe timestamp the current decoder started from. */
  /** Timestamp of the last chunk fed to the decoder. */
  private fedThroughUs = Number.NEGATIVE_INFINITY;
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

  constructor(
    private readonly demuxer: VideoTrackDemuxer,
    private readonly createDecoder: FrameDecoderFactory,
    options: VideoPipelineOptions = {},
  ) {
    this.aheadUs = options.aheadUs ?? 1_000_000;
    this.reseekGapUs = options.reseekGapUs ?? 3_000_000;
    this.cache = new FrameCache(options.cache ?? { maxFrames: 120 });
  }

  frameAt(us: Us): VideoFrameHandle | undefined {
    return this.cache.frameAt(us);
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  /** Ensure frames around `targetUs` are decoded into the cache. */
  prime(targetUs: Us): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.targetUs = targetUs;
    // The live decoder is a forward-only stream: it has already passed
    // everything at or before `fedThroughUs` and cannot rewind. So re-seek
    // when the target is behind the decode position and no longer cached, or
    // when it jumps far enough ahead that seeking beats decoding through.
    const covering = this.cache.frameAt(targetUs);
    const cached = !!covering && targetUs < covering.timestampUs + covering.durationUs;
    const behindStream = targetUs <= this.fedThroughUs && !cached;
    const jumpedFar = targetUs > this.fedThroughUs + this.reseekGapUs;
    if (!this.decoder || behindStream || jumpedFar) {
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
        this.fedThroughUs < this.targetUs + this.aheadUs &&
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
        this.fedThroughUs = value.timestampUs;
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
          if (frame.timestampUs + frame.durationUs <= this.settleUntilUs) {
            frame.close(); // post-seek lead-in: decoded but never shown
            return;
          }
          this.settleUntilUs = null; // reached the target — presentable from here
        }
        this.cache.put(frame);
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
    this.fedThroughUs = Number.NEGATIVE_INFINITY;
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
