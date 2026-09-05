/** Microseconds, matching @miraiclip/core's timeline unit. */
export type Us = number;

/**
 * A decoded video frame owned by the cache. `close()` releases the underlying
 * resource (a WebCodecs `VideoFrame` in the browser) — every handle MUST be
 * closed exactly once, by whoever holds it last.
 */
export interface VideoFrameHandle {
  /** Presentation timestamp on the media's own timeline. */
  readonly timestampUs: Us;
  readonly durationUs: Us;
  /** Approximate memory footprint, for cache budgeting. */
  readonly byteLength: number;
  /** The underlying frame (a `VideoFrame` in the browser). */
  readonly native: unknown;
  close(): void;
}

/** An encoded chunk flowing from demuxer to decoder. Opaque beyond metadata. */
export interface EncodedChunkLike {
  readonly timestampUs: Us;
  readonly isKey: boolean;
  /** The underlying chunk (an `EncodedVideoChunk` in the browser). */
  readonly native: unknown;
}

export interface VideoTrackInfo {
  readonly codec: string;
  readonly width: number;
  readonly height: number;
  readonly durationUs: Us;
  readonly fps: number | undefined;
}

/**
 * Demuxer abstraction over one media source's primary video track.
 * The real implementation wraps mediabunny; tests inject fakes.
 */
export interface VideoTrackDemuxer {
  info(): Promise<VideoTrackInfo>;
  /** Opaque decoder configuration (a WebCodecs `VideoDecoderConfig`); cached per asset. */
  decoderConfig(): Promise<unknown>;
  /**
   * Seek to the keyframe at or before `targetUs` and yield chunks in decode
   * order from there. The demuxer owns the single keyframe lookup.
   */
  chunksFrom(targetUs: Us): AsyncGenerator<EncodedChunkLike, void, undefined>;
  dispose(): void;
}

/** Decoder abstraction (a WebCodecs `VideoDecoder` in the browser). */
export interface FrameDecoder {
  configure(config: unknown): void;
  decode(chunk: EncodedChunkLike): void;
  /** Resolves once all pending frames have been emitted via `onFrame`. */
  flush(): Promise<void>;
  /**
   * Abort in-flight work and drop pending frames, so the same decoder can be
   * re-pointed to a new keyframe without a costly teardown/re-init. The
   * decoder returns to an unconfigured state — `configure` before decoding.
   */
  reset(): void;
  close(): void;
  onFrame: ((frame: VideoFrameHandle) => void) | null;
  onError: ((error: Error) => void) | null;
}

export type FrameDecoderFactory = () => FrameDecoder;
export type DemuxerFactory = (assetId: string, src: unknown) => Promise<VideoTrackDemuxer>;

/** Raised when an asset's codec cannot be decoded in this environment. */
export class UnsupportedMediaError extends Error {
  readonly assetId: string;
  readonly codec: string | undefined;

  constructor(assetId: string, message: string, codec?: string) {
    super(`Asset "${assetId}": ${message}`);
    this.name = "UnsupportedMediaError";
    this.assetId = assetId;
    this.codec = codec;
  }
}
