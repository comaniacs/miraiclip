/**
 * The HTML rasterizer: template + params → pixels, via SVG `foreignObject`.
 *
 * Hard-won mechanics (verified against Chromium; see PLAN.md):
 * - The SVG must load from a `data:` URL. A blob: URL TAINTS the canvas in
 *   Chromium, killing export capture; the identical markup as a data: URL is
 *   clean. `createImageBitmap` of the loaded image also carries a bogus
 *   cross-origin flag — drawing the HTMLImageElement onto a 2D canvas
 *   (the "launder") yields a texture source WebGL accepts.
 * - SVG-as-image is an ISOLATED document: document fonts (`loadFontAssets`)
 *   do not reach it, and external URLs never load. So font assets referenced
 *   by the markup are inlined as @font-face data: URIs, and `asset:<id>`
 *   references inline that asset's bytes the same way.
 *
 * A raster is a pure function of (template, params, size, resources) — the
 * cache makes per-frame cost zero, and a param change costs one ~2ms
 * re-raster. This module is the seam for future backends (the native
 * HTML-in-Canvas API once it ships; a user-supplied deterministic renderer).
 */
import { snapshotScriptedHtml } from "./scripted.js";
import { isHtmlClip, type Asset, type HtmlClip, type HtmlParamValue, type ProjectDocument } from "@miraiclip/core";
import { fontFaceDescriptors } from "../text/typography.js";

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** `{{name}}` → params.name, HTML-escaped (params are data, never markup). */
export function substituteParams(
  template: string,
  params: Record<string, HtmlParamValue>,
): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (whole, key: string) => {
    const value = params[key];
    return value === undefined ? whole : escapeHtml(String(value));
  });
}

/** Fetched resources as data: URIs, cached per source (fonts, inlined assets). */
const resourceCache = new Map<string, Promise<string>>();

const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

async function toDataUri(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  let cached = resourceCache.get(src);
  if (!cached) {
    cached = (async () => {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`html clip resource fetch failed: ${src} (${response.status})`);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(`could not encode ${src}`));
        reader.readAsDataURL(blob);
      });
    })();
    resourceCache.set(src, cached);
    cached.catch(() => resourceCache.delete(src)); // failed fetches retry next raster
  }
  return cached;
}

/**
 * Pre-rendered rasters, keyed by `htmlRasterKey` inputs. This is how html
 * clips cross into worker export (no DOM there): the main thread rasterizes
 * every html clip up front (`collectHtmlRasters`), the bitmaps transfer with
 * the start message, and the worker installs them here — `rasterizeHtml`
 * then serves from this store instead of touching the DOM.
 */
const providedRasters = new Map<string, ImageBitmap>();

/**
 * Where a DOM-less thread gets rasters it wasn't given up front — animated
 * html clips need one raster PER FRAME, far too many to pre-render and
 * transfer, so the export worker installs a source that asks the main
 * thread for each frame's raster on demand (see export.worker.ts).
 */
export type HtmlRasterSource = (request: HtmlRasterRequest) => Promise<ImageBitmap>;

/** A raster request as data (no assets — the main thread has the document). */
export type HtmlRasterRequest = Omit<RasterizeHtmlOptions, "assets">;

let rasterSource: HtmlRasterSource | undefined;

/** Install (or clear, with undefined) the on-demand raster source for DOM-less threads. */
export function setHtmlRasterSource(source: HtmlRasterSource | undefined): void {
  rasterSource = source;
}

/** Install pre-rendered rasters (replaces — and closes — any previous set). */
export function provideHtmlRasters(rasters: Record<string, ImageBitmap>): void {
  for (const bitmap of providedRasters.values()) bitmap.close();
  providedRasters.clear();
  for (const [key, bitmap] of Object.entries(rasters)) providedRasters.set(key, bitmap);
}

/**
 * Rasterize every html clip of `doc` on THIS thread (requires a DOM) into
 * transferable bitmaps for a worker export. Keys match what the worker-side
 * compositor computes, so `rasterizeHtml` there resolves without a DOM.
 * Deduplicated: clips sharing (template, params, size) share one raster.
 * Animated clips are skipped — they change every frame, so the worker asks
 * for each frame's raster on demand instead (`setHtmlRasterSource`).
 */
