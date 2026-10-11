/**
 * PixiJS implementation of the SceneBackend. Browser-only; the Compositor and
 * its tests never touch this file. Rendering is manual (no Pixi ticker) — the
 * playback controller decides when frames are drawn.
 */
import { Application, Assets, CanvasSource, Container, Graphics, ImageSource, Sprite, Text, Texture, type TextureSource } from "pixi.js";
import { isCaptionClip, isHtmlClip, isTextClip, type Asset, type CaptionClip, type Clip, type EffectInstance, type HtmlClip, type ImageClip, type TextClip, type VideoClip } from "@miraiclip/core";
import { captionProgress, displayText, layoutCaption, POP_SCALE, wordAppearance, type CaptionProgress } from "../captions/layout.js";
import { NodeEffects, type EffectContext } from "../effects/pixi-effects.js";
import type { LocalBounds, Placement, RevealDirection, SceneBackend, SceneNode, SolidSceneNode, VideoSceneNode } from "./types.js";
import { htmlAnimationTiming, htmlRasterKey, rasterizeHtml, substituteParams } from "../html/rasterize.js";
import { analyzeHtmlAnimations, type HtmlAnimationTimeline } from "../html/animation-timeline.js";
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

/**
 * Image textures shared by every image node of one backend, reference-counted
 * by source. Pixi's `Assets` cache keeps a loaded texture forever; with nodes
 * mounted only near the playhead, a long timeline would still accumulate every
 * image it ever showed. The last release unloads the texture (after a short
 * grace, so a scrub back across the clip doesn't re-decode it).
 */
class ImageTextureCache {
  private readonly refs = new Map<string, number>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly graceMs = 2_000) {}

  acquire(src: string): Promise<Texture> {
    this.refs.set(src, (this.refs.get(src) ?? 0) + 1);
    const timer = this.timers.get(src);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(src);
    }
    return Assets.load<Texture>(src);
  }

  release(src: string): void {
    const count = (this.refs.get(src) ?? 0) - 1;
    if (count > 0) {
      this.refs.set(src, count);
      return;
    }
    this.refs.delete(src);
    if (this.timers.has(src)) return;
    this.timers.set(
      src,
      setTimeout(() => {
        this.timers.delete(src);
        if (!this.refs.has(src)) void Assets.unload(src).catch(() => undefined);
      }, this.graceMs),
    );
  }

  destroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}

class PixiImageNode extends PixiNode<Sprite> {
  private loadedSrc: string | undefined;
  private loading = false;

  constructor(
    stage: Container,
    private asset: Asset | undefined,
    invalidate: () => void,
    effectContext: EffectContext,
    private readonly textures: ImageTextureCache,
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
    if (this.loadedSrc !== undefined) this.textures.release(this.loadedSrc);
    this.loadedSrc = src;
    this.loading = true;
    this.ready = this.textures
      .acquire(src)
      .then((texture) => {
        if (this.loadedSrc === src && !this.display.destroyed) {
          this.display.texture = texture;
          this.invalidate();
        }
      })
      .catch(() => undefined) // a missing image renders empty, as before — exports just no longer race it
      .finally(() => {
        if (this.loadedSrc === src) this.loading = false;
      });
  }

  whenReady(): Promise<void> {
    return this.ready.then(() => undefined);
  }

  /** Still loading: frame-exact renderers (export) wait for it before drawing. */
  isPending(): boolean {
    return this.loading;
  }

  update(_clip: Clip): void {
    this.loadTexture();
  }

  setAsset(asset: Asset | undefined): void {
    this.asset = asset;
    this.loadTexture();
  }

  override destroy(): void {
    // Detach first: the shared texture must outlive this sprite.
    this.display.texture = Texture.EMPTY;
    super.destroy();
    if (this.loadedSrc !== undefined) this.textures.release(this.loadedSrc);
    this.loadedSrc = undefined;
  }
}

/**
 * HTML clip node: the template rasterizes (async) to a canvas texture — see
 * html/rasterize.ts for the data-URL/launder mechanics. A key over
 * (template, params, size) gates re-rasters, so a params-driven content
 * update costs one raster and everything else is a plain sprite.
 *
 * Animated clips (`clip.animated`) re-raster per frame: `tick` asks for the
 * frame at the clip's animation time. One raster runs at a time; requests
 * made meanwhile collapse to the newest, and the previous frame stays on
 * screen until the next lands (preview never stalls). `whenReady` resolves
 * once the LATEST requested frame is on the texture — exports and stills
 * await it per frame, so every exported frame is exact.
 */
