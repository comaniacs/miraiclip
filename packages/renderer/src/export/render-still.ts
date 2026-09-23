import type { Project } from "@miraiclip/core";
import { Compositor } from "../compositor/compositor.js";
import type { NodeFactory } from "../compositor/types.js";
import { createPixiBackend } from "../compositor/pixi-backend.js";
import { MediaManager } from "../media/media-manager.js";
import type { DemuxerFactory, FrameDecoderFactory, Us } from "../media/types.js";
import { createWebCodecsDecoderFactory, openMediabunnyDemuxer } from "../media/webcodecs.js";
import { createVideoSupport } from "../video/video-support.js";
import { loadFontAssets } from "../captions/fonts.js";

export interface RenderProjectStillOptions {
  /** Composition time to render, in microseconds. */
  timeUs: Us;
  /** Output size (default: the project's composition size). */
  width?: number;
  height?: number;
  /** Image encoding (default PNG). */
  type?: "image/png" | "image/jpeg" | "image/webp";
  /** For lossy types: 0..1. */
  quality?: number;
  /** Media adapters — injectable, with browser defaults (same as export). */
  openDemuxer?: DemuxerFactory;
  createDecoder?: FrameDecoderFactory;
  /** Scene-node factories for custom clip kinds — pass the player's. */
  factories?: Record<string, NodeFactory>;
}

/**
 * Render ONE composition frame to an image, through the exact pipeline
 * exports use (same compositor, same decode path, same fonts) — so a still is
 * what that frame will look like in the exported file, by construction.
 * Thumbnails, poster frames, and agent previews all want this.
 */
export async function renderProjectStill(
  project: Project,
  options: RenderProjectStillOptions,
): Promise<Blob> {
  const doc = project.getState().doc;
  const width = options.width ?? doc.settings.width;
  const height = options.height ?? doc.settings.height;
  const canvas = new OffscreenCanvas(width, height);

  // Same decode cap as export: 2× the output's longest side.
  const decodeCapPx = 2 * Math.max(width, height);
  const manager = new MediaManager({
    openDemuxer: options.openDemuxer ?? openMediabunnyDemuxer,
    createDecoder:
      options.createDecoder ?? createWebCodecsDecoderFactory({ maxOutputDimensionPx: decodeCapPx }),
  });
  const videos = createVideoSupport(project, manager);
  const backend = await createPixiBackend({
    canvas: canvas as unknown as HTMLCanvasElement,
    width,
    height,
  });
  const compositor = new Compositor(project, backend, {
    factories: { ...options.factories, video: videos.factory },
    outputSize: { width, height },
  });

  try {
    // Fonts must be real before the frame renders — fallback glyphs are
    // silently wrong for an unattended still exactly as for a server export.
    await loadFontAssets(doc);
    await compositor.whenReady(); // image textures + html rasters
    await videos.renderFrameAt(compositor, options.timeUs);
    return await canvas.convertToBlob({
      type: options.type ?? "image/png",
      ...(options.quality !== undefined ? { quality: options.quality } : {}),
    });
  } finally {
    compositor.destroy(); // also destroys the backend
    videos.dispose();
  }
}
