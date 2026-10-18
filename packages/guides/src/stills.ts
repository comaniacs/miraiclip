/**
 * Screenshots for a guide: each step's frame rendered by whatever still
 * renderer you have (`createRenderSession().renderStill` on a server,
 * `renderProjectStill` in the browser), with the step's control outlined,
 * the rest dimmed and the step number beside it. The annotation is an html
 * clip added to a throwaway copy of the project, so the renderer needs
 * nothing new and your project is untouched.
 */
import { applyCommands, createProject, type ProjectDocument } from "@miraiclip/core";
import type { Guide, GuideStep } from "./build.js";

/** Render one frame of a document to image bytes (PNG/JPEG/WebP). */
export type StillRenderer = (doc: ProjectDocument, options: { timeUs: number; width?: number; height?: number }) => Promise<Uint8Array | Blob>;

export interface AnnotationStyle {
  /** Outline colour (default "#facc15"). */
  color?: string;
  /** Darken outside the box, 0..1 (default 0.35; 0 turns it off). */
  dim?: number;
  /** Show the step number (default true). */
  number?: boolean;
}

export interface AddStillsOptions {
  /** Save one image and return its `src` (path or URL) as the guide will reference it. */
  store: (image: { data: Uint8Array | Blob; mimeType: string }, step: GuideStep) => Promise<string>;
  /** Output size (default: the project's). */
  width?: number;
  height?: number;
  /** Outline the step's control (default true). */
  annotate?: boolean | AnnotationStyle;
  /** MIME type the renderer produces (default "image/png"). */
  mimeType?: string;
}

/** The overlay markup (full-frame html clip) for one step. */
export function annotationTemplate(): string {
  return `<div style="position:relative;width:100%;height:100%;overflow:hidden;font-family:Inter,system-ui,sans-serif">
<div style="position:absolute;left:{{x}}%;top:{{y}}%;width:{{w}}%;height:{{h}}%;box-sizing:border-box;border:{{stroke}}px solid {{color}};border-radius:{{radius}}px;box-shadow:0 0 0 6000px rgba(0,0,0,{{dim}})"></div>
<div style="position:absolute;left:calc({{x}}% - {{badge}}px * .5);top:calc({{y}}% - {{badge}}px * .5);width:{{badge}}px;height:{{badge}}px;border-radius:50%;background:{{color}};color:#111;display:{{showNumber}};align-items:center;justify-content:center;font-weight:700;font-size:calc({{badge}}px * .55);box-shadow:0 2px 8px rgba(0,0,0,.4)">{{n}}</div>
</div>`;
}

function annotated(doc: ProjectDocument, step: GuideStep, style: AnnotationStyle): ProjectDocument {
  if (!step.highlight) return doc;
  const p = createProject(structuredClone(doc), { historyLimit: 1 });
  const h = step.highlight;
  const unit = Math.min(doc.settings.width, doc.settings.height) / 1080;
  const fps = doc.settings.fps || 30;
  const pct = (v: number) => Math.round(v * 100_000) / 1000;
  const r = applyCommands(p, [
    { type: "track/add", payload: { id: "guide-annotation", kind: "video" } },
    {
      type: "clip/add",
      payload: {
        kind: "html",
        id: "guide-annotation",
        trackId: "guide-annotation",
        startUs: Math.max(0, step.timeUs - Math.round(1e6 / fps)),
        durationUs: Math.round((2 * 1e6) / fps),
        template: annotationTemplate(),
        params: {
          x: pct(h.x),
          y: pct(h.y),
          w: pct(h.width),
          h: pct(h.height),
          stroke: Math.max(2, Math.round(5 * unit)),
          radius: Math.round(12 * unit),
          badge: Math.round(44 * unit),
          color: style.color ?? "#facc15",
          dim: style.dim ?? 0.35,
          showNumber: style.number === false ? "none" : "flex",
          n: step.number,
        },
      },
    },
  ]);
  if (!r.ok) throw new Error(`guide annotation failed: ${JSON.stringify(r.error)}`);
  return p.getState().doc;
}

/** Render, annotate and store a screenshot for every step; returns the guide with `image` set. */
export async function addStills(guide: Guide, doc: ProjectDocument, render: StillRenderer, options: AddStillsOptions): Promise<Guide> {
  const style: AnnotationStyle = typeof options.annotate === "object" ? options.annotate : {};
  const width = options.width ?? doc.settings.width;
  const height = options.height ?? Math.round((width * doc.settings.height) / doc.settings.width);
  const steps: GuideStep[] = [];
  for (const step of guide.steps) {
    const frameDoc = options.annotate === false ? doc : annotated(doc, step, style);
    const data = await render(frameDoc, { timeUs: step.timeUs, width, height });
    const src = await options.store({ data, mimeType: options.mimeType ?? "image/png" }, step);
    steps.push({ ...step, image: { src, width, height, alt: `Step ${step.number}: ${step.title}` } });
  }
  return { ...guide, steps };
}
