/**
 * PixiJS implementation of the SceneBackend. Browser-only; the Compositor and
 * its tests never touch this file. Rendering is manual (no Pixi ticker) — the
 * playback controller decides when frames are drawn.
 */
import { Application, Assets, Container, Sprite, Text, Texture } from "pixi.js";
import type { Asset, Clip, ImageClip, TextClip, VideoClip } from "@miraiclip/core";
import type { Placement, SceneBackend, SceneNode, VideoSceneNode } from "./types.js";

abstract class PixiNode<T extends Container> implements SceneNode {
  constructor(protected readonly display: T) {}

  setPlacement(placement: Placement): void {
    this.display.position.set(placement.xPx, placement.yPx);
    this.display.scale.set(placement.scale);
    this.display.rotation = placement.rotationRad;
    this.display.alpha = placement.opacity;
  }

  setVisible(visible: boolean): void {
    this.display.visible = visible;
  }

  setZ(z: number): void {
    this.display.zIndex = z;
  }

  abstract update(clip: Clip): void;

  destroy(): void {
    this.display.parent?.removeChild(this.display);
    this.display.destroy({ children: true });
  }
}

class PixiImageNode extends PixiNode<Sprite> {
  private loadedSrc: string | undefined;

  constructor(
    stage: Container,
    private asset: Asset | undefined,
  ) {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    stage.addChild(sprite);
    super(sprite);
    this.loadTexture();
  }

  private loadTexture(): void {
    const src = this.asset?.src;
    if (!src || src === this.loadedSrc) return;
    this.loadedSrc = src;
    void Assets.load<Texture>(src).then((texture) => {
      if (this.loadedSrc === src && !this.display.destroyed) {
        this.display.texture = texture;
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
  constructor(stage: Container, clip: TextClip) {
    const text = new Text({ text: clip.text });
    text.anchor.set(0.5);
    stage.addChild(text);
    super(text);
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
  }
}

class PixiVideoNode extends PixiNode<Sprite> implements VideoSceneNode {
  private readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  private readonly context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private texture: Texture | undefined;
  private lastNative: unknown = null;

  constructor(stage: Container) {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    stage.addChild(sprite);
    super(sprite);
    this.canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(2, 2)
        : document.createElement("canvas");
    const context = this.canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!context) throw new Error("2D canvas context unavailable for video rendering");
    this.context = context;
  }

  setFrame(native: unknown | null): void {
    if (!native) {
      this.lastNative = null;
      this.display.texture = Texture.EMPTY;
      return;
    }
    // Dedupe: the compositor ticks every animation frame, but a decoded frame
    // is only worth uploading to the GPU once. Skip when it hasn't changed.
    if (native === this.lastNative) return;
    this.lastNative = native;
    const frame = native as VideoFrame;
    const width = frame.displayWidth;
    const height = frame.displayHeight;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.texture?.destroy(true);
      this.texture = undefined;
    }
    this.context.drawImage(frame, 0, 0);
    if (!this.texture) {
      this.texture = Texture.from(this.canvas as HTMLCanvasElement);
    } else {
      this.texture.source.update();
    }
    if (this.display.texture !== this.texture) this.display.texture = this.texture;
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
  constructor(private readonly app: Application) {
    this.app.stage.sortableChildren = true;
  }

  resize(widthPx: number, heightPx: number): void {
    this.app.renderer.resize(widthPx, heightPx);
  }

  createImage(_clip: ImageClip, asset: Asset | undefined): SceneNode {
    return new PixiImageNode(this.app.stage, asset);
  }

  createText(clip: TextClip): SceneNode {
    return new PixiTextNode(this.app.stage, clip);
  }

  createVideo(_clip: VideoClip): VideoSceneNode {
    return new PixiVideoNode(this.app.stage);
  }

  render(): void {
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
  });
  return new PixiSceneBackend(app);
}
