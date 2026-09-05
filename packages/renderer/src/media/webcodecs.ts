/**
 * Browser adapters: mediabunny-backed demuxing and WebCodecs decoding.
 * Everything above this file is environment-agnostic and unit-tested in Node;
 * this file is the thin layer that touches real browser APIs.
 */
import {
  ALL_FORMATS,
  BlobSource,
  EncodedPacketSink,
  Input,
  UrlSource,
  type EncodedPacket,
  type InputVideoTrack,
} from "mediabunny";
import type {
  EncodedChunkLike,
  FrameDecoder,
  FrameDecoderFactory,
  Us,
  VideoFrameHandle,
  VideoTrackDemuxer,
  VideoTrackInfo,
} from "./types.js";
import { UnsupportedMediaError } from "./types.js";

const US_PER_SECOND = 1_000_000;

function secondsToUs(seconds: number): Us {
  return Math.round(seconds * US_PER_SECOND);
}

/** True when this environment can run the WebCodecs decode pipeline. */
export function isWebCodecsSupported(): boolean {
  return typeof VideoDecoder !== "undefined" && typeof VideoFrame !== "undefined";
}

/** Per-asset capability check — reject one asset, not the whole renderer. */
export async function assertDecodable(assetId: string, config: VideoDecoderConfig): Promise<void> {
  if (!isWebCodecsSupported()) {
    throw new UnsupportedMediaError(assetId, "WebCodecs is not available in this environment");
  }
  const support = await VideoDecoder.isConfigSupported(config);
  if (!support.supported) {
    throw new UnsupportedMediaError(assetId, `codec "${config.codec}" is not decodable here`, config.codec);
  }
}

class MediabunnyDemuxer implements VideoTrackDemuxer {
  constructor(
    private readonly assetId: string,
    private readonly track: InputVideoTrack,
    private readonly sink: EncodedPacketSink,
  ) {}

  async info(): Promise<VideoTrackInfo> {
    const stats = await this.track.computePacketStats(100);
    return {
      codec: (await this.track.getCodecParameterString()) ?? "unknown",
      width: this.track.displayWidth,
      height: this.track.displayHeight,
      durationUs: secondsToUs(await this.track.computeDuration()),
      fps: stats.averagePacketRate || undefined,
    };
  }

  private configCache: Promise<unknown> | undefined;

  decoderConfig(): Promise<unknown> {
    // Fetched and capability-checked once per asset, not per seek.
    this.configCache ??= (async () => {
      const config = await this.track.getDecoderConfig();
      if (!config) {
        throw new UnsupportedMediaError(this.assetId, "no decodable video track configuration");
      }
      await assertDecodable(this.assetId, config);
      return config;
    })();
    return this.configCache;
  }

  /**
   * Seek to the keyframe at or before `targetUs` and yield chunks forward.
   * Trusts the container's keyframe flags (no `verifyKeyPackets` — that decodes
   * packets to confirm them, which is far too expensive to do on every seek).
   */
  async *chunksFrom(targetUs: Us): AsyncGenerator<EncodedChunkLike, void, undefined> {
    let packet: EncodedPacket | null =
      (await this.sink.getKeyPacket(targetUs / US_PER_SECOND)) ??
      (await this.sink.getFirstKeyPacket());
    while (packet) {
      yield {
        timestampUs: secondsToUs(packet.timestamp),
        isKey: packet.type === "key",
        native: packet.toEncodedVideoChunk(),
      };
      packet = await this.sink.getNextPacket(packet);
    }
  }

  dispose(): void {
    // mediabunny inputs hold no OS resources beyond their source; GC handles it.
  }
}

export type MediaSrc = string | Blob;

/** Open the primary video track of a URL or Blob/File source. */
export async function openMediabunnyDemuxer(
  assetId: string,
  src: unknown,
): Promise<VideoTrackDemuxer> {
  const source =
    typeof src === "string"
      ? new UrlSource(src)
      : src instanceof Blob
        ? new BlobSource(src)
        : null;
  if (!source) {
    throw new UnsupportedMediaError(assetId, "src must be a URL string or a Blob/File");
  }
  const input = new Input({ formats: ALL_FORMATS, source });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new UnsupportedMediaError(assetId, "no video track found");
  return new MediabunnyDemuxer(assetId, track, new EncodedPacketSink(track));
}

