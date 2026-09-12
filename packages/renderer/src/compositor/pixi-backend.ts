/**
 * PixiJS implementation of the SceneBackend. Browser-only; the Compositor and
 * its tests never touch this file. Rendering is manual (no Pixi ticker) — the
 * playback controller decides when frames are drawn.
 */
import { Application, Assets, Container, Graphics, ImageSource, Sprite, Text, Texture } from "pixi.js";
import { isCaptionClip, isTextClip, type Asset, type CaptionClip, type Clip, type EffectInstance, type ImageClip, type TextClip, type VideoClip } from "@miraiclip/core";
import { captionProgress, layoutCaption, wordAppearance, type CaptionProgress } from "../captions/layout.js";
import { NodeEffects, type EffectContext } from "../effects/pixi-effects.js";
import type { Placement, RevealDirection, SceneBackend, SceneNode, SolidSceneNode, VideoSceneNode } from "./types.js";

abstract class PixiNode<T extends Container> implements SceneNode {
  private effects: NodeEffects | undefined;
  private revealMask: Graphics | undefined;

  constructor(
    protected readonly display: T,
    protected readonly invalidate: () => void,
    private readonly effectContext?: EffectContext,
  ) {}

  setEffects(effects: readonly EffectInstance[]): void {
    if (!this.effectContext) return;
    this.effects ??= new NodeEffects(this.display, this.effectContext, this.invalidate);
    this.effects.set(effects);
  }

  /**
   * Wipe reveal: a stage-level Graphics mask (composition space — the mask
   * must not inherit the node's own transform). fraction 1 drops the mask
   * entirely, so outside a transition window there is zero masking cost.
   */
  setReveal(fraction: number, direction: RevealDirection): void {
    if (fraction >= 1) {
      if (!this.revealMask) return;
      this.display.mask = null;
      this.revealMask.parent?.removeChild(this.revealMask);
      this.revealMask.destroy();
      this.revealMask = undefined;
      this.invalidate();
      return;
    }
    const comp = this.effectContext?.compositionSize();
    if (!comp) return;
    if (!this.revealMask) {
      this.revealMask = new Graphics();
      // Sibling of the node: same coordinate space as the composition.
      this.display.parent?.addChild(this.revealMask);
      this.display.mask = this.revealMask;
    }
    const p = Math.max(0, fraction);
    const { width: w, height: h } = comp;
    const mask = this.revealMask;
    mask.clear();
    // The revealed region's edge sweeps in `direction`:
    if (direction === "right") mask.rect(0, 0, w * p, h);
    else if (direction === "left") mask.rect(w * (1 - p), 0, w * p, h);
    else if (direction === "down") mask.rect(0, 0, w, h * p);
    else mask.rect(0, h * (1 - p), w, h * p);
    mask.fill(0xffffff);
    this.invalidate();
  }

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
    if (this.revealMask) {
      this.display.mask = null;
      this.revealMask.parent?.removeChild(this.revealMask);
      this.revealMask.destroy();
      this.revealMask = undefined;
    }
    this.effects?.destroy();
    this.display.parent?.removeChild(this.display);
    this.display.destroy({ children: true });
    this.invalidate();
  }
}

/** Dip overlay: one composition-sized rect, redrawn only when color/size change. */
class PixiSolidNode implements SolidSceneNode {
  private readonly graphics = new Graphics();
  private drawn = { width: -1, height: -1, colorRgb: -1 };

  constructor(
    stage: Container,
    private readonly invalidate: () => void,
    private readonly compositionSize: () => { width: number; height: number },
  ) {
    this.graphics.visible = false;
    stage.addChild(this.graphics);
  }

  set(colorRgb: number, alpha: number): void {
    const { width, height } = this.compositionSize();
    const drawn = this.drawn;
    if (drawn.width !== width || drawn.height !== height || drawn.colorRgb !== colorRgb) {
      this.graphics.clear();
      this.graphics.rect(0, 0, width, height).fill(colorRgb);
      this.drawn = { width, height, colorRgb };
    }
    this.graphics.alpha = alpha;
    this.invalidate();
  }

  setVisible(visible: boolean): void {
    if (this.graphics.visible === visible) return;
    this.graphics.visible = visible;
    this.invalidate();
  }

  setZ(z: number): void {
    if (this.graphics.zIndex === z) return;
    this.graphics.zIndex = z;
    this.invalidate();
  }

  destroy(): void {
    this.graphics.parent?.removeChild(this.graphics);
    this.graphics.destroy();
    this.invalidate();
  }
}

class PixiImageNode extends PixiNode<Sprite> {
  private loadedSrc: string | undefined;

