import { isVideoClip, type Clip, type EffectInstance, type Project, type VideoClip } from "@miraiclip/core";
import type { MediaManager } from "../media/media-manager.js";
import type { Us } from "../media/types.js";
import type { VideoPipeline } from "../media/video-pipeline.js";
import type {
  NodeFactory,
  Placement,
  RevealDirection,
  SceneNode,
  VideoSceneNode,
} from "../compositor/types.js";
import type { Compositor } from "../compositor/compositor.js";
import { participatesInTransition, renderExtension } from "../transitions/timing.js";

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
  private dedicated = false;

  constructor(
    private readonly inner: VideoSceneNode,
    private readonly acquire: (dedicated: boolean) => Promise<VideoPipeline>,
    private readonly touch: (dedicated: boolean) => void,
    private readonly onError: (error: Error) => void,
    private readonly onDestroy: () => void,
  ) {}

  /**
   * A clip that participates in a transition needs its OWN pipeline: during
   * the overlap window two clips of the same asset decode two positions at
   * once, and a shared pipeline would fight over the seek target. Upgrading
   * is one-way and idempotent; the shared pipeline stays owned by the
   * manager for other clips of the asset. Lazy on purpose: the dedicated
   * pipeline is acquired when the clip is next ticked/prepared, not here —
   * eager acquisition for every transition clip in a long document would
   * blow through the manager's pipeline cap at mount.
   */
  ensureDedicated(): void {
    if (this.dedicated) return;
    this.dedicated = true;
    this.resetPipeline();
  }

  /** Drop the cached pipeline so the next ensurePipeline() re-acquires. */
  private resetPipeline(): void {
    this.pipeline = undefined;
    this.pipelinePromise = undefined;
  }

  ensurePipeline(): Promise<VideoPipeline> {
    // The MediaManager evicts least-recently-used pipelines over its cap. An
    // evicted pipeline is disposed while we still hold it — detect that and
    // re-acquire instead of priming a dead pipeline forever (long timelines
    // with many assets went permanently black without this).
    if (this.pipeline?.isDisposed) this.resetPipeline();
    this.pipelinePromise ??= this.acquire(this.dedicated).then((pipeline) => {
      if (pipeline.isDisposed) {
        // Evicted while opening — don't cache a dead pipeline; the next
        // ensurePipeline() call re-acquires.
        this.resetPipeline();
        return pipeline;
      }
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
    this.touch(this.dedicated); // keep the manager's LRU order honest
    let pipeline = await this.ensurePipeline();
    // Evicted between (or during) acquisitions — one re-acquire attempt; if
    // the active set truly exceeds the cap this call yields no frame, and the
    // next prepare recovers.
    if (pipeline.isDisposed) pipeline = await this.ensurePipeline();
    await pipeline.prime(mediaUs);
    // prime() means "decode scheduled"; render-once consumers (export,
    // thumbnails) need the frame to have actually ARRIVED before drawing.
    await pipeline.waitForFrame(mediaUs);
  }

  tick(clip: Clip, timeUs: Us): void {
    if (!isVideoClip(clip)) return;
    const mediaUs = toMediaUs(clip, timeUs);
    this.touch(this.dedicated); // in use every frame → never the LRU victim
    if (this.pipeline?.isDisposed) this.resetPipeline(); // evicted → re-acquire
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
  setEffects(effects: readonly EffectInstance[]): void {
    this.inner.setEffects?.(effects);
  }
  setReveal(fraction: number, direction: RevealDirection): void {
    this.inner.setReveal?.(fraction, direction);
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
    if (!isVideoClip(clip)) return null;
    const asset = assets[clip.assetId];
    if (!asset) return null;
    const inner = backend.createVideo(clip);
    const clipId = clip.id;
    const adapter = new VideoClipAdapter(
      inner,
      (dedicated) => manager.acquire(asset.id, asset.src, dedicated ? clipId : undefined),
      (dedicated) => manager.touch(asset.id, dedicated ? clipId : undefined),
      (error) => onError(error, clipId),
      () => adapters.delete(clipId),
    );
    adapters.set(clipId, adapter);
    if (participatesInTransition(project.getState().doc, clipId)) adapter.ensureDedicated();
    // No eager acquisition here: a long document mounts every clip's node at
    // once, and acquiring a pipeline per clip up front evicts the ones that
    // are actually visible. The first tick/prepare acquires just-in-time.
    return adapter;
  };

  interface RelevantClip {
    adapter: VideoClipAdapter;
    assetId: string;
    mediaUs: Us;
    fromUs: Us;
    toUs: Us;
  }

  async function prepare(timeUs: Us): Promise<void> {
    const doc = project.getState().doc;
    const relevant: RelevantClip[] = [];
    for (const [clipId, adapter] of adapters) {
      const clip = doc.clips[clipId];
      if (!clip || !isVideoClip(clip)) continue;
      // Transitions render a clip beyond its bounds (from source headroom) —
      // keep it decoded through the extension, and upgrade to a dedicated
      // pipeline the moment a transition is attached to a live clip.
      const extension = renderExtension(doc, clip);
      if (participatesInTransition(doc, clipId)) adapter.ensureDedicated();
      const visibleFromUs = clip.startUs - extension.beforeUs;
      const visibleToUs = clip.startUs + clip.durationUs + extension.afterUs;
      if (!(timeUs < visibleToUs && timeUs >= visibleFromUs - lookaheadUs)) continue;
      const mediaUs = toMediaUs(clip, Math.min(Math.max(timeUs, visibleFromUs), visibleToUs));
      relevant.push({ adapter, assetId: clip.assetId, mediaUs, fromUs: visibleFromUs, toUs: visibleToUs });
    }
    // CONCURRENT clips of one asset (picture-in-picture of the same footage,
    // echo overlays) each need their own pipeline, exactly as transition
    // overlaps do: two clips demanding two media positions from one shared
    // pipeline fight over its seek target every frame — the cache is cleared
    // on every reversal and playback wedges. Sequential clips of one asset
    // (splits, cuts) keep sharing: pipeline continuity is what makes those
    // cheap. Dedication happens BEFORE the prepare jobs run, and prepare fires
    // at least once per 300ms of playback with a 1s lookahead, so the upgrade
    // lands before the overlap is visible.
    for (let i = 0; i < relevant.length; i++) {
      for (let j = i + 1; j < relevant.length; j++) {
        const a = relevant[i]!;
        const b = relevant[j]!;
        if (a.assetId !== b.assetId) continue;
        if (a.fromUs < b.toUs && b.fromUs < a.toUs) {
          a.adapter.ensureDedicated();
          b.adapter.ensureDedicated();
        }
      }
    }
    await Promise.all(relevant.map((entry) => entry.adapter.prepareAt(entry.mediaUs)));
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
