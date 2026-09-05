/**
 * PixiJS implementation of the SceneBackend. Browser-only; the Compositor and
 * its tests never touch this file. Rendering is manual (no Pixi ticker) — the
 * playback controller decides when frames are drawn.
 */
import { Application, Assets, Container, ImageSource, Sprite, Text, Texture } from "pixi.js";
import type { Asset, Clip, ImageClip, TextClip, VideoClip } from "@miraiclip/core";
import type { Placement, SceneBackend, SceneNode, VideoSceneNode } from "./types.js";

abstract class PixiNode<T extends Container> implements SceneNode {
  constructor(
    protected readonly display: T,
    protected readonly invalidate: () => void,
  ) {}

  setPlacement(placement: Placement): void {
    this.display.position.set(placement.xPx, placement.yPx);
    this.display.scale.set(placement.scale);
    this.display.rotation = placement.rotationRad;
    this.display.alpha = placement.opacity;
    this.invalidate();
  }

  setVisible(visible: boolean): void {
    // Change-gated: the compositor sets visibility every animation frame, and
    // an unchanged scene must not force a GPU re-render (see render()).
    if (this.display.visible === visible) return;
    this.display.visible = visible;
    this.invalidate();
  }

  setZ(z: number): void {
    if (this.display.zIndex === z) return;
    this.display.zIndex = z;
    this.invalidate();
  }

  abstract update(clip: Clip): void;

  destroy(): void {
    this.display.parent?.removeChild(this.display);
    this.display.destroy({ children: true });
    this.invalidate();
  }
}

class PixiImageNode extends PixiNode<Sprite> {
  private loadedSrc: string | undefined;

  constructor(
    stage: Container,
    private asset: Asset | undefined,
    invalidate: () => void,
  ) {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    stage.addChild(sprite);
    super(sprite, invalidate);
    this.loadTexture();
  }

  private loadTexture(): void {
    const src = this.asset?.src;
    if (!src || src === this.loadedSrc) return;
    this.loadedSrc = src;
    void Assets.load<Texture>(src).then((texture) => {
      if (this.loadedSrc === src && !this.display.destroyed) {
        this.display.texture = texture;
        this.invalidate();
      }
    });
  }

  update(_clip: Clip): void {
    this.loadTexture();
  }

  setAsset(asset: Asset | undefined): void {
    this.asset = asset;
    this.loadTexture();
  }
}

class PixiTextNode extends PixiNode<Text> {
  constructor(stage: Container, clip: TextClip, invalidate: () => void) {
    const text = new Text({ text: clip.text });
    text.anchor.set(0.5);
    stage.addChild(text);
    super(text, invalidate);
    this.update(clip);
  }

  update(clip: Clip): void {
    if (clip.kind !== "text") return;
    this.display.text = clip.text;
    this.display.style = {
      fontFamily: clip.fontFamily,
      fontSize: clip.fontSizePx,
      fill: clip.color,
    };
    this.invalidate();
  }
}

class PixiVideoNode extends PixiNode<Sprite> implements VideoSceneNode {
  private source: ImageSource | undefined;
  private texture: Texture | undefined;
  private lastNative: unknown = null;
  private placement: Placement | undefined;
  private frameWidthPx = 0;
  private frameHeightPx = 0;

  constructor(
    stage: Container,
    invalidate: () => void,
    private readonly compositionSize: () => { width: number; height: number },
  ) {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    stage.addChild(sprite);
    super(sprite, invalidate);
  }

  /**
   * Scale 1 means "fit the composition" (contain, aspect preserved) — the
   * semantic every editor uses; a 4K source on a 720p canvas must never render
   * as a native-pixel center crop. Fitting the *decoded frame* to the
   * composition also makes rendered size independent of decode resolution
   * (proxy playback), since proxies preserve aspect ratio.
   */
  private effectivePlacement(placement: Placement): Placement {
    if (this.frameWidthPx <= 0 || this.frameHeightPx <= 0) return placement;
    const comp = this.compositionSize();
    const fit = Math.min(comp.width / this.frameWidthPx, comp.height / this.frameHeightPx);
    return { ...placement, scale: placement.scale * fit };
  }