class PixiHtmlNode extends PixiNode<Sprite> {
  /** Everything but time: a change re-rasters (and drops in-flight results). */
  private key = "";
  private box = { width: 0, height: 0 };
  /** The current raster (DOM path) and its density — scanned lazily for content bounds. */
  private raster: { canvas: HTMLCanvasElement; density: number } | undefined;
  private contentBounds: LocalBounds | null | undefined;
  private ready: Promise<void> = Promise.resolve();
  private clip: HtmlClip;
  /** Raster inputs other than time, captured at the last update. */
  private inputs: { widthPx: number; heightPx: number; density: number } = { widthPx: 0, heightPx: 0, density: 1 };
  /** Animated: the frame wanted (seconds) and the frame on the texture. */
  private wantTimeS: number | undefined;
  private shownTimeS: number | undefined;
  private running = false;
  private pending = false;
  /** The current content (key) has a raster on the texture. */
  private shown = false;
  /** Failed rasters retry on a backoff (ms timestamp of the next attempt). */
  private failures = 0;
  private retryAt = 0;
  /**
   * This node's own raster canvas and the texture over it, reused across
   * rasters: an animated clip re-rasters every frame, and a new canvas plus a
   * new GPU texture per frame was the main source of preview memory churn.
   */
  private rasterCanvas: HTMLCanvasElement | undefined;
  /** This node's SVG loader, reused across rasters (see RasterizeHtmlOptions.image). */
  private rasterImage: HTMLImageElement | undefined;
  private canvasTexture: { texture: Texture; source: TextureSource; width: number; height: number } | undefined;
  /** When the last animated raster started (ms) — for the preview frame cap. */
  private lastRasterAtMs = 0;
  /**
   * `reuseStaticFrames`: when the content's picture changes (from its CSS
   * animations), `null` when it can't be analysed, undefined before analysis.
   */
  private timeline: HtmlAnimationTimeline | null | undefined;
  /** The constant span (`sinceS`) of the frame on the texture, when known. */
  private shownSinceS: number | undefined;
  /** Smoothed main-thread cost of one raster of this content (ms), for the budget. */
  private rasterCostMs = 0;

  constructor(
    stage: Container,
    clip: HtmlClip,
    private readonly assets: Readonly<Record<string, Asset>>,
    invalidate: () => void,
    private readonly context: EffectContext,
    private readonly rasterOptions: HtmlRasterOptions = {},
    private readonly load: HtmlRasterLoad = new HtmlRasterLoad(),
  ) {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    stage.addChild(sprite);
    super(sprite, invalidate, context);
    this.clip = clip;
    this.update(clip);
  }

  update(clip: Clip): void {
    if (!isHtmlClip(clip)) return;
    this.clip = clip;
    const size = this.context.compositionSize();
    const widthPx = clip.widthPx ?? size.width;
    const heightPx = clip.heightPx ?? size.height;
    this.box = { width: widthPx, height: heightPx };
    // Raster at the backend's render density (output ÷ composition, or the
    // preview's DPR): the texture carries the extra pixels while its
    // `resolution` keeps the sprite's LOGICAL size — sharp when the stage
    // scales up, identical layout everywhere.
    const density = Math.max(this.rasterOptions.minDensity ?? 1, this.context.renderScale?.() ?? 1);
    const animated = clip.animated === true;
    // Animated: the animation length is part of the content (`--T`), so a
    // trim re-rasters too.
    const key = htmlRasterKey(clip, widthPx, heightPx, density) +
      (animated ? `|${clip.durationUs}|${clip.animationOffsetUs ?? 0}` : "");
    if (key === this.key) return;
    this.key = key;
    this.inputs = { widthPx, heightPx, density };
    this.shownTimeS = undefined;
    this.shownSinceS = undefined;
    this.timeline = undefined;
    this.rasterCostMs = 0;
    this.shown = false;
    this.failures = 0;
    this.retryAt = 0;
    // Animated: start from the frame last asked for (or the first frame).
    this.wantTimeS = animated ? (this.wantTimeS ?? htmlAnimationTiming(clip, clip.startUs).timeS) : undefined;
    this.request();
  }

