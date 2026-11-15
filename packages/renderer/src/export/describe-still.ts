import { createProject, type Project } from "@miraiclip/core";
import { loadFontAssets } from "../captions/fonts.js";
import { Compositor } from "../compositor/compositor.js";
import { createPixiBackend } from "../compositor/pixi-backend.js";
import type { ClipBounds, NodeFactory, TextLayout } from "../compositor/types.js";
import { MediaManager } from "../media/media-manager.js";
import type { DemuxerFactory, FrameDecoderFactory, Us } from "../media/types.js";
import { createWebCodecsDecoderFactory, openMediabunnyDemuxer } from "../media/webcodecs.js";
import { createVideoSupport } from "../video/video-support.js";

/**
 * A copy of the project without some clips: for a still drawn without its text (a vector
 * PDF lays the text over it as real text), or any other layer that is drawn elsewhere.
 */
export function withoutClips(project: Project, clipIds: readonly string[]): Project {
  const doc = structuredClone(project.getState().doc);
  for (const id of clipIds) delete doc.clips[id];
  return createProject(doc);
}

/** Why a text can't be drawn as plain text over the still (it stays in the picture then). */
export type StillTextReason = "covered" | "effects" | "shadow" | "typing" | "transition";

/** A text clip as drawn at one moment: its lines, its look, and where it goes. */
export interface StillText extends TextLayout {
  clipId: string;
  /** Local → output pixels: `[a, b, c, d, e, f]` as in CSS `matrix()` / SVG `transform`. */
  matrix: [number, number, number, number, number, number];
  /** The clip's opacity at that moment (0..1). */
  opacity: number;
  /** Its drawn box in output pixels (rotation applied). */
  bounds: ClipBounds;
  /** Empty when it can be drawn as real text; else why it should stay in the picture. */
  rasterReasons: StillTextReason[];
}

/** Why a clip must stay in the picture rather than be drawn on its own (vector PDF). */
export type StillClipReason = "covered" | "effects" | "transition";

/**
 * Any visible clip as placed at one moment: enough for a caller to draw it itself (a shape as
 * SVG) and to know what is drawn over it. `covered` is set when any clip above overlaps its
 * box; a caller that draws some covering clips itself can decide with `bounds` and `z`.
 */
export interface StillClip {
  clipId: string;
  kind: string;
  /** Stacking order (higher draws on top). */
  z: number;
  /** Local → output pixels, as for text: the clip's own content is centred on its origin. */
  matrix: [number, number, number, number, number, number];
  opacity: number;
  /** Its drawn box in composition pixels (rotation applied). */
  bounds: ClipBounds;
  rasterReasons: StillClipReason[];
}

/** What `describeStillText` returns. */
export interface StillDescription {
  width: number;
  height: number;
  /** Text clips with their line layout, bottom to top. */
  texts: StillText[];
  /** Every visible clip (text included), bottom to top. */
  clips: StillClip[];
}

export interface DescribeStillOptions {
  timeUs: Us;
  /** Output size (default: the composition size); positions are scaled to it. */
  width?: number;
  height?: number;
  openDemuxer?: DemuxerFactory;
  createDecoder?: FrameDecoderFactory;
  factories?: Record<string, NodeFactory>;
}

const overlaps = (a: ClipBounds, b: ClipBounds) => {
  const box = (c: ClipBounds) => {
    const xs = c.corners.map((p) => p.xPx);
    const ys = c.corners.map((p) => p.yPx);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
  };
  const [ax0, ay0, ax1, ay1] = box(a);
  const [bx0, by0, bx1, by1] = box(b);
  return ax0 < bx1 && bx0 < ax1 && ay0 < by1 && by0 < ay1;
};

/**
 * Every visible text clip at `timeUs`, laid out by the same compositor and text metrics the
 * canvas uses, so a page can be drawn without its text (`withoutClips`) and the text put back
 * on top as real, selectable text (vector PDF). A text another clip is drawn over (by its box),
 * or that has effects, a shadow, a blur, a transition or is still typing, says why it should
 * stay in the picture instead. Runs in a browser (it measures text with the canvas).
 */
