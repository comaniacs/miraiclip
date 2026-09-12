import {
  evaluateClipInto,
  fromJsonPointer,
  isImageClip,
  isTextClip,
  type Clip,
  type EvaluatedClip,
  type JsonPatchOp,
  type Project,
  type ProjectDocument,
} from "@miraiclip/core";
import type { Us } from "../media/types.js";
import { computePlacement, placementFromEvaluated, zIndexFor } from "./placement.js";
import type { NodeFactory, Placement, SceneBackend, SceneNode } from "./types.js";

/** True when any VISUAL property is keyframed (volume is the audio engine's). */
function hasVisualAnimation(clip: Clip): boolean {
  const animations = clip.animations;
  if (!animations) return false;
  for (const property of ["x", "y", "scale", "rotation", "opacity"] as const) {
    if ((animations[property]?.length ?? 0) > 0) return true;
  }
  return false;
}

export interface CompositorOptions {
  /** Extra or overriding node factories per clip kind (the v4/custom-kind seam). */
  factories?: Record<string, NodeFactory>;
}

const builtinFactories: Record<string, NodeFactory> = {
  image: (clip, { backend, assets }) =>
    isImageClip(clip) ? backend.createImage(clip, assets[clip.assetId]) : null,
  text: (clip, { backend }) => (isTextClip(clip) ? backend.createText(clip) : null),
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
  // Reused per-tick scratch — keyframe evaluation must not allocate.
  private readonly scratchEvaluated: EvaluatedClip = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, volume: 1 };
  private readonly scratchPlacement: Placement = { xPx: 0, yPx: 0, scale: 1, rotationRad: 0, opacity: 1 };
  private readonly unsubscribe: () => void;
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
    for (const [clipId, node] of this.nodes) {
      const clip = doc.clips[clipId];
      const visible =
        !!clip && clip.startUs <= timeUs && timeUs < clip.startUs + clip.durationUs;
      node.setVisible(visible);
      if (visible && clip) {
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
    }
    this.backend.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    for (const node of this.nodes.values()) node.destroy();
    this.nodes.clear();
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
    this.resyncOrder(doc);
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
        this.nodes.get(clip.id)?.setZ(zIndexFor(trackIndex, clipIndex));
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
    for (const clipId of clipIds) this.syncClip(clipId, doc);
    if (structural || clipIds.size > 0) this.resyncOrder(doc);
    this.renderAt(this.lastTimeUs);
  }
}
