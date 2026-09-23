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
import { isHtmlClip, type Asset, type HtmlClip, type HtmlParamValue, type ProjectDocument } from "@miraiclip/core";

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
 */
export async function collectHtmlRasters(
  doc: Pick<ProjectDocument, "clips" | "assets" | "settings">,
): Promise<{ rasters: Record<string, ImageBitmap>; transfer: Transferable[] }> {
  const rasters: Record<string, ImageBitmap> = {};
  const transfer: Transferable[] = [];
  for (const clip of Object.values(doc.clips)) {
    if (!isHtmlClip(clip)) continue;
    const widthPx = clip.widthPx ?? doc.settings.width;
    const heightPx = clip.heightPx ?? doc.settings.height;
    const key = htmlRasterKey(clip, widthPx, heightPx);
    if (key in rasters) continue;
    const canvas = await rasterizeHtml({
      template: clip.template,
      params: clip.params,
      widthPx,
      heightPx,
      assets: doc.assets,
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
  const provided = providedRasters.get(
    JSON.stringify([options.template, options.params, widthPx, heightPx]),
  );
  if (provided) return provided;
  if (typeof document === "undefined") {
    throw new Error(
      "html clips need a DOM to rasterize, and no pre-rendered raster was provided for this clip — " +
        "export with exportProjectInWorker/exportViaWorker (they pre-rasterize on the main thread), " +
        "exportProject on the main thread, or @miraiclip/server-export",
    );
  }
  let markup = substituteParams(options.template, options.params);

  // Inline `asset:<id>` references (images inside the template).
  const assets = options.assets ?? {};
  const assetRefs = [...markup.matchAll(/asset:([\w-]+)/g)].map((m) => m[1]!);
  for (const id of new Set(assetRefs)) {
    const asset = assets[id];
    if (!asset) throw new Error(`html clip references unknown asset "${id}"`);
    markup = markup.replaceAll(`asset:${id}`, await toDataUri(asset.src));
  }

  // Inline font assets whose family the markup references — SVG-as-image
  // documents see no document fonts, so each raster carries its own.
  let fontCss = "";
  for (const asset of Object.values(assets)) {
    if (asset.kind !== "font" || !asset.family) continue;
    if (!markup.includes(asset.family)) continue;
    const uri = await toDataUri(asset.src);
    fontCss += `@font-face{font-family:${JSON.stringify(asset.family)};src:url(${JSON.stringify(uri)})}`;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">` +
    (fontCss ? `<style>${fontCss}</style>` : "") +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${widthPx}px;height:${heightPx}px;overflow:hidden">${markup}</div>` +
    `</foreignObject></svg>`;

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("html clip failed to rasterize (invalid markup?)"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  // The launder: via a 2D canvas the pixels are WebGL-safe (see header).
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("could not create a 2D context for html rasterization");
  context.drawImage(image, 0, 0);
  return canvas;
}

/** The raster inputs that require a re-raster when they change. */
export function htmlRasterKey(
  clip: HtmlClip,
  widthPx: number,
  heightPx: number,
): string {
  return JSON.stringify([clip.template, clip.params, widthPx, heightPx]);
}
