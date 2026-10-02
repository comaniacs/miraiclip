import {
  evaluateClipInto,
  fromJsonPointer,
  isCaptionClip,
  isImageClip,
  isTextClip,
  type Clip,
  type EvaluatedClip,
  type JsonPatchOp,
  type Project,
  type ProjectDocument,
} from "@miraiclip/core";
import type { Us } from "../media/types.js";
import {
  progressIn,
  windowOf,
  type ClipTransition,
} from "../transitions/timing.js";
import { getTransitionRenderer } from "../transitions/registry.js";
import { computePlacement, placementFromEvaluated, zIndexFor } from "./placement.js";
import { isHtmlClip } from "@miraiclip/core";
import type {
  ClipBounds,
  NodeFactory,
  Placement,
  Point,
  RevealDirection,
  SceneBackend,
  SceneNode,
  SolidSceneNode,
} from "./types.js";

/** True when any VISUAL property is keyframed (volume is the audio engine's). */
function hasVisualAnimation(clip: Clip): boolean {
  const animations = clip.animations;
  if (!animations) return false;
  for (const property of ["x", "y", "scale", "rotation", "opacity"] as const) {
    if ((animations[property]?.length ?? 0) > 0) return true;
  }
  return false;
}

/** The dip overlay sits above every track (z is trackIndex-scaled, so this clears all). */
const OVERLAY_Z = Number.MAX_SAFE_INTEGER;

export interface CompositorOptions {
  /** Extra or overriding node factories per clip kind (the v4/custom-kind seam). */
  factories?: Record<string, NodeFactory>;
  /**
   * Render at this pixel size instead of the composition size (the export
   * `width`/`height` option). Composition coordinates are unaffected — the
   * backend scales the scene. Requires a backend with `setOutputSize`
   * (the Pixi backend has it).
   */
  outputSize?: { width: number; height: number };
}

const builtinFactories: Record<string, NodeFactory> = {
  image: (clip, { backend, assets }) =>
    isImageClip(clip) ? backend.createImage(clip, assets[clip.assetId]) : null,
  text: (clip, { backend }) => (isTextClip(clip) ? backend.createText(clip) : null),
  caption: (clip, { backend }) =>
    isCaptionClip(clip) ? (backend.createCaption?.(clip) ?? null) : null,
  html: (clip, { backend, assets }) =>
    isHtmlClip(clip) ? (backend.createHtml?.(clip, assets) ?? null) : null,
  // "video" registers in step 3; audio has no visual node.
  audio: () => null,
};

/**
 * Mirrors the project document into a scene backend and renders it as a pure
 * function of time. Subscribes to the core's patch events, so any dispatched
 * command — including undo/redo and remote patches — updates the scene
 * granularly: only clips named in the patches are re-synced.
 */
