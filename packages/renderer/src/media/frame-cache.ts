import type { Us, VideoFrameHandle } from "./types.js";

export interface FrameCacheOptions {
  /** Maximum number of frames held (default 60). */
  maxFrames?: number;
  /** Maximum total bytes held (default 512 MiB — decoded frames are large). */
  maxBytes?: number;
  /**
   * Frames kept BEHIND the playhead regardless of budget headroom (default 8).
   * Played frames are only useful for a short step back; without this cap a
   * cache fills its whole budget with history (120 × 720p ≈ 440 MB per
   * pipeline), which is what exhausted mobile memory.
   */
  maxBehindFrames?: number;
  /**
   * Cap on frames that still hold decoder output buffers (`poolBacked`
   * handles — live VideoFrames), default 6. Hardware decoders own small
   * output pools (often 8–16) and stall when a cache keeps them all; 6
   * leaves headroom while still covering a few frames of decode-ahead.
   */
  maxPoolFrames?: number;
}

/**
 * Holds decoded frames around the playhead. Owns every frame it stores:
 * frames are closed when evicted, replaced, or cleared.
 */
export class FrameCache {
  private frames = new Map<Us, VideoFrameHandle>();
  private bytes = 0;
  private readonly maxFrames: number;
  private maxBytes: number;
  private readonly maxBehindFrames: number;
  private readonly maxPoolFrames: number;
  /** Frames currently held that are pool-backed (live decoder buffers). */
  private poolFrames = 0;

  constructor(options: FrameCacheOptions = {}) {
    this.maxFrames = options.maxFrames ?? 60;
    this.maxBytes = options.maxBytes ?? 512 * 1024 * 1024;
    this.maxBehindFrames = options.maxBehindFrames ?? 8;
    this.maxPoolFrames = options.maxPoolFrames ?? 6;
  }

  /**
   * How many frames this cache will hold right now: the frame cap, reduced
   * to the pool cap while it holds decoder buffers. Decode-ahead sizes itself
   * by this (see VideoPipeline.effectiveAheadUs).
   */
  get frameCapacity(): number {
    return this.poolFrames > 0 ? Math.min(this.maxFrames, this.maxPoolFrames) : this.maxFrames;
  }

  private get behindCapacity(): number {
    return this.poolFrames > 0 ? Math.min(this.maxBehindFrames, 1) : this.maxBehindFrames;
  }

  /**
   * Change the byte budget (the MediaManager splits one global budget across
   * its live pipelines). Takes effect at the next `evict`.
   */
  setByteBudget(bytes: number): void {
    this.maxBytes = Math.max(0, bytes);
  }

  get size(): number {
    return this.frames.size;
  }

  get byteSize(): number {
    return this.bytes;
  }

  get byteBudget(): number {
    return this.maxBytes;
  }

  /** Store a frame. A frame already cached at the same timestamp is replaced (and closed). */
  put(frame: VideoFrameHandle): void {
    const existing = this.frames.get(frame.timestampUs);
    if (existing) {
      this.bytes -= existing.byteLength;
      if (existing.poolBacked) this.poolFrames--;
      existing.close();
    }
    this.frames.set(frame.timestampUs, frame);
    this.bytes += frame.byteLength;
    if (frame.poolBacked) this.poolFrames++;
  }

  /**
   * The frame covering `us` ([timestamp, timestamp+duration)), or the nearest
   * earlier frame as a fallback, or undefined when nothing earlier is cached.
   */
  frameAt(us: Us): VideoFrameHandle | undefined {
    let best: VideoFrameHandle | undefined;
    for (const frame of this.frames.values()) {
      if (frame.timestampUs <= us && (!best || frame.timestampUs > best.timestampUs)) {
        best = frame;
      }
    }
    return best;
  }

  has(timestampUs: Us): boolean {
    return this.frames.has(timestampUs);
  }

  /**
   * Evict (and close) frames until within budget: **the past before the
   * future**. Behind frames go first (oldest first); ahead frames only when
   * nothing behind remains (farthest first); the frame covering the playhead
   * never.
   *
   * Symmetric farthest-from-playhead eviction is a trap during playback:
   * right after a seek the behind-tail is short, so the farthest frame is the
   * freshly decoded AHEAD frame — decode-ahead output gets discarded on
   * arrival, burning a hole in the timeline exactly one cache-capacity past
   * the seek point. The playhead reaches the hole, re-seeks (legitimately —
   * the frame really was evicted), and the new stream re-arms the same trap:
   * a re-seek every cacheCapacity/fps seconds, forever.
   */
  evict(playheadUs: Us): void {
    const covering = this.frameAt(playheadUs);
    // History cap first: frames behind the playhead beyond `maxBehindFrames`
    // go even when the budget has room (oldest first).
    let behind = 0;
    for (const frame of this.frames.values()) {
      if (frame !== covering && frame.timestampUs < playheadUs) behind++;
    }
    while (behind > this.behindCapacity) {
      let oldest: VideoFrameHandle | undefined;
      for (const frame of this.frames.values()) {
        if (frame === covering || frame.timestampUs >= playheadUs) continue;
        if (!oldest || frame.timestampUs < oldest.timestampUs) oldest = frame;
      }
      if (!oldest) break;
      this.drop(oldest);
      behind--;
    }
    while (this.frames.size > this.frameCapacity || this.bytes > this.maxBytes) {
      let victim: VideoFrameHandle | undefined;
      for (const frame of this.frames.values()) {
        if (frame === covering) continue;
        if (frame.timestampUs < playheadUs) {
          if (!victim || frame.timestampUs < victim.timestampUs) victim = frame; // oldest behind
        }
      }
      if (!victim) {
        for (const frame of this.frames.values()) {
          if (frame === covering) continue;
          if (!victim || frame.timestampUs > victim.timestampUs) victim = frame; // farthest ahead
        }
      }
      if (!victim) return; // only the covering frame left — keep it
      this.drop(victim);
    }
  }

  private drop(frame: VideoFrameHandle): void {
    this.frames.delete(frame.timestampUs);
    this.bytes -= frame.byteLength;
    if (frame.poolBacked) this.poolFrames--;
    frame.close();
  }

  /** Close and drop every cached frame. */
  clear(): void {
    for (const frame of this.frames.values()) frame.close();
    this.frames.clear();
    this.bytes = 0;
    this.poolFrames = 0;
  }
}
