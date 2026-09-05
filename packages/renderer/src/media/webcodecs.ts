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

class WebCodecsFrameDecoder implements FrameDecoder {
  onFrame: ((frame: VideoFrameHandle) => void) | null = null;
  onError: ((error: Error) => void) | null = null;
  private readonly decoder: VideoDecoder;

  constructor() {
    this.decoder = new VideoDecoder({
      output: (frame) => {
        const handle: VideoFrameHandle = {
          timestampUs: frame.timestamp,
          durationUs: frame.duration ?? 0,
          // Estimate: 4:2:0 → 1.5 bytes per pixel.
          byteLength: Math.round(frame.codedWidth * frame.codedHeight * 1.5),
          native: frame,
          close: () => frame.close(),
        };
        if (this.onFrame) this.onFrame(handle);
        else handle.close();
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

  flush(): Promise<void> {
    // A flush during streaming can race a reset(); ignore the resulting abort.
    return this.decoder.flush().catch(() => undefined);
  }

  reset(): void {
    if (this.decoder.state !== "closed") this.decoder.reset();
  }

  close(): void {
    if (this.decoder.state !== "closed") this.decoder.close();
  }
}

export const createWebCodecsDecoder: FrameDecoderFactory = () => new WebCodecsFrameDecoder();
