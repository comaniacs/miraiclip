import type { Asset, Clip, EffectInstance, ImageClip, TextClip, VideoClip } from "@miraiclip/core";

/** Pixel-space placement computed from a clip's normalized transform. */
export interface Placement {
  xPx: number;
  yPx: number;
  scale: number;
  rotationRad: number;
  opacity: number;
}

/** Which way a wipe's edge sweeps / a slide's clip moves. */
export type RevealDirection = "left" | "right" | "up" | "down";

/** A node in the scene graph, owned by the Compositor. */
export interface SceneNode {
  /** Apply placement. The object may be REUSED by the caller — copy it if kept. */
  setPlacement(placement: Placement): void;
  setVisible(visible: boolean): void;
  /** Stacking order: higher renders on top. */
  setZ(z: number): void;
  /** Re-apply content-affecting clip properties (text, color, asset swap…). */
  update(clip: Clip): void;
  /** Apply the clip's effect stack (enabled entries, array order). Optional per backend. */
  setEffects?(effects: readonly EffectInstance[]): void;
  /**
   * Wipe transitions: show only part of the node, clipped in COMPOSITION
   * space. The revealed region grows to cover the frame as `fraction` goes
   * 0 → 1, its edge sweeping in `direction`; 1 clears the clip entirely.
   * Optional per backend.
   */
  setReveal?(fraction: number, direction: RevealDirection): void;
  /**
   * Called every render while the clip is visible, for time-dependent content
   * (video frames). `timeUs` is the timeline position.
   */
  tick?(clip: Clip, timeUs: number): void;
  destroy(): void;
}

/** A scene node that displays decoded video frames. */
export interface VideoSceneNode extends SceneNode {
  /** Show a decoded frame (a `VideoFrame` in the browser), or clear with null. */
  setFrame(frame: unknown | null): void;
  /**
   * The source's native pixel size. Layout treats scale 1 as native size, so a
   * backend that receives frames decoded below native resolution (proxy
   * playback of 4K sources) uses this to keep the rendered size identical.
   */
  setSourceSize?(widthPx: number, heightPx: number): void;
}

/**
 * A full-composition solid overlay — how dip-to-black/white transitions cover
 * the hard cut. Owned by the Compositor, created lazily on first use.
 */
export interface SolidSceneNode {
  /** Cover the composition with `colorRgb` (0xRRGGBB) at `alpha`. */
  set(colorRgb: number, alpha: number): void;
  setVisible(visible: boolean): void;
  setZ(z: number): void;
  destroy(): void;
}

/**
 * Rendering backend abstraction. The production implementation is PixiJS;
 * tests use a fake. Backends draw — the Compositor decides what and when.
 */
export interface SceneBackend {
  resize(widthPx: number, heightPx: number): void;
  createImage(clip: ImageClip, asset: Asset | undefined): SceneNode;
  createText(clip: TextClip): SceneNode;
  createVideo(clip: VideoClip): VideoSceneNode;
  /** Full-composition solid overlay (dip transitions). Optional per backend. */
  createSolid?(): SolidSceneNode;
  render(): void;
  destroy(): void;
}

export interface NodeFactoryContext {
  backend: SceneBackend;
  assets: Readonly<Record<string, Asset>>;
}

/**
 * Creates the scene node for one clip kind — the extension seam for custom
 * clip kinds (and how video plugs in). Return null to render nothing.
 */
export type NodeFactory = (clip: Clip, context: NodeFactoryContext) => SceneNode | null;
