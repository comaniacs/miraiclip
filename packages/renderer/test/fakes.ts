import type {
  EncodedChunkLike,
  FrameDecoder,
  Us,
  VideoFrameHandle,
  VideoTrackDemuxer,
  VideoTrackInfo,
} from "../src/media/types.js";

export interface FakeFrame extends VideoFrameHandle {
  closed: boolean;
}

export function fakeFrame(timestampUs: Us, durationUs = 33_333, byteLength = 100): FakeFrame {
  const frame: FakeFrame = {
    timestampUs,
    durationUs,
    byteLength,
    native: { timestampUs },
    closed: false,
    close() {
      if (frame.closed) throw new Error(`double close of frame @${timestampUs}`);
      frame.closed = true;
    },
  };
  return frame;
}

/**
 * A synthetic 30fps stream with a keyframe every `gopSize` frames.
 * Chunk timestamps: frame i at i * 33_333µs.
 */
export class FakeDemuxer implements VideoTrackDemuxer {
  disposed = false;
  chunksServed: Us[] = [];
  /** How many times a fresh chunk stream was opened (i.e. a keyframe re-seek). */
  iteratorsCreated = 0;
  static readonly FRAME_US = 33_333;

  constructor(
    private readonly frameCount: number,
    private readonly gopSize = 30,
  ) {}

  info(): Promise<VideoTrackInfo> {
    return Promise.resolve({
      codec: "fake",
      width: 640,
      height: 360,
      durationUs: this.frameCount * FakeDemuxer.FRAME_US,
      fps: 30,
    });
  }

  decoderConfig(): Promise<unknown> {
    return Promise.resolve({ codec: "fake" });
  }

  private frameIndexAtOrBefore(us: Us): number {
    return Math.min(Math.floor(us / FakeDemuxer.FRAME_US), this.frameCount - 1);
  }

  async *chunksFrom(targetUs: Us): AsyncGenerator<EncodedChunkLike, void, undefined> {
    this.iteratorsCreated++;
    // Seek to the keyframe at or before the target (internal, single lookup).
    const index = this.frameIndexAtOrBefore(targetUs);
    const startIndex = index - (index % this.gopSize);
    for (let i = startIndex; i < this.frameCount; i++) {
      const timestampUs = i * FakeDemuxer.FRAME_US;
      this.chunksServed.push(timestampUs);
      yield { timestampUs, isKey: i % this.gopSize === 0, native: { timestampUs } };
      await Promise.resolve(); // yield to the event loop, like real demuxing
    }
  }

  dispose(): void {
    this.disposed = true;
  }
}

/** Decoder that synchronously emits one frame per chunk on flush-free decode. */
export class FakeDecoder implements FrameDecoder {
  static instances: FakeDecoder[] = [];
  onFrame: ((frame: VideoFrameHandle) => void) | null = null;
  onError: ((error: Error) => void) | null = null;
  configured = false;
  closed = false;
  resets = 0;
  decoded: Us[] = [];
  emitted: FakeFrame[] = [];

  constructor() {
    FakeDecoder.instances.push(this);
  }

  configure(): void {
    this.configured = true;
  }

  decode(chunk: EncodedChunkLike): void {
    this.decoded.push(chunk.timestampUs);
    const frame = fakeFrame(chunk.timestampUs);
    this.emitted.push(frame);
    this.onFrame?.(frame);
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }

  reset(): void {
    this.resets++;
  }

  close(): void {
    this.closed = true;
  }
}

export const createFakeDecoder = (): FakeDecoder => new FakeDecoder();
