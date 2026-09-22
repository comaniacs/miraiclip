import type { Project, ProjectDocument } from "@miraiclip/core";
import { Compositor } from "../compositor/compositor.js";
import type { NodeFactory } from "../compositor/types.js";
import { createPixiBackend } from "../compositor/pixi-backend.js";
import { MediaManager } from "../media/media-manager.js";
import type { DemuxerFactory, FrameDecoderFactory, Us } from "../media/types.js";
import {
  createWebCodecsDecoderFactory,
  openMediabunnyDemuxer,
} from "../media/webcodecs.js";
import { openMediabunnyAudio } from "../audio/webaudio.js";
import type { AudioSourceFactory } from "../audio/types.js";
import { createVideoSupport } from "../video/video-support.js";
import { loadFontAssets } from "../captions/fonts.js";
import { exportComposition } from "./exporter.js";
import {
  createMediabunnySink,
  hasHardwareVideoEncoder,
  isSoftwareWebGL,
  type CreateMediabunnySinkOptions,
  type ExportFormat,
  type ExportQualityPreset,
} from "./mediabunny-sink.js";
import { mixCompositionAudio, planAudioJobs } from "./offline-audio.js";
import type { ExportProgress, ExportRange, MixAudioContext } from "./types.js";
import type { StreamTargetChunk } from "mediabunny";

export interface ExportProjectOptions {
  format: ExportFormat;
  quality?: ExportQualityPreset | { videoBitrate: number };
  /** Output frame rate (default: the project's fps). */
  fps?: number;
  /** Output size (default: the project's composition size). */
  width?: number;
  height?: number;
  /** Composition range (default: 0 → end of the last clip). */
  range?: ExportRange;
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
  /** Media adapters — injectable, with browser defaults. */
  openDemuxer?: DemuxerFactory;
  createDecoder?: FrameDecoderFactory;
  openAudio?: AudioSourceFactory;
  /**
   * Scene-node factories for custom clip kinds — pass the SAME factories the
   * player uses so custom kinds render identically in preview and export.
   * (Functions can't cross a process boundary: server-side export via
   * `@miraiclip/server-export` supports built-in kinds only for now.)
   */
  factories?: Record<string, NodeFactory>;
  /**
   * Stream the encoded file out as it is produced, instead of holding it in
   * memory and resolving with the bytes. Each chunk is
   * `{ type: "write", data, position }` — exactly what
   * `FileSystemWritableFileStream.write` accepts, so a
   * `showSaveFilePicker()` writable works directly (positions may seek
   * backwards; containers patch their headers). Backpressure on the stream
   * throttles the encoders. With a target set, the returned promise resolves
   * with an EMPTY Uint8Array once the stream has everything — required for
   * long exports, whose output does not fit in memory.
   */
  target?: WritableStream<StreamTargetChunk>;
  /**
   * Audio mix chunk length in seconds (default 60). Audio is mixed in bounded
   * sequential chunks (~23MB of PCM per minute at 48kHz stereo) instead of one
   * whole-timeline buffer, so timeline length does not grow mix memory. Use
   * integer seconds — boundaries stay sample-exact at 48kHz.
   */
  audioChunkSeconds?: number;
  /**
   * Advanced — replace the built-in audio pipeline entirely (worker hosts:
   * `OfflineAudioContext` and `AudioBuffer` are window-only, so a worker
   * export gets its audio mixed OUTSIDE the worker and fed in as chunks).
   * `hasAudio` replaces the asset probe; when true, `mixChunk` must return a
   * chunk (an `AudioBuffer` or a `PcmAudioChunk`) for EVERY requested range —
   * silent stretches as real silence, never null.
   */
  audioOverride?: {
    hasAudio: boolean;
    mixChunk?: (context: MixAudioContext, chunkRange: ExportRange) => Promise<unknown | null>;
  };
}

/** End of the last clip — the default export range's end. */
export function compositionEnd(doc: ProjectDocument): Us {
  let endUs: Us = 0;
  for (const clip of Object.values(doc.clips)) {
    endUs = Math.max(endUs, clip.startUs + clip.durationUs);
  }
  return endUs;
}

/**
 * Whether the composition contributes ANY audio over `range` — decided by
 * probing each distinct contributing asset until one actually opens an audio
 * track (planning alone counts every video clip as audible even when its
 * asset carries no audio stream). Shared by `exportProject` and the worker
 * export driver, which must decide this on the MAIN thread.
 */
export async function probeCompositionAudio(
  doc: ProjectDocument,
  range: ExportRange,
  openAudio: AudioSourceFactory,
): Promise<boolean> {
  const seen = new Set<string>();
  for (const job of planAudioJobs(doc, range)) {
    if (seen.has(job.assetId)) continue;
    seen.add(job.assetId);
    const source = await openAudio(job.assetId, job.src).catch(() => null);
    if (source) {
      source.dispose();
      return true;
    }
  }
  return false;
}

