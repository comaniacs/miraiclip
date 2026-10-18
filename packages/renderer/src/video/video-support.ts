import { isVideoClip, toSourceUs, type Clip, type EffectInstance, type Project, type ProjectDocument, type VideoClip } from "@miraiclip/core";
import type { MediaManager } from "../media/media-manager.js";
import type { Us } from "../media/types.js";
import type { VideoPipeline } from "../media/video-pipeline.js";
import type {
  LocalBounds,
  NodeFactory,
  Placement,
  RevealDirection,
  SceneNode,
  VideoSceneNode,
} from "../compositor/types.js";
import type { Compositor } from "../compositor/compositor.js";
import { renderExtension } from "../transitions/timing.js";

export interface VideoSupportOptions {
  /** Prepare clips that start within this window ahead of the playhead (default 1s). */
  lookaheadUs?: Us;
  /**
   * Called when a clip's media fails (unsupported codec, decode error, …).
   * Silent-by-default was a mistake we made once — the default logs loudly.
   */
  onError?: (error: Error, clipId: string) => void;
  /**
   * Clips of one asset whose render spans come closer than this share a lane
   * only if they don't — closer clips get separate decoder lanes, so the next
   * clip can warm up while the current one plays (default: the lookahead).
   */
  laneGapUs?: Us;
}

/**
 * Decoder lanes per asset — interval colouring over each clip's render span
 * (its bounds plus any transition extension), padded by `gapUs`. Clips that
 * never come within `gapUs` of each other share lane 0 (the asset's shared
 * pipeline, where sequential cuts keep decoder continuity); overlapping or
 * adjacent ones get the lowest free lane. The number of decoders an asset
 * ever needs is therefore its peak overlap — a montage of 12 back-to-back
 * transitioned cuts needs 2–3 lanes, not 12 (which is what one dedicated
 * pipeline per transition clip cost, and what exhausted mobile memory).
 */
export function assignVideoLanes(
  doc: ProjectDocument,
  gapUs: Us,
): Map<string, number> {
  const byAsset = new Map<string, { id: string; fromUs: Us; toUs: Us }[]>();
  for (const clip of Object.values(doc.clips)) {
    if (!isVideoClip(clip)) continue;
    const ext = renderExtension(doc, clip);
    const span = {
      id: clip.id,
      fromUs: clip.startUs - ext.beforeUs,
      toUs: clip.startUs + clip.durationUs + ext.afterUs,
    };
    let list = byAsset.get(clip.assetId);
    if (!list) byAsset.set(clip.assetId, (list = []));
    list.push(span);
  }
  const lanes = new Map<string, number>();
  for (const spans of byAsset.values()) {
    spans.sort((a, b) => a.fromUs - b.fromUs || (a.id < b.id ? -1 : 1));
    const laneEnds: Us[] = []; // per lane: end of its last span (+ gap)
    for (const span of spans) {
      let lane = laneEnds.findIndex((endUs) => endUs <= span.fromUs);
      if (lane === -1) lane = laneEnds.push(0) - 1;
      laneEnds[lane] = span.toUs + gapUs;
      lanes.set(span.id, lane);
    }
  }
  return lanes;
}

/** Timeline position → position on the clip's source media. */
export function toMediaUs(clip: VideoClip, timelineUs: Us): Us {
  // Speed-aware (a freeze frame always returns its held frame).
  return toSourceUs(clip, timelineUs);
}

class VideoClipAdapter implements SceneNode {
  pipeline: VideoPipeline | undefined;
  private pipelinePromise: Promise<VideoPipeline> | undefined;
  /** Decoder lane for this clip's asset (0 = the asset's shared pipeline). */
  private lane = 0;
  /** The lane this adapter currently holds a pipeline on, if any. */
  private heldLane: number | undefined;

  /** Whether this clip decodes on its own lane rather than the asset's shared pipeline. */
  get isDedicated(): boolean {
    return this.lane > 0;
  }

  get laneIndex(): number {
    return this.lane;
  }

  constructor(
    private readonly inner: VideoSceneNode,
    private readonly acquire: (lane: number) => Promise<VideoPipeline>,
    private readonly touch: (lane: number) => void,
    private readonly unhold: (lane: number) => void,
    private readonly onError: (error: Error) => void,
    private readonly onDestroy: () => void,
  ) {}

  /**
   * Move to another decoder lane (lanes are recomputed when the timeline
   * changes). The old lane's pipeline is released; the next tick/prepare
   * acquires on the new one — lazily, so a long document never acquires
   * pipelines for clips far from the playhead.
   */
  setLane(lane: number): void {
    if (lane === this.lane) return;
    this.release();
    this.lane = lane;
  }

  /** Kept for API compatibility: a dedicated clip is any clip on lane ≥ 1. */
  ensureDedicated(): void {
    if (this.lane === 0) this.setLane(1);
  }

