/**
 * The production ExportSink: mediabunny `Output` + WebCodecs encoding.
 * MP4 (H.264 + AAC) and WebM (VP9 + Opus). Browser-only; everything above it
 * (the export orchestrator) is environment-agnostic and unit-tested in Node.
 */
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  type Quality,
} from "mediabunny";
import { UnsupportedMediaError } from "../media/types.js";
import type { Us } from "../media/types.js";
import type { ExportSink } from "./types.js";

export type ExportFormat = "mp4" | "webm";
export type ExportQualityPreset = "draft" | "standard" | "high";

const CODECS: Record<ExportFormat, { video: "avc" | "vp9"; audio: "aac" | "opus" }> = {
  mp4: { video: "avc", audio: "aac" },
  webm: { video: "vp9", audio: "opus" },
};

const QUALITIES: Record<ExportQualityPreset, Quality> = {
  draft: QUALITY_LOW,
  standard: QUALITY_MEDIUM,
  high: QUALITY_HIGH,
};

export interface CreateMediabunnySinkOptions {
  /** The canvas the compositor renders into — captured once per frame. */
  canvas: HTMLCanvasElement | OffscreenCanvas;
  format: ExportFormat;
  /** Preset, or an explicit video bitrate in bits/second. Default "standard". */
  quality?: ExportQualityPreset | { videoBitrate: number };
  /** Keyframe interval in seconds (default 2 — mediabunny's default). */
  keyFrameIntervalSeconds?: number;
}

/**
 * Probe-then-build: rejects up front with a clear error when this browser
 * cannot encode the chosen format (e.g. H.264 encode missing), instead of
 * failing frames deep into an export.
 */
export async function createMediabunnySink(
  options: CreateMediabunnySinkOptions,
): Promise<ExportSink> {
  const codecs = CODECS[options.format];
  if (!(await canEncodeVideo(codecs.video))) {
    throw new UnsupportedMediaError(
      "export",
      `this browser cannot encode ${codecs.video} — try ${options.format === "mp4" ? '"webm"' : '"mp4"'}`,
      codecs.video,
    );
  }

  const quality = options.quality ?? "standard";
  const videoQuality: { quality: Quality } | { bitrate: number } =
    typeof quality === "string"
      ? { quality: QUALITIES[quality] }
      : { bitrate: quality.videoBitrate };

  const target = new BufferTarget();
  const output = new Output({
    format: options.format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target,
  });
  const video = new CanvasSource(options.canvas, {
    codec: codecs.video,
    ...videoQuality,
    keyFrameInterval: options.keyFrameIntervalSeconds ?? 2,
  });
  output.addVideoTrack(video);

  let audio: AudioBufferSource | undefined;
  let pendingAudio: AudioBuffer | undefined;
  let started = false;
  let done = false;

  const start = async (): Promise<void> => {
    if (started) return;
    started = true;
    await output.start();
    if (audio && pendingAudio) {
      await audio.add(pendingAudio);
      audio.close(); // the mix is one buffer — the audio track is complete
      pendingAudio = undefined;
    }
  };

  return {
    async addAudio(buffer: unknown): Promise<void> {
      if (started) throw new Error("addAudio must be called before the first video frame");
      if (!(await canEncodeAudio(codecs.audio))) {
        throw new UnsupportedMediaError(
          "export",
          `this browser cannot encode ${codecs.audio} audio`,
          codecs.audio,
        );
      }
      audio = new AudioBufferSource({ codec: codecs.audio, quality: QUALITY_MEDIUM });
      output.addAudioTrack(audio);
      pendingAudio = buffer as AudioBuffer;
    },

    async addVideoFrame(timestampUs: Us, durationUs: Us): Promise<void> {
      await start(); // tracks are frozen from here on
      // The returned promise is the encoder/muxer backpressure.
      await video.add(timestampUs / 1_000_000, durationUs / 1_000_000);
    },

    async finalize(): Promise<Uint8Array> {
      await start(); // zero-frame exports still produce a valid (empty) file
      video.close();
      done = true;
      await output.finalize();
      if (!target.buffer) throw new Error("muxer produced no output");
      return new Uint8Array(target.buffer);
    },

    async cancel(): Promise<void> {
      if (done) return;
      done = true;
      await output.cancel().catch(() => undefined);
    },
  };
}