export async function collectHtmlRasters(
  doc: Pick<ProjectDocument, "clips" | "assets" | "settings">,
  options: {
    /**
     * The export's output size — rasters are generated at output density
     * (output ÷ composition, floor 1), matching what the worker's compositor
     * asks for. Omit for composition-size output.
     */
    outputSize?: { width?: number; height?: number };
  } = {},
): Promise<{ rasters: Record<string, ImageBitmap>; transfer: Transferable[] }> {
  const settings = doc.settings as { width: number; height: number };
  // MUST mirror the backend's renderScale computation exactly — the raster
  // key includes the density, and the worker looks rasters up by key.
  const density = Math.max(
    1,
    (options.outputSize?.width ?? settings.width) / settings.width,
    (options.outputSize?.height ?? settings.height) / settings.height,
  );
  const rasters: Record<string, ImageBitmap> = {};
  const transfer: Transferable[] = [];
  for (const clip of Object.values(doc.clips)) {
    if (!isHtmlClip(clip) || clip.animated) continue;
    const widthPx = clip.widthPx ?? settings.width;
    const heightPx = clip.heightPx ?? settings.height;
    const key = htmlRasterKey(clip, widthPx, heightPx, density);
    if (key in rasters) continue;
    const canvas = await rasterizeHtml({
      template: clip.template,
      params: clip.params,
      widthPx,
      heightPx,
      assets: doc.assets,
      density,
    });
    const bitmap = await createImageBitmap(canvas);
    rasters[key] = bitmap;
    transfer.push(bitmap);
  }
  return { rasters, transfer };
}

export interface RasterizeHtmlOptions {
  template: string;
  params: Record<string, HtmlParamValue>;
  widthPx: number;
  heightPx: number;
  /** Project assets: font assets inline as @font-face; `asset:<id>` references inline as data: URIs. */
  assets?: Readonly<Record<string, Asset>>;
  /**
   * Physical pixels per logical (composition) pixel — raster at this density
   * so upscaled outputs and hi-DPI previews stay sharp. Layout happens at the
   * LOGICAL size (a scale transform supersamples it), so a template renders
   * identically at every density. Default 1.
   */
  density?: number;
  /**
   * Animated templates: seconds into the animation. Every CSS animation is
   * paused and seeked to this time (`animation-delay: calc(var(--d, 0s) -
   * var(--t))`), so the raster is the exact frame at `timeS` — deterministic
   * in preview and export alike. `--t` and `--T` (`durationS`) are set on the
   * template's root. Omit for a static raster (animations untouched).
   */
  timeS?: number;
  /** Animated templates: the animation's total length in seconds (`--T`). */
  durationS?: number;
  /**
   * The template's motion comes from scripts (GSAP, Lottie, WAAPI, …): it runs
   * in a sandboxed frame that is seeked to `timeS` and snapshotted (see
   * html/scripted.ts). Needs a DOM, like every html raster.
   */
  scripted?: boolean;
  /**
   * Raster on the CPU (a `willReadFrequently` 2D canvas) instead of the GPU.
   * Slower — fine at small sizes, too slow for full-size playback — but
   * exact: some GPU rasterizers draw large `filter: blur()` layers under a 3D
   * transform (a sequence camera's tilt) with tile-shaped artifacts. For
   * analysis and previews (motion sampling, filmstrips). Ignores `target`.
   */
  software?: boolean;
  /**
   * Draw into this canvas (resized if needed) instead of a new one. Animated
   * clips re-raster every frame; a fresh full-size canvas per frame was the
   * largest source of preview memory churn. DOM path only.
   */
  target?: HTMLCanvasElement;
  /**
   * Load the SVG through this image element instead of a new one. Changing
   * the `src` of a live element releases the previous SVG document and its
   * resource bytes right away; a fresh `Image()` per raster left each one
   * waiting for garbage collection — hundreds of MB of retained SVG
   * documents (inlined fonts included) within a minute of animated preview.
   * DOM path only; one raster at a time per element.
   */
  image?: HTMLImageElement;
}

/**
 * URL-encoded SVG around the time variables, per static raster input
 * (template, params, size, density, fonts). An animated raster differs from
 * the previous frame only in `--t`, but rebuilding and re-encoding the whole
 * document — fonts inlined as base64, often hundreds of KB — every frame
 * allocated megabytes of strings per second. encodeURIComponent is
 * per-character, so encoding the parts separately is identical to encoding
 * the whole. Small LRU: entries are only reused while a clip is animating.
 */
const encodedShells = new Map<string, { before: string; after: string }>();
const MAX_ENCODED_SHELLS = 32;

/**
 * Every animation paused and seeked: a negative delay of `t` starts it `t`
 * seconds in; `--d` (inherited, so set it on a parent to stagger a group)
 * is the element's own start offset.
 */
