/**
 * The production ExportSink: mediabunny `Output` + WebCodecs encoding.
 * MP4 (H.264 + AAC) and WebM (VP9 + Opus). Browser-only; everything above it
 * (the export orchestrator) is environment-agnostic and unit-tested in Node.
 */
import {
  AudioBufferSource,
  AudioSample,
  AudioSampleSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  StreamTarget,
  VideoSample,
  VideoSampleSource,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  type Quality,
  type StreamTargetChunk,
} from "mediabunny";
import { UnsupportedMediaError } from "../media/types.js";
import type { Us } from "../media/types.js";
import { isPcmAudioChunk, type ExportSink, type PcmAudioChunk } from "./types.js";

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
  /**
   * Route the per-frame capture through a 2D canvas (CPU-backed frames)
   * instead of snapshotting the WebGL canvas directly. Needed under SOFTWARE
   * WebGL (SwiftShader/llvmpipe — headless CI, some VMs), where Chromium's
   * GPU process retains one shared-image per captured frame while a decoder
   * and encoder run simultaneously — an environment quirk that turns long
   * exports into unbounded memory growth (found by the stress suite; every
   * frame IS closed correctly on our side). On real GPUs the direct snapshot
   * is cheaper and clean, so `exportProject` sets this automatically from the
   * detected renderer.
   */
  cpuCapture?: boolean;
  /**
   * Stream the encoded file out as it is produced instead of buffering it in
   * memory: each chunk is `{ type: "write", data, position }` (positions may
   * seek backwards — containers patch headers), the shape
   * `FileSystemWritableFileStream.write` accepts directly, so a
   * `showSaveFilePicker()` writable works as-is. Backpressure on the stream
   * throttles the encoders. With a target set, `finalize()` resolves with an
   * EMPTY array — the bytes went to the stream.
   */
  target?: WritableStream<StreamTargetChunk>;
}

/**
 * Whether this browser has a HARDWARE encoder for the format's video codec at
 * the given output size. Used to pick the capture route: with a hardware
 * encoder, zero-copy canvas capture drains fast and stays flat; with a
 * SOFTWARE encoder (VP9/WebM on macOS, for example) the GPU-backed captured
 * frames outlive the slow encode and Chrome's shared-image retention balloons
 * — the same failure class as the SwiftShader capture leak, reported from the
 * field as a machine-exhausting WebM High export on a real GPU. Probe errs
 * toward `false` (CPU capture), the safe side.
 */
export async function hasHardwareVideoEncoder(
  format: ExportFormat,
  width: number,
  height: number,
): Promise<boolean> {
  try {
    const codecString = CODECS[format].video === "avc" ? "avc1.640028" : "vp09.00.41.08";
    const support = await VideoEncoder.isConfigSupported({
      codec: codecString,
      width,
      height,
      hardwareAcceleration: "prefer-hardware",
    });
    return Boolean(support.supported);
  } catch {
    return false;
  }
}

