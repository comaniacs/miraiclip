import type { Us, VideoFrameHandle } from "./types.js";

export interface FrameCacheOptions {
  /** Maximum number of frames held (default 60). */
  maxFrames?: number;
  /** Maximum total bytes held (default 512 MiB — decoded frames are large). */
  maxBytes?: number;
}

/**
 * Holds decoded frames around the playhead. Owns every frame it stores:
 * frames are closed when evicted, replaced, or cleared.
 */
export class FrameCache {
  private frames = new Map<Us, VideoFrameHandle>();
  private bytes = 0;
  private readonly maxFrames: number;
  private readonly maxBytes: number;

  constructor(options: FrameCacheOptions = {}) {
    this.maxFrames = options.maxFrames ?? 60;
    this.maxBytes = options.maxBytes ?? 512 * 1024 * 1024;
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
      existing.close();
    }
    this.frames.set(frame.timestampUs, frame);
    this.bytes += frame.byteLength;
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
    while (this.frames.size > this.maxFrames || this.bytes > this.maxBytes) {
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
      this.frames.delete(victim.timestampUs);
      this.bytes -= victim.byteLength;
      victim.close();
    }
  }

  /** Close and drop every cached frame. */
  clear(): void {
    for (const frame of this.frames.values()) frame.close();
    this.frames.clear();
    this.bytes = 0;
  }
}