  constructor(
    stage: Container,
    private asset: Asset | undefined,
    invalidate: () => void,
    effectContext: EffectContext,
  ) {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    stage.addChild(sprite);
    super(sprite, invalidate, effectContext);
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
  constructor(
    stage: Container,
    clip: TextClip,
    invalidate: () => void,
    effectContext: EffectContext,
  ) {
    const text = new Text({ text: clip.text });
    text.anchor.set(0.5);
    stage.addChild(text);
    super(text, invalidate, effectContext);
    this.update(clip);
  }

  update(clip: Clip): void {
    if (!isTextClip(clip)) return;
    this.display.text = clip.text;
    this.display.style = {
      fontFamily: clip.fontFamily,
      fontSize: clip.fontSizePx,
      fill: clip.color,
    };
    this.invalidate();
  }
}

/**
 * Karaoke caption block: one Text per word (wrapped and centered by the pure
 * layout module), an optional background box, and per-word emphasis that
 * changes only at word boundaries (style writes are dirty-gated on progress).
 */
class PixiCaptionNode extends PixiNode<Container> {
  private readonly wordTexts: Text[] = [];
  private background: Graphics | undefined;
  private clip: CaptionClip;
  private lastProgress: CaptionProgress = { activeIndex: -2, startedCount: -1 };

  constructor(
    stage: Container,
    clip: CaptionClip,
    invalidate: () => void,
    private readonly context: EffectContext,
  ) {
    const container = new Container();
    stage.addChild(container);
    super(container, invalidate, context);
    this.clip = clip;
    this.rebuild(clip);
  }

  private rebuild(clip: CaptionClip): void {
    this.clip = clip;
    const comp = this.context.compositionSize();
    const { style, words } = clip;
    const fontSizePx = style.fontSizeFrac * comp.height;

    // One Text per word — created first so layout can measure real glyphs.
    while (this.wordTexts.length > words.length) this.wordTexts.pop()!.destroy();
    for (let i = 0; i < words.length; i++) {
      let text = this.wordTexts[i];
      if (!text) {
        text = new Text({ text: "" });
        text.anchor.set(0.5);
        this.display.addChild(text);
        this.wordTexts.push(text);
      }
      text.text = words[i]!.text;
      text.style = { fontFamily: style.fontFamily, fontSize: fontSizePx, fill: style.color };
      text.scale.set(1);
    }

    const layout = layoutCaption(words, {
      maxWidthPx: comp.width * 0.8,
      lineHeightPx: fontSizePx * 1.3,
      spaceWidthPx: fontSizePx * 0.33,
      measure: (i) => this.wordTexts[i]!.width,
    });
    layout.positions.forEach((position, i) => {
      this.wordTexts[i]!.position.set(position.xPx, position.yPx);
    });

    // Background box behind the block (padding scales with the font).
    if (style.backgroundColor) {
      const pad = fontSizePx * 0.35;
      this.background ??= (() => {
        const g = new Graphics();
        this.display.addChildAt(g, 0);
        return g;
      })();
      this.background.clear();
      this.background
        .roundRect(
          -layout.widthPx / 2 - pad,
          -layout.heightPx / 2 - pad * 0.6,
          layout.widthPx + pad * 2,
          layout.heightPx + pad * 1.2,
          fontSizePx * 0.2,
        )
        .fill(style.backgroundColor);
    } else if (this.background) {
      this.background.destroy();
      this.background = undefined;
    }

    // Re-apply emphasis for the current progress against the new texts.
    const progress = this.lastProgress;
    this.lastProgress = { activeIndex: -2, startedCount: -1 };
    this.applyProgress(progress);
    this.invalidate();
  }

  private applyProgress(progress: CaptionProgress): void {
    if (
      progress.activeIndex === this.lastProgress.activeIndex &&
      progress.startedCount === this.lastProgress.startedCount
    ) {
      return;
    }
    this.lastProgress = progress;
    const { style } = this.clip;
    for (let i = 0; i < this.wordTexts.length; i++) {
      const appearance = wordAppearance(style.preset, i, progress);
      const text = this.wordTexts[i]!;
      text.style.fill = appearance.highlighted ? style.highlightColor : style.color;
      text.scale.set(appearance.scale);
    }
    this.invalidate();
  }

  tick(clip: Clip, timeUs: number): void {
    if (!isCaptionClip(clip)) return;
    this.applyProgress(captionProgress(clip.words, timeUs - clip.startUs));
  }

  update(clip: Clip): void {
    if (!isCaptionClip(clip)) return;
    this.rebuild(clip);
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
    super(sprite, invalidate, { compositionSize });
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
    // Copy: the compositor passes a REUSED scratch object for animated clips,
    // and this reference outlives the call (re-applied on source-size changes).
    this.placement = { ...placement };
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

  private readonly effectContext: EffectContext = {
    compositionSize: () => this.compSize,
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
    return new PixiImageNode(this.app.stage, asset, this.invalidate, this.effectContext);
  }

  createText(clip: TextClip): SceneNode {
    this.invalidate();
    return new PixiTextNode(this.app.stage, clip, this.invalidate, this.effectContext);
  }

  createVideo(_clip: VideoClip): VideoSceneNode {
    this.invalidate();
    return new PixiVideoNode(this.app.stage, this.invalidate, () => this.compSize);
  }

  createCaption(clip: CaptionClip): SceneNode {
    this.invalidate();
    return new PixiCaptionNode(this.app.stage, clip, this.invalidate, this.effectContext);
  }

  createSolid(): SolidSceneNode {
    this.invalidate();
    return new PixiSolidNode(this.app.stage, this.invalidate, () => this.compSize);
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