  tick(clip: Clip, timeUs: number): void {
    if (!isHtmlClip(clip)) return;
    const now = Date.now();
    if (!clip.animated) {
      // A failed static raster retries (on a backoff) instead of staying blank.
      if (!this.shown && !this.running && this.failures > 0 && now >= this.retryAt) this.request();
      return;
    }
    const { timeS } = htmlAnimationTiming(clip, timeUs);
    // Same picture as the frame on screen (nothing animates between them):
    // keep it — no raster, no main-thread time, no garbage.
    if (this.shown && !this.running && this.shownSinceS !== undefined && this.constantSince(timeS) === this.shownSinceS) {
      this.load.idle(this);
      return;
    }
    // Up to date, or on its way. A frame that never landed (its raster
    // failed) is asked for again — paused playback requests the same frame
    // forever, so waiting for the time to change would leave a stale (or
    // empty) frame on screen. While failing, retries wait for the backoff.
    if (timeS === this.wantTimeS && (this.running || this.shownTimeS === timeS)) return;
    // Preview pacing: the frame cap, and the shared main-thread budget (each
    // animating clip gets an equal share). The newest wanted time is picked
    // up by a later tick; the last frame stays on screen meanwhile.
    // Checked while a raster runs too: requests made meanwhile would chain
    // the next raster straight after it, back to back, ignoring the pace.
    this.load.active(this, now);
    if (this.shown && now - this.lastRasterAtMs < this.minIntervalMs()) return;
    this.wantTimeS = timeS;
    if (!this.running && this.failures > 0 && now < this.retryAt) return;
    this.request();
  }

  /** Shortest gap between animated rasters (ms) from the frame cap and the budget. */
  private minIntervalMs(): number {
    const maxFps = this.rasterOptions.maxAnimatedFps;
    const capMs = maxFps ? 1000 / maxFps : 0;
    const budget = this.rasterOptions.budget;
    if (!budget || budget <= 0 || this.rasterCostMs <= 0) return capMs;
    return Math.max(capMs, (this.rasterCostMs * this.load.activeCount()) / Math.min(1, budget));
  }

  /**
   * Start of the constant span containing animation time `timeS`, or
   * undefined when every frame differs there (or reuse is off / unknown).
   */
  private constantSince(timeS: number): number | undefined {
    if (!this.rasterOptions.reuseStaticFrames || !this.clip.animated) return undefined;
    if (this.timeline === undefined) {
      const { widthPx, heightPx } = this.inputs;
      this.timeline = analyzeHtmlAnimations(substituteParams(this.clip.template, this.clip.params), widthPx, heightPx) ?? null;
    }
    return this.timeline?.constantSpanAt(timeS)?.sinceS;
  }

  /** True while the texture lags the wanted frame (a raster is due or running). */
  isPending(): boolean {
    return this.running || this.pending;
  }

  /** Raster the wanted content; coalesces while a raster is in flight. */
  private request(): void {
    this.pending = true;
    if (this.running) return;
    this.running = true;
    this.ready = this.pump().finally(() => {
      this.running = false;
    });
    // Live playback logs and renders empty; exports await whenReady and FAIL
    // loudly (a silently missing overlay in an unattended export is worse).
    this.ready.catch((error: unknown) => console.error("[miraiclip] html clip:", error));
  }