export class Compositor {
  private readonly factories: Record<string, NodeFactory>;
  private readonly nodes = new Map<string, SceneNode>();
  private readonly zByClip = new Map<string, number>();
  // Reused per-tick scratch — keyframe evaluation must not allocate.
  private readonly scratchEvaluated: EvaluatedClip = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, volume: 1 };
  private readonly scratchPlacement: Placement = { xPx: 0, yPx: 0, scale: 1, rotationRad: 0, opacity: 1 };
  private readonly unsubscribe: () => void;
  // clipId → transitions it participates in (windows are position snapshots,
  // rebuilt whenever transitions or clips change).
  private readonly transitionsByClip = new Map<string, ClipTransition[]>();
  // Dip-to-black/white overlay, created lazily on the first active dip.
  private overlay: SolidSceneNode | undefined;
  private lastTimeUs: Us = 0;
  private destroyed = false;

  constructor(
    private readonly project: Project,
    private readonly backend: SceneBackend,
    options: CompositorOptions = {},
  ) {
    this.factories = { ...builtinFactories, ...options.factories };
    const { settings } = this.doc();
    backend.resize(settings.width, settings.height);
    if (options.outputSize) backend.setOutputSize?.(options.outputSize.width, options.outputSize.height);
    this.fullSync();
    this.unsubscribe = project.events.on("patches", ({ patches }) => {
      this.applyPatches(patches);
    });
    this.renderAt(0);
  }

  private doc(): ProjectDocument {
    return this.project.getState().doc;
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  /** Render the composition at a timeline position. Cheap when nothing changed. */
  renderAt(timeUs: Us): void {
    if (this.destroyed) return;
    this.lastTimeUs = timeUs;
    const doc = this.doc();
    let dipAlpha = 0;
    let dipColor = 0x000000;
    for (const [clipId, node] of this.nodes) {
      const clip = doc.clips[clipId];
      if (!clip) {
        node.setVisible(false);
        continue;
      }
      if (doc.tracks[clip.trackId]?.hidden) {
        node.setVisible(false); // hidden track: not drawn (audio follows `muted`)
        continue;
      }
      const transitions = this.transitionsByClip.get(clipId);
      let visible = clip.startUs <= timeUs && timeUs < clip.startUs + clip.durationUs;

      if (!transitions) {
        node.setVisible(visible);
        if (visible) {
          // Animated clips: placement is a function of time — evaluate keyframes
          // (clip-relative, alloc-free) and re-place the node every render.
          if (hasVisualAnimation(clip)) {
            evaluateClipInto(clip, timeUs - clip.startUs, this.scratchEvaluated);
            node.setPlacement(
              placementFromEvaluated(this.scratchEvaluated, doc.settings, this.scratchPlacement),
            );
          }
          node.tick?.(clip, timeUs);
        }
        continue;
      }

      // Transition-participating clip: placement is time-dependent through the
      // window — same evaluate-every-render policy as animated clips. The
      // adjustments compose ONTO the keyframe-evaluated placement, so an
      // animated clip dissolves/slides correctly too.
      let reveal = 1;
      let revealDirection: RevealDirection = "left";
      let opacityFactor = 1;
      let offsetXPx = 0;
      let offsetYPx = 0;
      for (const { window, role } of transitions) {
        if (timeUs < window.startUs || timeUs >= window.endUs) continue;
        const { kind, params } = window.transition;
        // Every kind — built-in or registered — draws through the same
        // renderer contract; a kind without a renderer is a hard cut.
        const renderer = getTransitionRenderer(kind);
        if (!renderer) continue;
        // Both clips render through the whole window (media comes from source
        // headroom) — except overlay kinds (dips), which cover the hard cut.
        if (renderer.rendersBothClips) visible = true;
        const frame = renderer.frame(role, progressIn(window, timeUs), params, {
          compositionSize: doc.settings,
        });
        if (!frame) continue;
        if (frame.opacity !== undefined) opacityFactor *= frame.opacity;
        if (frame.reveal) {
          reveal = Math.min(reveal, frame.reveal.fraction);
          revealDirection = frame.reveal.direction;
        }
        offsetXPx += frame.offsetXPx ?? 0;
        offsetYPx += frame.offsetYPx ?? 0;
        // Highest-alpha overlay wins for the frame.
        if (frame.overlay && frame.overlay.alpha > dipAlpha) {
          dipAlpha = frame.overlay.alpha;
          dipColor = frame.overlay.color;
        }
      }

      node.setVisible(visible);
      if (visible) {
        evaluateClipInto(clip, timeUs - clip.startUs, this.scratchEvaluated);
        const placement = placementFromEvaluated(
          this.scratchEvaluated,
          doc.settings,
          this.scratchPlacement,
        );
        placement.opacity *= opacityFactor;
        placement.xPx += offsetXPx;
        placement.yPx += offsetYPx;
        node.setPlacement(placement);
        node.tick?.(clip, timeUs);
      }
      node.setReveal?.(reveal, revealDirection);
    }

    if (dipAlpha > 0) {
      this.overlay ??= this.backend.createSolid?.();
      if (this.overlay) {
        this.overlay.set(dipColor, dipAlpha);
        this.overlay.setZ(OVERLAY_Z);
        this.overlay.setVisible(true);
      }
    } else {
      this.overlay?.setVisible(false);
    }
    this.backend.render();
  }

  /**
   * Where a clip is drawn at `timeUs` (default: the last rendered time), in
   * composition pixels — or null when the clip isn't on screen then, has no
   * visual node, or has nothing drawn yet. Keyframed position/scale/rotation
   * are evaluated at that time; transition offsets (slides) are not applied,
   * since an interaction layer edits the clip's own transform.
   */
  getClipBounds(clipId: string, timeUs: Us = this.lastTimeUs): ClipBounds | null {
    const doc = this.doc();
    const clip = doc.clips[clipId];
    const node = this.nodes.get(clipId);
    if (!clip || !node?.getLocalBounds) return null;
    if (doc.tracks[clip.trackId]?.hidden) return null; // not drawn → no bounds, no hits
    if (!(clip.startUs <= timeUs && timeUs < clip.startUs + clip.durationUs)) return null;
    const local = node.getLocalBounds();
    if (!local) return null;
    const placement = hasVisualAnimation(clip)
      ? placementFromEvaluated(
          evaluateClipInto(clip, timeUs - clip.startUs, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, volume: 1 }),
          doc.settings,
          { xPx: 0, yPx: 0, scale: 1, rotationRad: 0, opacity: 1 },
        )
      : computePlacement(clip, doc.settings);
    const { xPx: ox, yPx: oy, scale, rotationRad } = placement;
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);
    const toWorld = (lx: number, ly: number): Point => ({
      xPx: ox + (lx * cos - ly * sin) * scale,
      yPx: oy + (lx * sin + ly * cos) * scale,
    });
    const { xPx: lx, yPx: ly, widthPx: lw, heightPx: lh } = local;
    const center = toWorld(lx + lw / 2, ly + lh / 2);
    return {
      clipId,
      originXPx: ox,
      originYPx: oy,
      centerXPx: center.xPx,
      centerYPx: center.yPx,
      widthPx: lw * Math.abs(scale),
      heightPx: lh * Math.abs(scale),
      scale,
      rotationDeg: (rotationRad * 180) / Math.PI,
      corners: [toWorld(lx, ly), toWorld(lx + lw, ly), toWorld(lx + lw, ly + lh), toWorld(lx, ly + lh)],
      local: { ...local },
      z: this.zByClip.get(clipId) ?? 0,
    };
  }

  /**
   * The topmost clip whose drawn content contains the composition-pixel
   * point at `timeUs` (default: the last rendered time), or null. Clips with
   * a static opacity of 0 are skipped (nothing to click on). Pass `filter`
   * to restrict candidates — e.g. exclude clips on locked tracks.
   */
  hitTest(
    xPx: number,
    yPx: number,
    timeUs: Us = this.lastTimeUs,
    filter?: (clip: Clip) => boolean,
  ): string | null {
    const doc = this.doc();
    let best: { id: string; z: number } | null = null;
    for (const clipId of this.nodes.keys()) {
      const clip = doc.clips[clipId];
      if (!clip || (filter && !filter(clip))) continue;
      const z = this.zByClip.get(clipId) ?? 0;
      if (best && z <= best.z) continue;
      const bounds = this.getClipBounds(clipId, timeUs);
      if (!bounds || bounds.scale === 0) continue;
      if ((clip.transform.opacity ?? 1) <= 0 && !hasVisualAnimation(clip)) continue;
      if (pointInBounds(xPx, yPx, bounds)) best = { id: clipId, z };
    }
    return best?.id ?? null;
  }

  /**
   * Resolves when every node's async content (image textures, html rasters)
   * is ready. Exports and stills await this so no frame bakes in a missing
   * texture; live playback doesn't wait (content pops in when loaded).
   */
  async whenReady(): Promise<void> {
    await Promise.all([...this.nodes.values()].map((node) => node.whenReady?.()));
  }

  /**
   * Render the frame at `timeUs` with every node's content current — for
   * time-varying async content (animated html clips) the first render asks
   * for the frame, and this waits for it and renders again. What exports and
   * stills draw each frame with; live playback uses `renderAt`.
   */
  async renderExactAt(timeUs: number): Promise<void> {
    this.renderAt(timeUs);
    for (let pass = 0; pass < 4 && this.hasPendingContent(); pass++) {
      await this.whenReady();
      this.renderAt(timeUs);
    }
  }

  /** True when some node is still loading content for the last render. */
  hasPendingContent(): boolean {
    for (const node of this.nodes.values()) if (node.isPending?.()) return true;
    return false;
  }

  /**
   * Re-sync every node from the document and re-render at the current time.
   * For out-of-band render-input changes the patch stream can't see — e.g. a
   * font asset finishing its load (text metrics changed under every node).
   */
  resync(): void {
    if (this.destroyed) return;
    this.fullSync();
    this.renderAt(this.lastTimeUs);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    for (const node of this.nodes.values()) node.destroy();
    this.nodes.clear();
    this.overlay?.destroy();
    this.overlay = undefined;
    this.backend.destroy();
  }

  // -------------------------------------------------------------------------

  private fullSync(): void {
    const doc = this.doc();
    for (const [clipId, node] of this.nodes) {
      if (!doc.clips[clipId]) {
        node.destroy();
        this.nodes.delete(clipId);
      }
    }
    for (const clipId of Object.keys(doc.clips)) this.syncClip(clipId, doc);
    this.rebuildTransitions(doc);
    this.resyncOrder(doc);
  }

  private rebuildTransitions(doc: ProjectDocument): void {
    this.transitionsByClip.clear();
    for (const transition of Object.values(doc.transitions)) {
      const window = windowOf(transition, doc);
      if (!window) continue;
      for (const [clipId, role] of [
        [transition.fromClipId, "from"],
        [transition.toClipId, "to"],
      ] as const) {
        let list = this.transitionsByClip.get(clipId);
        if (!list) this.transitionsByClip.set(clipId, (list = []));
        list.push({ window, role });
      }
    }
  }

  private syncClip(clipId: string, doc: ProjectDocument): void {
    const clip = doc.clips[clipId];
    const existing = this.nodes.get(clipId);
    if (!clip) {
      if (existing) {
        existing.destroy();
        this.nodes.delete(clipId);
      }
      return;
    }
    let node = existing;
    if (!node) {
      node = this.createNode(clip) ?? undefined;
      if (!node) return;
      this.nodes.set(clipId, node);
    } else {
      node.update(clip);
    }
    node.setPlacement(computePlacement(clip, doc.settings));
    node.setEffects?.(clip.effects ?? []);
  }

  private createNode(clip: Clip): SceneNode | null {
    const factory = this.factories[clip.kind];
    if (!factory) return null;
    const node = factory(clip, { backend: this.backend, assets: this.doc().assets });
    node?.update(clip);
    return node;
  }

  private resyncOrder(doc: ProjectDocument): void {
    doc.trackOrder.forEach((trackId, trackIndex) => {
      const clips = Object.values(doc.clips)
        .filter((clip) => clip.trackId === trackId)
        .sort((a, b) => a.startUs - b.startUs || (a.id < b.id ? -1 : 1));
      clips.forEach((clip, clipIndex) => {
        const z = zIndexFor(trackIndex, clipIndex);
        this.zByClip.set(clip.id, z);
        this.nodes.get(clip.id)?.setZ(z);
      });
    });
  }

  private applyPatches(patches: JsonPatchOp[]): void {
    if (this.destroyed) return;
    const doc = this.doc();
    const clipIds = new Set<string>();
    const assetIds = new Set<string>();
    let structural = false;
    let settingsChanged = false;
    let transitionsChanged = false;

    for (const op of patches) {
      const [domain, id] = fromJsonPointer(op.path);
      switch (domain) {
        case "clips":
          if (id) clipIds.add(id);
          break;
        case "tracks":
        case "trackOrder":
          structural = true;
          break;
        case "settings":
          settingsChanged = true;
          break;
        case "assets":
          if (id) assetIds.add(id);
          break;
        case "transitions":
          transitionsChanged = true;
          break;
      }
    }

    if (settingsChanged) {
      this.backend.resize(doc.settings.width, doc.settings.height);
      // Placement is resolution-dependent — recompute everything.
      for (const clipId of this.nodes.keys()) clipIds.add(clipId);
    }
    if (assetIds.size > 0) {
      for (const clip of Object.values(doc.clips)) {
        if ("assetId" in clip && assetIds.has(clip.assetId)) clipIds.add(clip.id);
      }
    }
    if (transitionsChanged || clipIds.size > 0 || structural || settingsChanged) {
      // Windows are position snapshots — a moved clip or an edited transition
      // both invalidate them. Cheap: documents hold few transitions.
      const wasParticipating = new Set(this.transitionsByClip.keys());
      this.rebuildTransitions(doc);
      if (transitionsChanged) {
        // A clip whose transition was removed may hold mid-window state (a
        // reveal mask, an offset placement) — re-sync it back to baseline.
        for (const clipId of this.transitionsByClip.keys()) wasParticipating.add(clipId);
        for (const clipId of wasParticipating) {
          clipIds.add(clipId);
          this.nodes.get(clipId)?.setReveal?.(1, "left");
        }
      }
    }
    for (const clipId of clipIds) this.syncClip(clipId, doc);
    if (structural || clipIds.size > 0) this.resyncOrder(doc);
    this.renderAt(this.lastTimeUs);
  }
}

/** Point-in-rotated-rectangle, via the inverse of the bounds' transform. */
function pointInBounds(xPx: number, yPx: number, bounds: ClipBounds): boolean {
  const rad = (bounds.rotationDeg * Math.PI) / 180;
  const dx = xPx - bounds.originXPx;
  const dy = yPx - bounds.originYPx;
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  const lx = (dx * cos - dy * sin) / bounds.scale;
  const ly = (dx * sin + dy * cos) / bounds.scale;
  const { local } = bounds;
  return lx >= local.xPx && lx <= local.xPx + local.widthPx && ly >= local.yPx && ly <= local.yPx + local.heightPx;
}
