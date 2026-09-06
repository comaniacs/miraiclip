import type { Project } from "@miraiclip/core";
import { Compositor } from "../compositor/compositor.js";
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
import { exportComposition } from "./exporter.js";
import {
  createMediabunnySink,
  type CreateMediabunnySinkOptions,
  type ExportFormat,
  type ExportQualityPreset,
} from "./mediabunny-sink.js";
import { mixCompositionAudio } from "./offline-audio.js";
import type { ExportProgress, ExportRange } from "./types.js";

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
  let compositionEndUs: Us = 0;
  for (const clip of Object.values(doc.clips)) {
    compositionEndUs = Math.max(compositionEndUs, clip.startUs + clip.durationUs);
  }
  const range = options.range ?? { startUs: 0, endUs: compositionEndUs };
  if (!(range.endUs > range.startUs)) throw new Error("nothing to export: the composition is empty");

  const width = options.width ?? doc.settings.width;
  const height = options.height ?? doc.settings.height;
  const fps = options.fps ?? doc.settings.fps;
  const canvas = new OffscreenCanvas(width, height);

  const sinkOptions: CreateMediabunnySinkOptions = {
    canvas,
    format: options.format,
    ...(options.quality !== undefined ? { quality: options.quality } : {}),
  };
  const sink = await createMediabunnySink(sinkOptions); // probes codec support up front

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
  const backend = await createPixiBackend({ canvas: canvas as unknown as HTMLCanvasElement, width, height });
  const compositor = new Compositor(project, backend, {
    factories: { video: videos.factory },
  });
  const openAudio = options.openAudio ?? openMediabunnyAudio;

  try {
    return await exportComposition({
      startUs: range.startUs,
      endUs: range.endUs,
      fps,
      renderFrame: (timeUs) => videos.renderFrameAt(compositor, timeUs),
      sink,
      mixAudio: (mixContext) =>
        mixCompositionAudio({ doc, range, openAudio, ...mixContext }),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    });
  } finally {
    compositor.destroy(); // also destroys the backend
    videos.dispose();
  }
}
