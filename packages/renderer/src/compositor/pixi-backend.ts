/**
 * PixiJS implementation of the SceneBackend. Browser-only; the Compositor and
 * its tests never touch this file. Rendering is manual (no Pixi ticker) — the
 * playback controller decides when frames are drawn.
 */
import { Application, Assets, CanvasSource, Container, Graphics, ImageSource, Sprite, Text, Texture } from "pixi.js";
import { isCaptionClip, isHtmlClip, isTextClip, type Asset, type CaptionClip, type Clip, type EffectInstance, type HtmlClip, type ImageClip, type TextClip, type VideoClip } from "@miraiclip/core";
import { captionProgress, layoutCaption, wordAppearance, type CaptionProgress } from "../captions/layout.js";
import { NodeEffects, type EffectContext } from "../effects/pixi-effects.js";
import type { LocalBounds, Placement, RevealDirection, SceneBackend, SceneNode, SolidSceneNode, VideoSceneNode } from "./types.js";
import { htmlRasterKey, rasterizeHtml } from "../html/rasterize.js";
import { captionMetrics, captionWordStyle, textClipStyle } from "../text/typography.js";

abstract class PixiNode<T extends Container> implements SceneNode {
  private effects: NodeEffects | undefined;
  private revealMask: Graphics | undefined;
  /**
   * The clip's own scale as last placed. The display's scale can carry an
   * extra node-intrinsic factor (video fit-to-composition); bounds divide
   * this out so they report size at clip scale 1.
   */
  protected layoutScale = 1;

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

  getLocalBounds(): LocalBounds | null {
    if (this.display.destroyed) return null;
    if (this.display instanceof Sprite && this.display.texture === Texture.EMPTY) return null;
    const b = this.display.getLocalBounds();
    if (!(b.width > 0 && b.height > 0)) return null;
    const k = this.layoutScale !== 0 ? this.display.scale.x / this.layoutScale : 1;
    return { xPx: b.x * k, yPx: b.y * k, widthPx: b.width * k, heightPx: b.height * k };
  }

  setPlacement(placement: Placement): void {
    this.layoutScale = placement.scale;
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

  private ready: Promise<unknown> = Promise.resolve();

  private loadTexture(): void {
    const src = this.asset?.src;
    if (!src || src === this.loadedSrc) return;
    this.loadedSrc = src;
    this.ready = Assets.load<Texture>(src)
      .then((texture) => {
        if (this.loadedSrc === src && !this.display.destroyed) {
          this.display.texture = texture;
          this.invalidate();
        }
      })
      .catch(() => undefined); // a missing image renders empty, as before — exports just no longer race it
  }

  whenReady(): Promise<void> {
    return this.ready.then(() => undefined);
  }

  update(_clip: Clip): void {
    this.loadTexture();
  }

  setAsset(asset: Asset | undefined): void {
    this.asset = asset;
    this.loadTexture();
  }
}

/**
 * HTML clip node: the template rasterizes (async) to a canvas texture — see
 * html/rasterize.ts for the data-URL/launder mechanics. A key over
 * (template, params, size) gates re-rasters, so a params-driven content
 * update costs one raster and everything else is a plain sprite.
 */
class PixiHtmlNode extends PixiNode<Sprite> {
  private key = "";
  private box = { width: 0, height: 0 };
  /** The current raster (DOM path) and its density — scanned lazily for content bounds. */
  private raster: { canvas: HTMLCanvasElement; density: number } | undefined;
  private contentBounds: LocalBounds | null | undefined;
  private ready: Promise<void> = Promise.resolve();

  constructor(
    stage: Container,
    clip: HtmlClip,
    private readonly assets: Readonly<Record<string, Asset>>,
    invalidate: () => void,
    private readonly context: EffectContext,
  ) {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    stage.addChild(sprite);
    super(sprite, invalidate, context);
    this.update(clip);
  }

