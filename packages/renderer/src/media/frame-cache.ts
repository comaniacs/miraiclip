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

  /** Evict (and close) frames farthest from `playheadUs` until within budget. */
  evict(playheadUs: Us): void {
    while (this.frames.size > this.maxFrames || this.bytes > this.maxBytes) {
      let farthest: VideoFrameHandle | undefined;
      let farthestDistance = -1;
      for (const frame of this.frames.values()) {
        const distance = Math.abs(frame.timestampUs - playheadUs);
        if (distance > farthestDistance) {
          farthestDistance = distance;
          farthest = frame;
        }
      }
      if (!farthest) return;
      this.frames.delete(farthest.timestampUs);
      this.bytes -= farthest.byteLength;
      farthest.close();
    }
  }

  /** Close and drop every cached frame. */
  clear(): void {
    for (const frame of this.frames.values()) frame.close();
    this.frames.clear();
    this.bytes = 0;
  }
}