const SEEK_CSS =
  "*,*::before,*::after{animation-play-state:paused!important;" +
  "animation-delay:calc(var(--d,0s) - var(--t,0s))!important}";

/** Seconds as a short CSS time (sub-millisecond precision is meaningless here). */
const cssSeconds = (s: number): string => `${Math.round(s * 1e4) / 1e4}s`;

/** The lookup key of one raster — what `htmlRasterKey` returns for a clip. */
function rasterKeyOf(options: Omit<RasterizeHtmlOptions, "assets">): string {
  const base: unknown[] = [options.template, options.params, options.widthPx, options.heightPx, options.density ?? 1];
  if (options.timeS !== undefined) base.push(cssSeconds(options.timeS), cssSeconds(options.durationS ?? 0));
  if (options.scripted) base.push("scripted");
  return JSON.stringify(base);
}

/**
 * Rasterize markup to a WebGL-safe texture source. With a DOM, that is a
 * laundered canvas (see header). Without one (workers), a pre-rendered bitmap
 * installed via `provideHtmlRasters` is served instead — `exportViaWorker`
 * pre-rasterizes on the main thread and transfers the bitmaps — and a miss
 * throws a clear error.
 */
export async function rasterizeHtml(
  options: RasterizeHtmlOptions,
): Promise<HTMLCanvasElement | ImageBitmap> {
  const { widthPx, heightPx } = options;
  const provided = providedRasters.get(rasterKeyOf(options));
  if (provided) return provided;
  if (typeof document === "undefined" && rasterSource) {
    const { assets: _assets, ...request } = options;
    return rasterSource(request);
  }
  if (typeof document === "undefined") {
    throw new Error(
      "html clips need a DOM to rasterize, and no pre-rendered raster was provided for this clip — " +
        "export with exportProjectInWorker/exportViaWorker (they pre-rasterize on the main thread), " +
        "exportProject on the main thread, or @miraiclip/server-export",
    );
  }
  if (options.scripted) {
    // Seek the template's scripts in their frame, then raster the snapshot
    // like any static template (assets and fonts already inlined).
    const snapshot = await snapshotScriptedHtml({
      markup: await scriptedMarkup(options.template, options.params, options.assets ?? {}),
      widthPx,
      heightPx,
      timeS: options.timeS ?? 0,
    });
    const { scripted: _scripted, timeS: _t, durationS: _d, ...rest } = options;
    return rasterizeHtml({ ...rest, template: snapshot, params: {} });
  }
  // Supersampling: the SVG (and canvas) are PHYSICAL size, while the markup
  // lays out at the LOGICAL size inside a scale transform — same layout at
  // every density, just more (or, for a small preview, fewer) pixels per glyph.
  const density = options.density ?? 1;
  const animated = options.timeS !== undefined;
  const physicalW = Math.max(1, Math.round(widthPx * density));
  const physicalH = Math.max(1, Math.round(heightPx * density));
  const shellKey = JSON.stringify([options.template, options.params, widthPx, heightPx, density, animated]);
  let shell = encodedShells.get(shellKey);
  if (shell) {
    encodedShells.delete(shellKey); // LRU: re-insert as most recent
  } else {
    shell = await buildShell(options, physicalW, physicalH, density, animated);
  }
  encodedShells.set(shellKey, shell);
  while (encodedShells.size > MAX_ENCODED_SHELLS) encodedShells.delete(encodedShells.keys().next().value!);
  const timeVars = animated
    ? `;--t:${cssSeconds(options.timeS!)};--T:${cssSeconds(options.durationS ?? 0)}`
    : "";

  const image = options.image ?? new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("html clip failed to rasterize (invalid markup?)"));
    image.src = `data:image/svg+xml;charset=utf-8,${shell.before}${encodeURIComponent(timeVars)}${shell.after}`;
  });

  // The launder: via a 2D canvas the pixels are WebGL-safe (see header).
  const canvas = (options.software ? undefined : options.target) ?? document.createElement("canvas");
  if (canvas.width !== physicalW) canvas.width = physicalW;
  if (canvas.height !== physicalH) canvas.height = physicalH;
  const context = canvas.getContext("2d", options.software ? { willReadFrequently: true } : undefined);
  if (!context) throw new Error("could not create a 2D context for html rasterization");
  context.clearRect(0, 0, physicalW, physicalH);
  context.drawImage(image, 0, 0);
  image.onload = null;
  image.onerror = null;
  // A reused element is released by its next `src`; a one-off one now.
  if (!options.image) image.src = "";
  return canvas;
}