  override setPlacement(placement: Placement): void {
    this.placement = placement;
    super.setPlacement(this.effectivePlacement(placement));
  }

  setSourceSize(_widthPx: number, _heightPx: number): void {
    // Native size is irrelevant under fit-to-composition semantics; kept so
    // future placement modes (native-pixel, cover) have the metadata path.
  }

  setFrame(native: unknown | null): void {
    if (!native) {
      if (this.lastNative === null) return;
      this.lastNative = null;
      this.display.texture = Texture.EMPTY;
      this.invalidate();
      return;
    }
    // Dedupe: the compositor ticks every animation frame, but a decoded frame
    // is only worth uploading to the GPU once. Skip when it hasn't changed.
    if (native === this.lastNative) return;
    this.lastNative = native;
    // Frames arrive as ImageBitmaps (see the WebCodecs adapter) and upload
    // straight to the GL texture — one copy, no 2D-canvas hop.
    const bitmap = native as ImageBitmap;
    if (bitmap.width !== this.frameWidthPx || bitmap.height !== this.frameHeightPx) {
      this.frameWidthPx = bitmap.width;
      this.frameHeightPx = bitmap.height;
      if (this.placement) super.setPlacement(this.effectivePlacement(this.placement));
    }
    if (!this.source || this.source.width !== bitmap.width || this.source.height !== bitmap.height) {
      this.texture?.destroy(true);
      this.source = new ImageSource({ resource: bitmap });
      this.texture = new Texture({ source: this.source });
    } else {
      this.source.resource = bitmap;
      this.source.update();
    }
    if (this.display.texture !== this.texture) this.display.texture = this.texture!;
    this.invalidate();
  }

  update(_clip: Clip): void {
    // Volume and trim have no visual representation; frames arrive via setFrame.
  }

  override destroy(): void {
    this.texture?.destroy(true);
    super.destroy();
  }
}

class PixiSceneBackend implements SceneBackend {
  /**
   * True when anything visible changed since the last render. The playback
   * loop calls render() every animation frame; re-rendering an unchanged
   * scene (a paused 4K frame, say) burns GPU/CPU for identical pixels.
   */
  private dirty = true;
  private compSize = { width: 0, height: 0 };
  private readonly invalidate = (): void => {
    this.dirty = true;
  };

  constructor(private readonly app: Application) {
    this.app.stage.sortableChildren = true;
    this.compSize = { width: app.renderer.width, height: app.renderer.height };
  }

  resize(widthPx: number, heightPx: number): void {
    this.app.renderer.resize(widthPx, heightPx);
    this.compSize = { width: widthPx, height: heightPx };
    this.invalidate();
  }

  createImage(_clip: ImageClip, asset: Asset | undefined): SceneNode {
    this.invalidate();
    return new PixiImageNode(this.app.stage, asset, this.invalidate);
  }

  createText(clip: TextClip): SceneNode {
    this.invalidate();
    return new PixiTextNode(this.app.stage, clip, this.invalidate);
  }

  createVideo(_clip: VideoClip): VideoSceneNode {
    this.invalidate();
    return new PixiVideoNode(this.app.stage, this.invalidate, () => this.compSize);
  }

  render(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.app.render();
  }

  destroy(): void {
    this.app.destroy(undefined, { children: true });
  }
}

export interface PixiBackendOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  background?: number;
  /**
   * Keep the drawing buffer readable after render (canvas.toDataURL,
   * drawImage-based pixel readback). Costs a little GPU memory/bandwidth —
   * enable for testing, thumbnails, or screenshot features (default false).
   */
  preserveDrawingBuffer?: boolean;
}

/** Create the PixiJS scene backend bound to a canvas. */
export async function createPixiBackend(options: PixiBackendOptions): Promise<SceneBackend> {
  const app = new Application();
  await app.init({
    canvas: options.canvas,
    width: options.width,
    height: options.height,
    background: options.background ?? 0x000000,
    autoStart: false,
    sharedTicker: false,
    antialias: true,
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  });
  return new PixiSceneBackend(app);
}