  /**
   * Stop holding the pipeline (the clip left the playhead's neighbourhood).
   * The MediaManager disposes it once no clip has held it for a moment.
   */
  release(): void {
    if (this.heldLane !== undefined) this.unhold(this.heldLane);
    this.heldLane = undefined;
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
    if (!this.pipelinePromise) {
      const lane = this.lane;
      this.heldLane = lane;
      this.pipelinePromise = this.acquire(lane).then((pipeline) => {
        if (pipeline.isDisposed || lane !== this.lane) {
          // Evicted while opening, or moved lanes meanwhile — don't cache it;
          // the next ensurePipeline() call re-acquires.
          if (lane === this.lane) this.resetPipeline();
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
    }
    return this.pipelinePromise;
  }

  private report = (error: unknown): void => {
    this.onError(error instanceof Error ? error : new Error(String(error)));
  };

  /** Await the exact frame at a media position (used by prepare/renderFrameAt). */
  async prepareAt(mediaUs: Us): Promise<void> {
    this.touch(this.lane); // keep the manager's LRU order honest
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
    this.touch(this.lane); // in use every frame → never the LRU victim
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
  // Forwarded so video clips take part in selection and hit testing (getLocalBounds)
  // and their animated effect regions follow the clock (setEffectTime).
  setEffectTime(localUs: number, clipDurationUs: number): void {
    this.inner.setEffectTime?.(localUs, clipDurationUs);
  }
  getLocalBounds(): LocalBounds | null {
    return this.inner.getLocalBounds?.() ?? null;
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
    this.release();
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
  /** Release pipelines no clip near the playhead needs (see MediaManager.sweep). */
  sweep(): void;
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
  const laneGapUs = options.laneGapUs ?? lookaheadUs;
  // Lanes depend only on the document; documents are immutable snapshots, so
  // one colouring per document object.
  let lanesFor: { doc: ProjectDocument; lanes: Map<string, number> } | undefined;
  const lanes = (doc: ProjectDocument): Map<string, number> => {
    if (lanesFor?.doc !== doc) lanesFor = { doc, lanes: assignVideoLanes(doc, laneGapUs) };
    return lanesFor.lanes;
  };
  const laneKey = (lane: number): string | undefined => (lane === 0 ? undefined : `lane${lane}`);

  const factory: NodeFactory = (clip, { backend, assets }) => {
    if (!isVideoClip(clip)) return null;
    const asset = assets[clip.assetId];
    if (!asset) return null;
    const inner = backend.createVideo(clip);
    const clipId = clip.id;
    const adapter = new VideoClipAdapter(
      inner,
      (lane) => manager.acquire(asset.id, asset.src, laneKey(lane), clipId),
      (lane) => manager.touch(asset.id, laneKey(lane)),
      (lane) => manager.unhold(asset.id, laneKey(lane), clipId),
      (error) => onError(error, clipId),
      () => adapters.delete(clipId),
    );
    adapters.set(clipId, adapter);
    adapter.setLane(lanes(project.getState().doc).get(clipId) ?? 0);
    // No eager acquisition here: the first tick/prepare acquires just-in-time,
    // and only for clips near the playhead.
    return adapter;
  };

  interface RelevantClip {
    adapter: VideoClipAdapter;
    /** Asset + lane: clips with the same key read the same pipeline. */
    key: string;
    mediaUs: Us;
    /** Not on screen yet — only warmed because it starts within the lookahead. */
    upcoming: boolean;
  }

  async function prepare(timeUs: Us): Promise<void> {
    const doc = project.getState().doc;
    const laneOf = lanes(doc);
    const relevant: RelevantClip[] = [];
    for (const [clipId, adapter] of adapters) {
      const clip = doc.clips[clipId];
      if (!clip || !isVideoClip(clip)) continue;
      adapter.setLane(laneOf.get(clipId) ?? 0);
      // Transitions render a clip beyond its bounds (from source headroom) —
      // keep it decoded through the extension.
      const extension = renderExtension(doc, clip);
      const visibleFromUs = clip.startUs - extension.beforeUs;
      const visibleToUs = clip.startUs + clip.durationUs + extension.afterUs;
      if (!(timeUs < visibleToUs && timeUs >= visibleFromUs - lookaheadUs)) {
        // Neither on screen nor about to be: give the pipeline back. (Kept for
        // a short grace by the manager, so a scrub back across the cut is cheap.)
        adapter.release();
        continue;
      }
      const mediaUs = toMediaUs(clip, Math.min(Math.max(timeUs, visibleFromUs), visibleToUs));
      relevant.push({
        adapter,
        key: `${clip.assetId}\u0000${adapter.laneIndex}`,
        mediaUs,
        upcoming: timeUs < visibleFromUs,
      });
    }
    // Lanes already separate clips that overlap or come within the lane gap,
    // so an upcoming clip normally warms its OWN pipeline. When it shares a
    // lane with the clip on screen (a cut closer than the gap would have
    // needed a further lane), warming would steal that pipeline: priming the
    // upcoming media position reverses its seek target every frame — the
    // cache clears, waitForFrame times out re-seeking, exports crawl. Skip
    // the warm-up; the cut costs one re-seek when the clip becomes visible.
    const onScreen = new Set(relevant.filter((e) => !e.upcoming).map((e) => e.key));
    const jobs = relevant.filter((e) => !(e.upcoming && onScreen.has(e.key)));
    manager.sweep();
    await Promise.all(jobs.map((entry) => entry.adapter.prepareAt(entry.mediaUs)));
  }

  return {
    factory,
    prepare,
    async renderFrameAt(compositor, timeUs) {
      // Clips are mounted around the playhead only — make sure the ones for
      // this time exist before preparing their decode.
      compositor.updateResidency(timeUs);
      await prepare(timeUs);
      // Exact: animated html rasters for this frame land before it's drawn.
      await compositor.renderExactAt(timeUs);
    },
    sweep() {
      manager.sweep();
    },
    dispose() {
      adapters.clear();
      manager.dispose();
    },
  };
}