export async function describeStillText(
  project: Project,
  options: DescribeStillOptions,
): Promise<StillDescription> {
  const doc = project.getState().doc;
  const width = options.width ?? doc.settings.width;
  const height = options.height ?? doc.settings.height;
  const sx = width / doc.settings.width;
  const sy = height / doc.settings.height;
  await loadFontAssets(doc);
  const manager = new MediaManager({
    openDemuxer: options.openDemuxer ?? openMediabunnyDemuxer,
    createDecoder: options.createDecoder ?? createWebCodecsDecoderFactory({}),
  });
  const videos = createVideoSupport(project, manager);
  const canvas = new OffscreenCanvas(doc.settings.width, doc.settings.height);
  const backend = await createPixiBackend({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: doc.settings.width,
    height: doc.settings.height,
  });
  const compositor = new Compositor(project, backend, {
    factories: { ...options.factories, video: videos.factory },
  });
  try {
    await compositor.whenReady();
    compositor.renderAt(options.timeUs);
    const t = options.timeUs;
    const visible = compositor
      .residentClipIds()
      .map((id) => ({ id, bounds: compositor.getClipBounds(id, t) }))
      .filter((x): x is { id: string; bounds: ClipBounds } => x.bounds !== null);
    // Clips inside a transition's window at this moment (centered on the cut).
    const transitioning = new Set<string>();
    for (const tr of Object.values(doc.transitions ?? {})) {
      const from = doc.clips[tr.fromClipId];
      if (!from) continue;
      const cut = from.startUs + from.durationUs;
      if (Math.abs(t - cut) < tr.durationUs / 2) {
        transitioning.add(tr.fromClipId);
        transitioning.add(tr.toClipId);
      }
    }
    const matrixOf = (bounds: ClipBounds): StillClip["matrix"] => {
      const rad = (bounds.rotationDeg * Math.PI) / 180;
      const kx = bounds.scale * (bounds.scaleX ?? 1);
      const ky = bounds.scale * (bounds.scaleY ?? 1);
      return [
        Math.cos(rad) * kx * sx,
        Math.sin(rad) * kx * sy,
        -Math.sin(rad) * ky * sx,
        Math.cos(rad) * ky * sy,
        bounds.originXPx * sx,
        bounds.originYPx * sy,
      ];
    };
    const texts: StillText[] = [];
    const clips: StillClip[] = [];
    for (const { id, bounds } of visible) {
      const clip = doc.clips[id];
      if (!clip) continue;
      const opacity = clip.transform.opacity ?? 1;
      if (opacity <= 0 || bounds.scale === 0) continue;
      const covered = visible.some((o) => o.id !== id && o.bounds.z > bounds.z && overlaps(o.bounds, bounds));
      const effects = (clip.effects ?? []).some((e) => e.enabled !== false);
      const clipReasons: StillClipReason[] = [];
      if (covered) clipReasons.push("covered");
      if (effects) clipReasons.push("effects");
      if (transitioning.has(id)) clipReasons.push("transition");
      const matrix = matrixOf(bounds);
      clips.push({ clipId: id, kind: clip.kind, z: bounds.z, matrix, opacity, bounds, rasterReasons: clipReasons });
      const layout = compositor.getTextLayout(id);
      if (!layout) continue;
      const reasons: StillTextReason[] = [];
      if (covered) reasons.push("covered");
      if (effects) reasons.push("effects");
      if (layout.shadow) reasons.push("shadow");
      if (layout.reveal < 1) reasons.push("typing");
      if (transitioning.has(id)) reasons.push("transition");
      texts.push({ ...layout, clipId: id, matrix, opacity, bounds, rasterReasons: reasons });
    }
    clips.sort((a, b) => a.z - b.z);
    texts.sort((a, b) => a.bounds.z - b.bounds.z);
    return { width, height, texts, clips };
  } finally {
    compositor.destroy();
    videos.dispose();
  }
}
