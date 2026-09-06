import type { Clip, Project, VideoClip } from "@miraiclip/core";
import type { MediaManager } from "../media/media-manager.js";
import type { Us } from "../media/types.js";
import type { VideoPipeline } from "../media/video-pipeline.js";
import type {
  NodeFactory,
  Placement,
  SceneNode,
  VideoSceneNode,
} from "../compositor/types.js";
import type { Compositor } from "../compositor/compositor.js";

export interface VideoSupportOptions {
  /** Prepare clips that start within this window ahead of the playhead (default 1s). */
  lookaheadUs?: Us;
  /**
   * Called when a clip's media fails (unsupported codec, decode error, …).
   * Silent-by-default was a mistake we made once — the default logs loudly.
   */
  onError?: (error: Error, clipId: string) => void;
}

/** Timeline position → position on the clip's source media. */
export function toMediaUs(clip: VideoClip, timelineUs: Us): Us {
  return clip.trimStartUs + (timelineUs - clip.startUs);
}

class VideoClipAdapter implements SceneNode {
  pipeline: VideoPipeline | undefined;
  private pipelinePromise: Promise<VideoPipeline> | undefined;

  constructor(
    private readonly inner: VideoSceneNode,
    private readonly acquire: () => Promise<VideoPipeline>,
    private readonly onError: (error: Error) => void,
    private readonly onDestroy: () => void,
  ) {}

  ensurePipeline(): Promise<VideoPipeline> {
    this.pipelinePromise ??= this.acquire().then((pipeline) => {
      this.pipeline = pipeline;
      // Tell the scene node the source's NATIVE size: frames may arrive decoded
      // below native resolution (proxy playback), and the node compensates so
      // the clip renders at the same size regardless of decode resolution.
      pipeline
        .info()
        .then((info) => this.inner.setSourceSize?.(info.width, info.height))
        .catch(this.report);
      return pipeline;
    });
    return this.pipelinePromise;
  }

  private report = (error: unknown): void => {
    this.onError(error instanceof Error ? error : new Error(String(error)));
  };

  /** Await the exact frame at a media position (used by prepare/renderFrameAt). */
  async prepareAt(mediaUs: Us): Promise<void> {
    const pipeline = await this.ensurePipeline();
    await pipeline.prime(mediaUs);
    // prime() means "decode scheduled"; render-once consumers (export,
    // thumbnails) need the frame to have actually ARRIVED before drawing.
    await pipeline.waitForFrame(mediaUs);
  }

  tick(clip: Clip, timeUs: Us): void {
    if (clip.kind !== "video") return;
    const mediaUs = toMediaUs(clip, timeUs);
    if (!this.pipeline) {
      // Kick off acquisition only — a deferred prime here could land after a
      // later explicit prepare and supersede it with a stale target.
      this.ensurePipeline().catch(this.report);
      return;
    }
    // Show the nearest decoded frame; on a seek the cache was cleared, so this
    // holds the last frame until the new GOP's frames decode in (fast, so it
    // reads as an instant snap to the target).
    const frame = this.pipeline.frameAt(mediaUs);
    if (frame) this.inner.setFrame(frame.native);
    // Streaming prime: advances the decode target and continues the live decode.
    this.pipeline.prime(mediaUs).catch(this.report);
  }

  setPlacement(placement: Placement): void {
    this.inner.setPlacement(placement);
  }
  setVisible(visible: boolean): void {
    this.inner.setVisible(visible);
  }
  setZ(z: number): void {
    this.inner.setZ(z);
  }
  update(clip: Clip): void {
    this.inner.update(clip);
  }
  destroy(): void {
    this.onDestroy();
    this.inner.destroy();
  }
}

export interface VideoSupport {
  /** Register as the "video" factory on the Compositor. */
  factory: NodeFactory;
  /** Await decode for every clip visible at (or starting soon after) `timeUs`. */
  prepare(timeUs: Us): Promise<void>;
  /** Prepare then draw one exact frame — thumbnails, posters, export. */
  renderFrameAt(compositor: Compositor, timeUs: Us): Promise<void>;
  dispose(): void;
}

/**
 * Bridges the MediaManager into the Compositor: creates video scene nodes
 * that pull cached frames on every tick and keep decode-ahead primed.
 * Pipelines stay owned by the MediaManager (shared per asset).
 */
export function createVideoSupport(
  project: Project,
  manager: MediaManager,
  options: VideoSupportOptions = {},
): VideoSupport {
  const lookaheadUs = options.lookaheadUs ?? 1_000_000;
  const onError =
    options.onError ??
    ((error: Error, clipId: string) =>
      console.error(`[miraiclip] video clip "${clipId}" failed:`, error));
  const adapters = new Map<string, VideoClipAdapter>();

  const factory: NodeFactory = (clip, { backend, assets }) => {
    if (clip.kind !== "video") return null;
    const asset = assets[clip.assetId];
    if (!asset) return null;
    const inner = backend.createVideo(clip);
    const adapter = new VideoClipAdapter(
      inner,
      () => manager.acquire(asset.id, asset.src),
      (error) => onError(error, clip.id),
      () => adapters.delete(clip.id),
    );
    adapters.set(clip.id, adapter);
    void adapter.ensurePipeline();
    return adapter;
  };

  async function prepare(timeUs: Us): Promise<void> {
    const doc = project.getState().doc;
    const jobs: Promise<void>[] = [];
    for (const [clipId, adapter] of adapters) {
      const clip = doc.clips[clipId];
      if (!clip || clip.kind !== "video") continue;
      const endUs = clip.startUs + clip.durationUs;
      const relevant = timeUs < endUs && timeUs >= clip.startUs - lookaheadUs;
      if (!relevant) continue;
      const mediaUs = toMediaUs(clip, Math.max(timeUs, clip.startUs));
      jobs.push(adapter.prepareAt(mediaUs));
    }
    await Promise.all(jobs);
  }

  return {
    factory,
    prepare,
    async renderFrameAt(compositor, timeUs) {
      await prepare(timeUs);
      compositor.renderAt(timeUs);
    },
    dispose() {
      adapters.clear();
      manager.dispose();
    },
  };
}