  update(clip: Clip): void {
    if (!isHtmlClip(clip)) return;
    const size = this.context.compositionSize();
    const widthPx = clip.widthPx ?? size.width;
    const heightPx = clip.heightPx ?? size.height;
    this.box = { width: widthPx, height: heightPx };
    // Raster at the backend's render density (output ÷ composition, or the
    // preview's DPR): the texture carries the extra pixels while its
    // `resolution` keeps the sprite's LOGICAL size — sharp when the stage
    // scales up, identical layout everywhere.
    const density = Math.max(1, this.context.renderScale?.() ?? 1);
    const key = htmlRasterKey(clip, widthPx, heightPx, density);
    if (key === this.key) return;
    this.key = key;
    const job = rasterizeHtml({
      template: clip.template,
      params: clip.params,
      widthPx,
      heightPx,
      assets: this.assets,
      density,
    }).then((source) => {
      // `source` is a laundered canvas (DOM) or a pre-rendered ImageBitmap
      // (worker export) — both are physical-size pixel buffers.
      if (this.key !== key || this.display.destroyed) return;
      this.raster =
        typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement
          ? { canvas: source, density }
          : undefined;
      this.contentBounds = undefined;
      const previous = this.display.texture;
      const textureSource =
        typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap
          ? new ImageSource({ resource: source, resolution: density })
          : new CanvasSource({ resource: source as HTMLCanvasElement, resolution: density });
      this.display.texture = new Texture({ source: textureSource });
      if (previous !== Texture.EMPTY) previous.destroy(true);
      this.invalidate();
    });
    // Live playback logs and renders empty; exports await whenReady and FAIL
    // loudly (a silently missing overlay in an unattended export is worse).
    job.catch((error: unknown) => console.error("[miraiclip] html clip:", error));
    this.ready = job;
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  /**
   * The painted content, not the raster box: html boxes are usually larger
   * than what they draw (room for offsets, rotation, shadows), and a
   * selection outline around empty space reads as a bug. The opaque bounds
   * are scanned from the raster's alpha once per raster, on first request.
   * Before the raster lands (or for pre-rendered worker bitmaps) the whole
   * box is reported.
   */
  override getLocalBounds(): LocalBounds | null {
    const { width, height } = this.box;
    if (!(width > 0 && height > 0)) return null;
    const whole = { xPx: -width / 2, yPx: -height / 2, widthPx: width, heightPx: height };
    if (!this.raster) return whole;
    if (this.contentBounds === undefined) {
      const opaque = opaqueBounds(this.raster.canvas);
      const d = this.raster.density;
      this.contentBounds = opaque
        ? { xPx: opaque.x / d - width / 2, yPx: opaque.y / d - height / 2, widthPx: opaque.w / d, heightPx: opaque.h / d }
        : null;
    }
    return this.contentBounds ?? whole;
  }
}

/** Bounding box of pixels with visible alpha (null when fully transparent). */
function opaqueBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !canvas.width || !canvas.height) return null;
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3]! > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

class PixiTextNode extends PixiNode<Text> {
  private readonly textContext: EffectContext;

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
    this.textContext = effectContext;
    this.update(clip);
  }

  update(clip: Clip): void {
    if (!isTextClip(clip)) return;
    this.display.text = clip.text;
    // Glyphs rasterize at the render density, not composition density — sharp
    // in upscaled exports and hi-DPI previews (the stage scale would otherwise
    // stretch a composition-resolution glyph atlas).
    this.display.resolution = Math.max(1, this.textContext?.renderScale?.() ?? 1);
    this.display.style = textClipStyle(clip);
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
      text.resolution = Math.max(1, this.context.renderScale?.() ?? 1); // sharp under stage upscale
      text.style = captionWordStyle(style, fontSizePx);
      text.scale.set(1);
    }

    const layout = layoutCaption(words, {
      maxWidthPx: comp.width * 0.8,
      ...captionMetrics(style, fontSizePx),
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
    this.layoutScale = placement.scale; // the fit factor is node-intrinsic size
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
      if (this.placement) this.setPlacement(this.placement);
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
  private outputSize: { width: number; height: number } | undefined;
  private readonly invalidate = (): void => {
    this.dirty = true;
  };

  private readonly effectContext: EffectContext = {
    compositionSize: () => this.compSize,
    // Physical pixels per composition pixel: > 1 when the canvas renders
    // larger than the composition (upscaled export, hi-DPI preview) — nodes
    // that RASTERIZE (html, text) generate at this density to stay sharp.
    renderScale: () => {
      const out = this.outputSize ?? this.compSize;
      return Math.max(out.width / this.compSize.width, out.height / this.compSize.height);
    },
  };

  constructor(private readonly app: Application) {
    this.app.stage.sortableChildren = true;
    this.compSize = { width: app.renderer.width, height: app.renderer.height };
  }

  resize(widthPx: number, heightPx: number): void {
    this.compSize = { width: widthPx, height: heightPx };
    this.applySize();
  }

  setOutputSize(widthPx: number, heightPx: number): void {
    this.outputSize = { width: widthPx, height: heightPx };
    this.applySize();
  }

  /**
   * The canvas renders at the OUTPUT size; the stage scales so composition
   * coordinates keep meaning what they mean. Without an explicit output size
   * the two coincide (scale 1) — the pre-existing behavior.
   */
  private applySize(): void {
    const out = this.outputSize ?? this.compSize;
    this.app.renderer.resize(out.width, out.height);
    this.app.stage.scale.set(out.width / this.compSize.width, out.height / this.compSize.height);
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

  createHtml(clip: HtmlClip, assets: Readonly<Record<string, Asset>>): SceneNode {
    this.invalidate();
    return new PixiHtmlNode(this.app.stage, clip, assets, this.invalidate, this.effectContext);
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
