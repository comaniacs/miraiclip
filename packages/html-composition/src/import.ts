/**
 * HTML composition → Miraiclip document.
 *
 * The input is a plain HTML page whose root element carries the canvas
 * (`data-composition-id`, `data-width`, `data-height`, `data-duration`) and
 * whose timed elements carry `data-start`, `data-duration` and
 * `data-track-index` (plus `data-media-start` / `data-volume` for media).
 *
 *   <video>  → a video asset + clip (`data-media-start` = trim; `muted` = volume 0)
 *   <audio>  → an audio asset + clip on an audio track (`data-volume`)
 *   <img>    → an image clip (or an html clip when it is styled, to keep its layout)
 *   anything else → an html clip: the element's markup + the page's <style>,
 *                   rasterized at the composition size, so CSS layout carries over
 *
 * Track index 0 is the bottom layer. Scripts aren't run: CSS @keyframes play
 * (the clip is marked animated), script-driven timelines are reported in
 * `warnings`. The result is plain commands' worth of document — editable,
 * undoable and exportable like any other.
 */
import { parse } from "parse5";
import { attr, hasAttr, isElement, toXhtml, walk, type Element, type Node } from "./xml.js";

export interface ImportOptions {
  /** Frame rate of the new document (default: `data-fps` on the root, else 30). */
  fps?: number;
  /**
   * Resolve a media `src` from the page into the asset `src` to store
   * (default: unchanged — relative paths stay relative to the page).
   */
  resolveSrc?: (src: string) => string;
  /** Media durations in µs keyed by src, when known (otherwise `data-duration` or the rest of the composition). */
  mediaDurationsUs?: Record<string, number>;
}

export interface ImportResult {
  /** A `ProjectDocument` (schemaVersion 1) — pass it to `createProject`. */
  doc: ImportedDocument;
  /** What didn't carry over (scripts, nested compositions, unresolved times). */
  warnings: string[];
}

/** The document shape this module produces (structurally a core `ProjectDocument`). */
export interface ImportedDocument {
  schemaVersion: 1;
  settings: { width: number; height: number; fps: number; name?: string };
  assets: Record<string, Record<string, unknown> & { id: string; kind: string; src: string }>;
  tracks: Record<string, { id: string; kind: "video" | "audio"; name: string; muted: boolean; solo: boolean; locked: boolean }>;
  trackOrder: string[];
  clips: Record<string, Record<string, unknown> & { id: string; kind: string; trackId: string; startUs: number; durationUs: number }>;
  transitions: Record<string, never>;
}

const TIMING_ATTRS = new Set(["data-start", "data-duration", "data-track-index", "data-media-start", "data-volume", "class-clip"]);
const S = 1_000_000;
const DEFAULT_TRANSFORM = { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 };

interface Timed {
  el: Element;
  id: string;
  startExpr: string;
  durationS: number | undefined;
  track: number;
  order: number;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "clip";
}

const seconds = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value.trim().replace(/s$/, ""));
  return Number.isFinite(n) ? n : undefined;
};