/**
 * Offline export: renders the composition frame-by-frame into an
 * OffscreenCanvas via the same compositor preview uses, and encodes as fast
 * as decode+encode allow. Decode is capped at 2× the output's longest side
 * (visually lossless for compositing; pass `createDecoder:
 * createWebCodecsDecoder` for uncapped). Time moves strictly forward, so the
 * streaming decoders never re-seek.
 */
export async function exportProject(
  project: Project,
  options: ExportProjectOptions,
): Promise<Uint8Array> {
  const doc = project.getState().doc;
  const range = options.range ?? { startUs: 0, endUs: compositionEnd(doc) };
  if (!(range.endUs > range.startUs)) throw new Error("nothing to export: the composition is empty");

  const width = options.width ?? doc.settings.width;
  const height = options.height ?? doc.settings.height;
  const fps = options.fps ?? doc.settings.fps;
  const canvas = new OffscreenCanvas(width, height);

  // Decode capped at 2× the output's longest side: compositing a 4K source
  // onto a 720p output at full decode resolution costs ~9× the pixels for no
  // visible gain (the one downscale happens on the GPU either way), and it is
  // what made 4K exports crawl. The 2× headroom keeps transform zooms up to
  // 2× visually lossless; pass `createDecoder: createWebCodecsDecoder` for
  // uncapped, pixel-exact decoding.
  const decodeCapPx = 2 * Math.max(width, height);
  const manager = new MediaManager({
    openDemuxer: options.openDemuxer ?? openMediabunnyDemuxer,
    createDecoder:
      options.createDecoder ??
      createWebCodecsDecoderFactory({ maxOutputDimensionPx: decodeCapPx }),
  });
  const videos = createVideoSupport(project, manager);
  // The backend must exist BEFORE the sink: software-WebGL detection reads the
  // GL context Pixi creates on the canvas.
  const backend = await createPixiBackend({ canvas: canvas as unknown as HTMLCanvasElement, width, height });
  const compositor = new Compositor(project, backend, {
    factories: { ...options.factories, video: videos.factory },
    // The output-size option: without this the compositor resizes the canvas
    // back to the composition size and a width/height override is silently
    // ignored (shipped bug through 0.4.x).
    outputSize: { width, height },
  });

  let sink;
  try {
    const sinkOptions: CreateMediabunnySinkOptions = {
      canvas,
      format: options.format,
      // CPU-mirror capture whenever zero-copy capture can outpace encoding:
      // under software WebGL (headless CI, VMs), direct canvas capture leaks
      // GPU shared-images while decode+encode run together — and the same
      // retention shows on REAL GPUs when the video ENCODER is software
      // (e.g. VP9/WebM on macOS): captured GPU frames pile up behind the slow
      // encode (field report: a WebM High export exhausted a 36GB machine).
      // Zero-copy capture stays only where a hardware encoder drains it.
      cpuCapture:
        isSoftwareWebGL(canvas) || !(await hasHardwareVideoEncoder(options.format, width, height)),
      ...(options.quality !== undefined ? { quality: options.quality } : {}),
      ...(options.target ? { target: options.target } : {}),
    };
    sink = await createMediabunnySink(sinkOptions); // probes codec support up front
  } catch (error) {
    compositor.destroy(); // also destroys the backend
    videos.dispose();
    throw error;
  }
  const openAudio = options.openAudio ?? openMediabunnyAudio;

  // Font assets must be REAL before the first frame renders — a server export
  // that rasterizes fallback glyphs is silently wrong (no one is watching).
  await loadFontAssets(doc);

  // Whether the composition has an audio track is decided ONCE, over the full
  // range: the track must register before the first video frame, and with
  // chunked mixing a silent first minute must not be mistaken for an
  // audio-less timeline. Planning alone is not enough — every video clip
  // plans as audible even when its asset carries no audio stream, and forcing
  // a silent track onto such an export would change its output — so probe
  // each distinct contributing asset until one actually opens audio.
  const hasAudio = options.audioOverride
    ? options.audioOverride.hasAudio
    : await probeCompositionAudio(doc, range, openAudio);
  const mixChunk =
    options.audioOverride?.mixChunk ??
    ((mixContext: MixAudioContext, chunkRange: ExportRange) =>
      mixCompositionAudio({ doc, range: chunkRange, openAudio, silenceIfEmpty: true, ...mixContext }));

  try {
    return await exportComposition({
      startUs: range.startUs,
      endUs: range.endUs,
      fps,
      renderFrame: (timeUs) => videos.renderFrameAt(compositor, timeUs),
      sink,
      // Audio mixes in bounded sequential chunks interleaved with the frame
      // walk — silent stretches return real silent buffers so chunk
      // timestamps stay aligned.
      ...(hasAudio ? { mixAudioChunk: mixChunk } : {}),
      audioChunkUs: Math.round((options.audioChunkSeconds ?? 60) * 1_000_000),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    });
  } finally {
    compositor.destroy(); // also destroys the backend
    videos.dispose();
  }
}