export interface WebCodecsDecoderOptions {
  /**
   * Cap the longest side of decoded output bitmaps, preserving aspect ratio
   * (proxy playback). A 4K source composited onto a preview canvas doesn't
   * need full-resolution frames — and full-res 4K60 is ~4 GB/s of ImageBitmap
   * copies plus texture uploads, which drops frames on most machines. The
   * downscale happens on the GPU inside `createImageBitmap`. Layout is
   * unaffected: scene nodes normalize scale against the source's native size.
   * Leave unset for full-resolution output (export/thumbnails at full size).
   */
  maxOutputDimensionPx?: number;
}

class WebCodecsFrameDecoder implements FrameDecoder {
  onFrame: ((frame: VideoFrameHandle) => void) | null = null;
  onError: ((error: Error) => void) | null = null;
  private readonly decoder: VideoDecoder;
  private readonly pending = new Set<Promise<void>>();
  /** Bumped on reset/close so in-flight conversions from before are dropped. */
  private generation = 0;

  constructor(options: WebCodecsDecoderOptions = {}) {
    this.decoder = new VideoDecoder({
      output: (frame) => {
        // CRITICAL: hardware decoders own a small pool of output frames
        // (often ~8–16). Holding decoded VideoFrames in a cache starves the
        // pool and the decoder simply stalls until frames are closed. So we
        // copy each frame out to an ImageBitmap (GPU-side, decoder-pool-free)
        // and close the VideoFrame IMMEDIATELY — the cache and the GPU upload
        // path work with ImageBitmaps from here on.
        const generation = this.generation;
        const timestampUs = frame.timestamp;
        // Some streams (notably 60fps/B-frame H.264) report no frame duration.
        // A zero duration breaks every "does this frame cover time t" check,
        // so fall back to a conservative frame length.
        const durationUs =
          frame.duration && frame.duration > 0 ? frame.duration : 33_333;
        const cap = options.maxOutputDimensionPx;
        const sourceW = frame.displayWidth || frame.codedWidth;
        const sourceH = frame.displayHeight || frame.codedHeight;
        const longest = Math.max(sourceW, sourceH);
        const resize: ImageBitmapOptions =
          cap && longest > cap
            ? {
                resizeWidth: Math.round((sourceW * cap) / longest),
                resizeHeight: Math.round((sourceH * cap) / longest),
              }
            : {};
        const conversion = createImageBitmap(frame, resize)
          .then((bitmap) => {
            frame.close();
            const handle: VideoFrameHandle = {
              timestampUs,
              durationUs,
              byteLength: bitmap.width * bitmap.height * 4,
              native: bitmap,
              close: () => bitmap.close(),
            };
            if (generation === this.generation && this.onFrame) this.onFrame(handle);
            else handle.close();
          })
          .catch((error: unknown) => {
            frame.close();
            this.onError?.(error instanceof Error ? error : new Error(String(error)));
          })
          .finally(() => this.pending.delete(conversion));
        this.pending.add(conversion);
      },
      error: (error) => this.onError?.(error),
    });
  }

  configure(config: unknown): void {
    // optimizeForLatency: emit frames as soon as they decode rather than
    // buffering a GOP — noticeably snappier seeks.
    this.decoder.configure({
      ...(config as VideoDecoderConfig),
      optimizeForLatency: true,
    });
  }

  decode(chunk: EncodedChunkLike): void {
    this.decoder.decode(chunk.native as EncodedVideoChunk);
  }

  async flush(): Promise<void> {
    // A flush during streaming can race a reset(); ignore the resulting abort.
    await this.decoder.flush().catch(() => undefined);
    // "Flushed" must include the async ImageBitmap conversions.
    await Promise.all([...this.pending]);
  }

  reset(): void {
    this.generation++;
    if (this.decoder.state !== "closed") this.decoder.reset();
  }

  close(): void {
    this.generation++;
    if (this.decoder.state !== "closed") this.decoder.close();
  }
}

/** Full-resolution decoder factory. For preview playback of large sources, prefer `createWebCodecsDecoderFactory`. */
export const createWebCodecsDecoder: FrameDecoderFactory = () => new WebCodecsFrameDecoder();

/** A decoder factory with options — e.g. `{ maxOutputDimensionPx: 1920 }` for proxy preview of 4K sources. */
export function createWebCodecsDecoderFactory(
  options: WebCodecsDecoderOptions = {},
): FrameDecoderFactory {
  return () => new WebCodecsFrameDecoder(options);
}
