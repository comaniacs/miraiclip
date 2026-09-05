import type { Asset, Clip, ImageClip, TextClip, VideoClip } from "@miraiclip/core";

/** Pixel-space placement computed from a clip's normalized transform. */
export interface Placement {
  xPx: number;
  yPx: number;
  scale: number;
  rotationRad: number;
  opacity: number;
}

/** A node in the scene graph, owned by the Compositor. */
export interface SceneNode {
  setPlacement(placement: Placement): void;
  setVisible(visible: boolean): void;
  /** Stacking order: higher renders on top. */
  setZ(z: number): void;
  /** Re-apply content-affecting clip properties (text, color, asset swap…). */
  update(clip: Clip): void;
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