  private async pump(): Promise<void> {
    while (this.pending && !this.display.destroyed) {
      this.pending = false;
      const key = this.key;
      const clip = this.clip;
      const { widthPx, heightPx, density } = this.inputs;
      const timeS = this.wantTimeS;
      const timing = timeS !== undefined && clip.animated
        ? { timeS, durationS: htmlAnimationTiming(clip, clip.startUs).durationS }
        : undefined;
      let source: HTMLCanvasElement | ImageBitmap;
      this.lastRasterAtMs = Date.now();
      const startedMs = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (typeof document !== "undefined") {
        this.rasterCanvas ??= document.createElement("canvas");
        this.rasterImage ??= new Image();
      }
      try {
        source = await rasterizeHtml({
          ...(this.rasterCanvas ? { target: this.rasterCanvas } : {}),
          ...(this.rasterImage ? { image: this.rasterImage } : {}),
          template: clip.template,
          params: clip.params,
          widthPx,
          heightPx,
          assets: this.assets,
          density,
          ...(timing ?? {}),
        });
      } catch (error) {
        // Unmounted mid-raster (residency): the abort is the teardown itself.
        if (this.display.destroyed) return;
        // Transient failures (a font fetch during a dev-server restart, say)
        // retry from tick on a backoff; whenReady still rejects so exports
        // fail loudly.
        this.failures++;
        this.retryAt = Date.now() + Math.min(5000, 250 * 2 ** (this.failures - 1));
        this.pending = false;
        throw error;
      }
      // `source` is a laundered canvas (DOM) or a pre-rendered ImageBitmap
      // (worker export) — both are physical-size pixel buffers. A result for
      // superseded content is dropped (the loop rasters the current one).
      if (this.key !== key || this.display.destroyed) {
        if (this.key !== key) this.pending = true;
        continue;
      }
      const costMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedMs;
      this.rasterCostMs = this.rasterCostMs > 0 ? this.rasterCostMs * 0.7 + costMs * 0.3 : costMs;
      this.shownTimeS = timeS;
      this.shownSinceS = timeS === undefined ? undefined : this.constantSince(timeS);
      this.shown = true;
      this.failures = 0;
      this.retryAt = 0;
      this.raster =
        typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement
          ? { canvas: source, density }
          : undefined;
      this.contentBounds = undefined;
      if (source === this.rasterCanvas) {
        // Same canvas as last time: re-upload into the existing texture when
        // the size is unchanged, else rebuild it once.
        const reuse =
          this.canvasTexture &&
          this.canvasTexture.width === source.width &&
          this.canvasTexture.height === source.height &&
          this.canvasTexture.source.resolution === density;
        if (reuse) {
          this.canvasTexture!.source.update();
        } else {
          const previous = this.display.texture;
          const textureSource = htmlTextureSource(source, density);
          const texture = new Texture({ source: textureSource });
          this.canvasTexture = { texture, source: textureSource, width: source.width, height: source.height };
          this.display.texture = texture;
          if (previous !== Texture.EMPTY) previous.destroy(true);
        }
      } else {
        // Worker export: pre-rendered/provided bitmaps, one texture each.
        const previous = this.display.texture;
        const textureSource = htmlTextureSource(source, density);
        this.display.texture = new Texture({ source: textureSource });
        if (previous === this.canvasTexture?.texture) this.canvasTexture = undefined;
        if (previous !== Texture.EMPTY) previous.destroy(true);
      }
      this.invalidate();
    }
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  override destroy(): void {
    super.destroy(); // destroys the sprite and its current texture
    this.load.idle(this);
    this.canvasTexture = undefined;
    if (this.rasterCanvas) {
      // Release the backing store now (GC alone can take a while on mobile).
      this.rasterCanvas.width = 0;
      this.rasterCanvas.height = 0;
      this.rasterCanvas = undefined;
    }
    if (this.rasterImage) {
      this.rasterImage.src = ""; // release the last SVG document
      this.rasterImage = undefined;
    }
    this.raster = undefined;
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

/**
 * A texture source over a raster without touching its pixels. CanvasSource
 * computes its pixel size as (canvas.width / resolution) × resolution and
 * RESIZES the canvas when float error makes that differ from the real size
 * (1388 / (2720/1920) × (2720/1920) = 1387.99…) — and resizing a canvas
 * clears it, so at some densities the clip rendered blank. Build it at
 * resolution 1 (pixel size = the canvas size, exactly), then set the
 * density: the resolution setter only rescales the logical size.
 */
export function htmlTextureSource(source: HTMLCanvasElement | ImageBitmap, density: number): TextureSource {
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return new ImageSource({ resource: source, resolution: density });
  }
  const textureSource = new CanvasSource({ resource: source as HTMLCanvasElement, resolution: 1 });
  textureSource.resolution = density;
  return textureSource;
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
 *
 * Decorations (core caption style): outline and drop shadow/glow live on the
 * word style; `activeBackgroundColor` draws a box behind each emphasized
 * word; `display: "word"` stacks every word at the center and shows only the
 * current one; `reveal` hides words until they are spoken.
 */
class PixiCaptionNode extends PixiNode<Container> {
  private readonly wordTexts: Text[] = [];
  private background: Graphics | undefined;
  private activeBoxes: Graphics | undefined;
  private clip: CaptionClip;
  private lastProgress: CaptionProgress = { activeIndex: -2, startedCount: -1 };
  private fontSizePx = 0;
  private blockSize = { widthPx: 0, heightPx: 0 };

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
    this.fontSizePx = fontSizePx;
    const wordStyle = captionWordStyle(style, fontSizePx);

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
      text.text = displayText(words[i]!.text, style.textTransform);
      text.resolution = Math.max(1, this.context.renderScale?.() ?? 1); // sharp under stage upscale
      text.style = { ...wordStyle };
      text.scale.set(1);
      text.visible = true;
    }

    const wordByWord = style.display === "word";
    if (wordByWord) {
      // Every word sits at the block center; only the current one shows.
      for (const text of this.wordTexts) text.position.set(0, 0);
      this.blockSize = { widthPx: 0, heightPx: captionMetrics(style, fontSizePx).lineHeightPx };
    } else {
      // Room for emphasis: a popped word grows by POP_SCALE and an active box
      // pads its word — reserve it so neither collides with its neighbours.
      // (Uniform extra gap, not per-word growth, keeps word spacing even.)
      const popRoom = style.preset === "pop" ? fontSizePx * (POP_SCALE - 1) * 1.6 : 0;
      const boxPad = style.activeBackgroundColor ? fontSizePx * 0.18 * 2 : 0;
      const metrics = captionMetrics(style, fontSizePx);
      const layout = layoutCaption(words, {
        maxWidthPx: comp.width * 0.8,
        ...metrics,
        spaceWidthPx: metrics.spaceWidthPx + Math.max(popRoom, boxPad),
        measure: (i) => this.wordTexts[i]!.width,
      });
      layout.positions.forEach((position, i) => {
        this.wordTexts[i]!.position.set(position.xPx, position.yPx);
      });
      this.blockSize = { widthPx: layout.widthPx, heightPx: layout.heightPx };
    }

    // Graphics layers below the words: block background, then active-word boxes.
    if (style.backgroundColor) {
      this.background ??= (() => {
        const g = new Graphics();
        this.display.addChildAt(g, 0);
        return g;
      })();
      if (!wordByWord) this.drawBackground(this.blockSize.widthPx, this.blockSize.heightPx);
    } else if (this.background) {
      this.background.destroy();
      this.background = undefined;
    }
    if (style.activeBackgroundColor) {
      this.activeBoxes ??= (() => {
        const g = new Graphics();
        this.display.addChildAt(g, this.background ? 1 : 0);
        return g;
      })();
    } else if (this.activeBoxes) {
      this.activeBoxes.destroy();
      this.activeBoxes = undefined;
    }

    // Re-apply emphasis for the current progress against the new texts.
    const progress = this.lastProgress;
    this.lastProgress = { activeIndex: -2, startedCount: -1 };
    this.applyProgress(progress);
    this.invalidate();
  }

  /** Box behind the block (or behind the single word in word-by-word). Padding scales with the font. */
  private drawBackground(widthPx: number, heightPx: number): void {
    const g = this.background;
    const color = this.clip.style.backgroundColor;
    if (!g || !color) return;
    const pad = this.fontSizePx * 0.35;
    g.clear();
    if (widthPx <= 0) return;
    g.roundRect(-widthPx / 2 - pad, -heightPx / 2 - pad * 0.6, widthPx + pad * 2, heightPx + pad * 1.2, this.fontSizePx * 0.2).fill(color);
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
    const display = style.display ?? "block";
    const boxes = this.activeBoxes;
    boxes?.clear();
    let shownWidth = 0;
    for (let i = 0; i < this.wordTexts.length; i++) {
      const appearance = wordAppearance(style.preset, i, progress, display);
      const text = this.wordTexts[i]!;
      text.visible = appearance.visible;
      // With an active box, highlightColor is the text color ON the box.
      text.style.fill = appearance.highlighted ? style.highlightColor : style.color;
      text.scale.set(appearance.scale);
      if (appearance.visible) shownWidth = Math.max(shownWidth, text.width);
      if (boxes && appearance.visible && appearance.highlighted && style.activeBackgroundColor) {
        const padX = this.fontSizePx * 0.18;
        const padY = this.fontSizePx * 0.08;
        const w = text.width + padX * 2;
        const h = this.fontSizePx * 1.15 * appearance.scale + padY * 2;
        boxes
          .roundRect(text.x - w / 2, text.y - h / 2, w, h, this.fontSizePx * 0.16)
          .fill(style.activeBackgroundColor);
      }
    }
    if (display === "word") this.drawBackground(shownWidth, this.blockSize.heightPx);
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
    // ImageBitmap (default) or VideoFrame (frameStorage "videoframe"): both
    // are WebGL texture sources; only their size properties differ.
    const isVideoFrame = typeof VideoFrame !== "undefined" && native instanceof VideoFrame;
    const width = isVideoFrame ? (native as VideoFrame).displayWidth : (native as ImageBitmap).width;
    const height = isVideoFrame ? (native as VideoFrame).displayHeight : (native as ImageBitmap).height;
    if (width !== this.frameWidthPx || height !== this.frameHeightPx) {
      this.frameWidthPx = width;
      this.frameHeightPx = height;
      if (this.placement) this.setPlacement(this.placement);
    }
    if (!this.source || this.source.width !== width || this.source.height !== height) {
      this.texture?.destroy(true);
      this.source = new ImageSource({ resource: native as ImageBitmap, width, height });
      this.texture = new Texture({ source: this.source });
    } else {
      this.source.resource = native as ImageBitmap;
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
  private readonly imageTextures = new ImageTextureCache();
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

  /** Which animated html clips share the raster budget right now. */
  private readonly htmlLoad = new HtmlRasterLoad();

  constructor(
    private readonly app: Application,
    private readonly htmlRaster: HtmlRasterOptions = {},
  ) {
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
    return new PixiImageNode(this.app.stage, asset, this.invalidate, this.effectContext, this.imageTextures);
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
    return new PixiHtmlNode(this.app.stage, clip, assets, this.invalidate, this.effectContext, this.htmlRaster, this.htmlLoad);
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
    this.imageTextures.destroy();
    this.app.destroy(undefined, { children: true });
  }
}

/** Live-preview quality limits for html clips (exports leave these unset: exact, full density). */
export interface HtmlRasterOptions {
  /**
   * Lowest raster density (physical ÷ composition pixels). Default 1: rasters
   * are never smaller than the composition. A live preview smaller than the
   * composition (a phone) can pass e.g. 0.25 to raster at the size actually
   * displayed — ~6× fewer pixels per raster for a 1080p project on a phone.
   */
  minDensity?: number;
  /** Cap animated html re-rasters per clip (preview only; export waits for every frame). */
  maxAnimatedFps?: number;
  /**
   * Share of main-thread time animated html rasters may use, 0..1 (e.g. 0.3).
   * An html raster is a full document build on the main thread (~10–15 ms on
   * a desktop, several times that on a phone), so an unbounded preview spends
   * the whole frame on it and video, audio and input starve. With a budget,
   * every animating clip gets an equal share and lowers its own frame rate to
   * stay inside it — the picture stays exact, just updated less often.
   * Preview only; unset = no limit.
   */
  budget?: number;
  /**
   * Keep the current raster while nothing animates. The template's CSS
   * animations are analysed once (through the browser's own CSS engine) to
   * find when the picture actually changes — fly-ins, then holds; `steps()`
   * counters — and identical frames are not rasterized again. Anything that
   * can't be analysed (markup reading `--t` directly, SMIL) re-rasters every
   * frame as before. Preview only (exports leave it off and raster every frame).
   */
  reuseStaticFrames?: boolean;
}

/**
 * The animated html clips currently re-rasterizing, shared by one backend's
 * nodes so the raster budget is split between them. A clip holding a static
 * frame (or unmounted) leaves the set; a clip not heard from for a second
 * (scrolled out, paused) drops out on its own.
 */
export class HtmlRasterLoad {
  private readonly lastActiveMs = new Map<object, number>();

  active(node: object, nowMs: number): void {
    this.lastActiveMs.set(node, nowMs);
  }

  idle(node: object): void {
    this.lastActiveMs.delete(node);
  }

  activeCount(nowMs: number = Date.now()): number {
    let count = 0;
    for (const [node, at] of this.lastActiveMs) {
      if (nowMs - at > 1000) this.lastActiveMs.delete(node);
      else count++;
    }
    return Math.max(1, count);
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
  /** Html clip raster limits for live preview — see `HtmlRasterOptions`. */
  htmlRaster?: HtmlRasterOptions;
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
  return new PixiSceneBackend(app, options.htmlRaster);
}