/** True when the canvas's WebGL context reports a software rasterizer. */
export function isSoftwareWebGL(canvas: HTMLCanvasElement | OffscreenCanvas): boolean {
  try {
    // The compositor already created the context; getContext returns it.
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    return /swiftshader|llvmpipe|software/i.test(renderer);
  } catch {
    return false;
  }
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

  const bufferTarget = options.target ? undefined : new BufferTarget();
  const target = bufferTarget ?? new StreamTarget(options.target!, { chunked: true });
  const output = new Output({
    format: options.format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target,
  });
  const encodingConfig = {
    codec: codecs.video,
    ...videoQuality,
    keyFrameInterval: options.keyFrameIntervalSeconds ?? 2,
  };

  // Two capture routes into the same encoder/muxer machinery — see
  // `cpuCapture` above for why the 2D mirror exists.
  let addFrame: (timestampS: number, durationS: number) => Promise<void>;
  let closeVideo: () => void;
  if (options.cpuCapture) {
    const video = new VideoSampleSource(encodingConfig);
    output.addVideoTrack(video);
    const width = (options.canvas as { width: number }).width;
    const height = (options.canvas as { height: number }).height;
    const mirror = new OffscreenCanvas(width, height);
    const mirrorContext = mirror.getContext("2d", { willReadFrequently: true });
    if (!mirrorContext) throw new Error("export: could not create the 2D capture context");
    addFrame = async (timestampS, durationS) => {
      mirrorContext.drawImage(options.canvas as CanvasImageSource, 0, 0);
      const sample = new VideoSample(mirror, { timestamp: timestampS, duration: durationS });
      try {
        await video.add(sample); // encoder/muxer backpressure
      } finally {
        sample.close();
      }
    };
    closeVideo = () => video.close();
  } else {
    const video = new CanvasSource(options.canvas, encodingConfig);
    output.addVideoTrack(video);
    // The returned promise is the encoder/muxer backpressure.
    addFrame = (timestampS, durationS) => video.add(timestampS, durationS);
    closeVideo = () => video.close();
  }

  // Two audio routes into the same encoder/muxer: AudioBuffer chunks (the
  // main-thread mixer's native output) via AudioBufferSource, and raw PCM
  // chunks (the worker-export interchange — AudioBuffer is window-only) via
  // AudioSampleSource with running timestamps. The route is chosen by the
  // FIRST chunk's shape.
  let audio: AudioBufferSource | AudioSampleSource | undefined;
  let audioIsPcm = false;
  let pcmTimestampS = 0;
  const pendingAudio: unknown[] = [];
  let started = false;
  let done = false;

  const addAudioChunk = async (chunk: unknown): Promise<void> => {
    if (audioIsPcm) {
      const pcm = chunk as PcmAudioChunk;
      // f32-planar layout: each channel's plane contiguous, in channel order.
      const data = new Float32Array(pcm.numberOfFrames * pcm.numberOfChannels);
      for (let c = 0; c < pcm.numberOfChannels; c++) data.set(pcm.planes[c]!, c * pcm.numberOfFrames);
      const sample = new AudioSample({
        data,
        format: "f32-planar",
        numberOfChannels: pcm.numberOfChannels,
        sampleRate: pcm.sampleRate,
        timestamp: pcmTimestampS,
      });
      try {
        await (audio as AudioSampleSource).add(sample); // encoder/muxer backpressure
      } finally {
        sample.close();
      }
      // Sequential-chunk contract, same as the AudioBuffer route: each chunk
      // plays right after the previous one.
      pcmTimestampS += pcm.numberOfFrames / pcm.sampleRate;
    } else {
      // mediabunny accumulates AudioBuffer timestamps by buffer duration. The
      // awaited add is the encoder/muxer backpressure.
      await (audio as AudioBufferSource).add(chunk as AudioBuffer);
    }
  };

  const start = async (): Promise<void> => {
    if (started) return;
    started = true;
    await output.start();
    // Chunks queued before the container started; later chunks stream in
    // directly. The audio source stays open until finalize — chunked exports
    // keep adding sequential chunks through the whole frame walk.
    while (pendingAudio.length > 0) await addAudioChunk(pendingAudio.shift()!);
  };

  return {
    async addAudio(buffer: unknown): Promise<void> {
      if (!audio) {
        // First chunk registers the track — that must precede the first video
        // frame (tracks freeze when the container starts).
        if (started) throw new Error("the first addAudio must land before the first video frame");
        if (!(await canEncodeAudio(codecs.audio))) {
          throw new UnsupportedMediaError(
            "export",
            `this browser cannot encode ${codecs.audio} audio`,
            codecs.audio,
          );
        }
        audioIsPcm = isPcmAudioChunk(buffer);
        audio = audioIsPcm
          ? new AudioSampleSource({ codec: codecs.audio, quality: QUALITY_MEDIUM })
          : new AudioBufferSource({ codec: codecs.audio, quality: QUALITY_MEDIUM });
        output.addAudioTrack(audio);
      }
      if (started) await addAudioChunk(buffer);
      else pendingAudio.push(buffer);
    },

    async addVideoFrame(timestampUs: Us, durationUs: Us): Promise<void> {
      await start(); // tracks are frozen from here on
      await addFrame(timestampUs / 1_000_000, durationUs / 1_000_000);
    },

    async finalize(): Promise<Uint8Array> {
      await start(); // zero-frame exports still produce a valid (empty) file
      audio?.close();
      closeVideo();
      done = true;
      await output.finalize();
      if (!bufferTarget) return new Uint8Array(0); // bytes went to the stream
      if (!bufferTarget.buffer) throw new Error("muxer produced no output");
      return new Uint8Array(bufferTarget.buffer);
    },

    async cancel(): Promise<void> {
      if (done) return;
      done = true;
      await output.cancel().catch(() => undefined);
    },
  };
}