/** Parse an HTML composition into a Miraiclip document. */
export function importHtmlComposition(html: string, options: ImportOptions = {}): ImportResult {
  const warnings: string[] = [];
  const document = parse(html);
  const all = [...walk(document as unknown as Node)];
  const root = all.find((el) => hasAttr(el, "data-composition-id")) ?? all.find((el) => el.tagName === "body");
  if (!root) throw new Error("no composition root (an element with data-composition-id) found");

  const width = Number(attr(root, "data-width") ?? 1920);
  const height = Number(attr(root, "data-height") ?? 1080);
  if (!(width > 0 && height > 0)) throw new Error("the composition root needs numeric data-width and data-height");
  const fps = options.fps ?? (Number(attr(root, "data-fps")) || 30);
  const compositionDurationS = seconds(attr(root, "data-duration"));
  const name = attr(root, "data-composition-id");

  // Page-wide CSS travels with every html clip, so classes keep working.
  const styles = all.filter((el) => el.tagName === "style").map((el) => toXhtml(el)).join("");
  const animatedCss = /@keyframes/.test(styles);
  const scriptText = (el: Element) => el.childNodes.map((c) => ("value" in c ? String(c.value) : "")).join("");
  if (all.some((el) => el.tagName === "script" && /__timelines|gsap|anime|lottie/i.test(scriptText(el) + (attr(el, "src") ?? "")))) {
    warnings.push("script-driven animation timelines aren't run on import; CSS animations carry over, script timelines don't");
  }
  for (const el of all) {
    if (hasAttr(el, "data-composition-src")) {
      warnings.push(`nested composition "${attr(el, "data-composition-src")}" isn't imported; import it separately and place it as its own clips`);
    }
  }

  // Timed elements: anything below the root with data-start (outermost wins: a
  // timed element inside a timed element belongs to its parent's markup).
  const timed: Timed[] = [];
  const usedIds = new Set<string>();
  const collect = (node: Node, insideTimed: boolean) => {
    for (const child of "childNodes" in node ? node.childNodes : []) {
      if (!isElement(child)) continue;
      const isTimed = child !== root && hasAttr(child, "data-start") && !hasAttr(child, "data-composition-src");
      if (isTimed && !insideTimed) {
        let id = slug(attr(child, "id") ?? child.tagName);
        for (let n = 2; usedIds.has(id); n++) id = `${slug(attr(child, "id") ?? child.tagName)}-${n}`;
        usedIds.add(id);
        timed.push({
          el: child,
          id,
          startExpr: attr(child, "data-start")!,
          durationS: seconds(attr(child, "data-duration")),
          track: Number(attr(child, "data-track-index") ?? 0) || 0,
          order: timed.length,
        });
      }
      collect(child, insideTimed || isTimed);
    }
  };
  collect(root, false);

  // Resolve start times: seconds, or "<id>" / "<id> + 2" / "<id> - 0.5" (relative to that clip's end).
  const byHtmlId = new Map(timed.map((t) => [attr(t.el, "id") ?? "", t] as const));
  const starts = new Map<Timed, number>();
  const durationOf = (t: Timed, startS: number): number => {
    if (t.durationS !== undefined) return t.durationS;
    const src = attr(t.el, "src");
    const known = src !== undefined ? options.mediaDurationsUs?.[src] : undefined;
    if (known !== undefined) return known / S - (seconds(attr(t.el, "data-media-start")) ?? 0);
    if (compositionDurationS !== undefined) return Math.max(0.04, compositionDurationS - startS);
    warnings.push(`"${t.id}" has no data-duration; it was given 5 s`);
    return 5;
  };
  const resolving = new Set<Timed>();
  const startOf = (t: Timed): number => {
    const cached = starts.get(t);
    if (cached !== undefined) return cached;
    const direct = seconds(t.startExpr);
    let value = 0;
    if (direct !== undefined) value = direct;
    else {
      const m = /^\s*([\w-]+)\s*(?:([+-])\s*([\d.]+)\s*s?)?\s*$/.exec(t.startExpr);
      const ref = m ? byHtmlId.get(m[1]!) : undefined;
      if (!m || !ref || resolving.has(ref)) {
        warnings.push(`"${t.id}": couldn't resolve data-start="${t.startExpr}"; placed at 0`);
      } else {
        resolving.add(t);
        const refStart = startOf(ref);
        resolving.delete(t);
        const offset = m[3] ? Number(m[3]) * (m[2] === "-" ? -1 : 1) : 0;
        value = Math.max(0, refStart + durationOf(ref, refStart) + offset);
      }
    }
    starts.set(t, value);
    return value;
  };

  const doc: ImportedDocument = {
    schemaVersion: 1,
    settings: { width, height, fps, ...(name ? { name } : {}) },
    assets: {},
    tracks: {},
    trackOrder: [],
    clips: {},
    transitions: {},
  };
  const resolveSrc = options.resolveSrc ?? ((s: string) => s);
  const assetFor = (kind: "video" | "audio" | "image", src: string): string => {
    const stored = resolveSrc(src);
    const existing = Object.values(doc.assets).find((a) => a.kind === kind && a.src === stored);
    if (existing) return existing.id;
    let id = slug(src.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, "")) || kind;
    for (let n = 2; doc.assets[id]; n++) id = `${slug(src)}-${n}`;
    const asset: ImportedDocument["assets"][string] = { id, kind, src: stored };
    const known = options.mediaDurationsUs?.[src];
    if (known !== undefined && kind !== "image") asset["durationUs"] = Math.round(known);
    doc.assets[id] = asset;
    return id;
  };
  const trackFor = (kind: "video" | "audio", index: number): string => {
    const id = `${kind === "video" ? "v" : "a"}${index}`;
    if (!doc.tracks[id]) doc.tracks[id] = { id, kind, name: `${kind === "video" ? "Track" : "Audio"} ${index}`, muted: false, solo: false, locked: false };
    return id;
  };

  // The root's own look (background, untimed children) is always on screen:
  // it becomes one html clip on a track below everything else.
  const timedSet = new Set(timed.map((t) => t.el));
  const containsTimed = (el: Element): boolean => [...walk(el as unknown as Node)].some((e) => timedSet.has(e));
  const untimed = root.childNodes.filter(
    (c): c is Element => isElement(c) && !timedSet.has(c) && c.tagName !== "style" && c.tagName !== "script" && !containsTimed(c),
  );
  const rootStyle = attr(root, "style");
  const rootClass = attr(root, "class");
  let endS = compositionDurationS ?? 0;
  for (const t of timed) {
    const start = startOf(t);
    endS = Math.max(endS, start + durationOf(t, start));
  }
  if ((rootStyle || rootClass || untimed.length > 0) && endS > 0) {
    const trackId = "background";
    doc.tracks[trackId] = { id: trackId, kind: "video", name: "Background", muted: false, solo: false, locked: false };
    const template = `<div${rootClass ? ` class="${rootClass}"` : ""} style="position:relative;width:${width}px;height:${height}px;overflow:hidden;${(rootStyle ?? "").replace(/"/g, "&quot;")}">${styles}${untimed.map((el) => toXhtml(el, (n) => TIMING_ATTRS.has(n))).join("")}</div>`;
    doc.clips["composition-background"] = {
      id: "composition-background",
      kind: "html",
      trackId,
      startUs: 0,
      durationUs: Math.round(endS * S),
      transform: { ...DEFAULT_TRANSFORM },
      template,
      params: {},
      ...(animatedCss ? { animated: true } : {}),
    };
  }

  const ordered = [...timed].sort((a, b) => a.track - b.track || a.order - b.order);
  for (const t of ordered) {
    const startS = startOf(t);
    const durationS = durationOf(t, startS);
    if (!(durationS > 0)) {
      warnings.push(`"${t.id}" has no length; skipped`);
      continue;
    }
    const base = { id: t.id, startUs: Math.round(startS * S), durationUs: Math.round(durationS * S), transform: { ...DEFAULT_TRANSFORM } };
    const src = attr(t.el, "src");
    const trimUs = Math.round((seconds(attr(t.el, "data-media-start")) ?? 0) * S);
    const volume = seconds(attr(t.el, "data-volume"));
    const styled = hasAttr(t.el, "style") || (attr(t.el, "class") ?? "").split(/\s+/).some((c) => c && c !== "clip");
    if (t.el.tagName === "video" && src) {
      doc.clips[t.id] = {
        ...base,
        kind: "video",
        trackId: trackFor("video", t.track),
        assetId: assetFor("video", src),
        trimStartUs: trimUs,
        // Videos in these compositions are muted; their sound is a separate <audio>.
        volume: hasAttr(t.el, "muted") ? 0 : (volume ?? 1),
      };
      if (styled) warnings.push(`"${t.id}": the video's CSS layout isn't carried over; it is fitted to the frame`);
    } else if (t.el.tagName === "audio" && src) {
      doc.clips[t.id] = { ...base, kind: "audio", trackId: trackFor("audio", t.track), assetId: assetFor("audio", src), trimStartUs: trimUs, volume: volume ?? 1 };
    } else if (t.el.tagName === "img" && src && !styled) {
      doc.clips[t.id] = { ...base, kind: "image", trackId: trackFor("video", t.track), assetId: assetFor("image", src) };
    } else {
      // Everything else keeps its markup and CSS as an html clip. Images inside
      // it become `asset:` references so the raster can draw them.
      const markupFor = (el: Element): string => {
        for (const img of [el, ...walk(el as unknown as Node)].filter((e) => e.tagName === "img")) {
          const s = attr(img, "src");
          if (s && !s.startsWith("data:") && !s.startsWith("asset:")) {
            const id = assetFor("image", s);
            img.attrs = img.attrs.map((a) => (a.name === "src" ? { name: "src", value: `asset:${id}` } : a));
          }
        }
        return toXhtml(el, (n) => TIMING_ATTRS.has(n));
      };
      const markup = markupFor(t.el);
      const template = `<div style="position:relative;width:${width}px;height:${height}px;overflow:hidden">${styles}${markup}</div>`;
      const clip: ImportedDocument["clips"][string] = { ...base, kind: "html", trackId: trackFor("video", t.track), template, params: {} };
      if (animatedCss) clip["animated"] = true;
      doc.clips[t.id] = clip;
    }
  }
  // Bottom-up layer order: visual tracks by index, then audio tracks.
  const ids = Object.keys(doc.tracks);
  const index = (id: string) => Number(id.slice(1));
  doc.trackOrder = [
    ...(doc.tracks["background"] ? ["background"] : []),
    ...ids.filter((id) => id !== "background" && doc.tracks[id]!.kind === "video").sort((a, b) => index(a) - index(b)),
    ...ids.filter((id) => doc.tracks[id]!.kind === "audio").sort((a, b) => index(a) - index(b)),
  ];
  return { doc, warnings };
}