/**
 * The markup a scripted template runs as: params substituted, asset references
 * inlined, the fonts it names embedded. Seeking, snapshotting and measuring
 * the same template must all pass THIS string, so they share one frame.
 */
export async function scriptedMarkup(
  template: string,
  params: Readonly<Record<string, unknown>>,
  assets: Readonly<Record<string, Asset>>,
): Promise<string> {
  const markup = await inlineAssetRefs(substituteParams(template, params as Record<string, string>), assets);
  const fonts = await fontFaceCss(markup, assets);
  return (fonts ? `<style>${fonts}</style>` : "") + markup;
}

/** Inline `asset:<id>` references (images inside the template) as data: URIs. */
async function inlineAssetRefs(markup: string, assets: Readonly<Record<string, Asset>>): Promise<string> {
  const assetRefs = [...markup.matchAll(/asset:([\w-]+)/g)].map((m) => m[1]!);
  for (const id of new Set(assetRefs)) {
    const asset = assets[id];
    if (!asset) throw new Error(`html clip references unknown asset "${id}"`);
    markup = markup.replaceAll(`asset:${id}`, await toDataUri(asset.src));
  }
  return markup;
}

/**
 * @font-face rules for the font assets whose family the markup references —
 * SVG-as-image documents see no document fonts, so each raster carries its own.
 */
async function fontFaceCss(markup: string, assets: Readonly<Record<string, Asset>>): Promise<string> {
  let fontCss = "";
  for (const asset of Object.values(assets)) {
    if (asset.kind !== "font" || !asset.family) continue;
    if (!markup.includes(asset.family)) continue;
    // A font that can't be fetched falls back to the CSS's next family; it
    // never blanks the whole clip.
    let uri: string;
    try {
      uri = await toDataUri(asset.src);
    } catch (err) {
      warnOnce(`font:${asset.src}`, `[miraiclip] html clip: font "${asset.family}" couldn't be loaded, using the fallback font (${(err as Error)?.message ?? err})`);
      continue;
    }
    const d = fontFaceDescriptors(asset);
    const descriptors = (d.weight ? `;font-weight:${d.weight}` : "") + (d.style ? `;font-style:${d.style}` : "");
    fontCss += `@font-face{font-family:${JSON.stringify(asset.family)};src:url(${JSON.stringify(uri)})${descriptors}}`;
  }
  return fontCss;
}

/** The SVG document around the time variables, URL-encoded (see `encodedShells`). */
async function buildShell(
  options: RasterizeHtmlOptions,
  physicalW: number,
  physicalH: number,
  density: number,
  animated: boolean,
): Promise<{ before: string; after: string }> {
  const assets = options.assets ?? {};
  const markup = await inlineAssetRefs(substituteParams(options.template, options.params), assets);
  const fontCss = await fontFaceCss(markup, assets);

  const before =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${physicalW}" height="${physicalH}">` +
    (fontCss || animated ? `<style>${fontCss}${animated ? SEEK_CSS : ""}</style>` : "") +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${physicalW}px;height:${physicalH}px;overflow:hidden">` +
    `<div style="width:${options.widthPx}px;height:${options.heightPx}px;overflow:hidden;transform:scale(${density});transform-origin:0 0`;
  const after = `">${markup}</div></div></foreignObject></svg>`;
  return { before: encodeURIComponent(before), after: encodeURIComponent(after) };
}

/**
 * The raster inputs that require a re-raster when they change. Animated
 * clips pass the frame's `timeS` (and the animation length): one key per
 * frame, matching `rasterizeHtml`'s lookup of provided rasters.
 */
export function htmlRasterKey(
  clip: HtmlClip,
  widthPx: number,
  heightPx: number,
  density = 1,
  timing?: { timeS: number; durationS: number },
): string {
  return rasterKeyOf({
    template: clip.template,
    params: clip.params,
    widthPx,
    heightPx,
    density,
    ...(timing ?? {}),
    ...(clip.scripted ? { scripted: true } : {}),
  });
}

/** Animated clips: the animation time (seconds) at timeline position `timeUs`, and its length. */
export function htmlAnimationTiming(clip: HtmlClip, timeUs: number): { timeS: number; durationS: number } {
  const offsetUs = clip.animationOffsetUs ?? 0;
  const localUs = Math.min(Math.max(timeUs - clip.startUs, 0), clip.durationUs);
  return {
    // Millisecond grid: frame times are exact to well under a millisecond,
    // and it keeps float noise out of raster keys.
    timeS: Math.round((localUs + offsetUs) / 1000) / 1000,
    durationS: Math.round((clip.durationUs + offsetUs) / 1000) / 1000,
  };
}
