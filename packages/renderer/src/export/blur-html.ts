/**
 * The DOM-bound half of motion-blur planning: asking a scripted sequence
 * where its hard cuts are and how far its contents move. Needs a document, so
 * worker exports run it on the main thread (`exportViaWorker`) and ship the
 * cut list across.
 */
import { isHtmlClip, type HtmlClip, type ProjectDocument } from "@miraiclip/core";
import type { Us } from "../media/types.js";
import { htmlAnimationTiming, scriptedMarkup } from "../html/rasterize.js";
import { motionScriptedHtml, snapshotScriptedHtml } from "../html/scripted.js";
import { cutsFromSnapshot } from "./blur-plan.js";

const sizeOf = (doc: ProjectDocument, clip: HtmlClip): { widthPx: number; heightPx: number } => ({
  widthPx: clip.widthPx ?? doc.settings.width,
  heightPx: clip.heightPx ?? doc.settings.height,
});

/** Every `tl.cut` of every scripted sequence, as timeline µs. */
export async function collectSequenceCuts(doc: ProjectDocument): Promise<Us[]> {
  if (typeof document === "undefined") return [];
  const cuts: Us[] = [];
  for (const clip of Object.values(doc.clips)) {
    if (!isHtmlClip(clip) || !clip.scripted) continue;
    const markup = await scriptedMarkup(clip.template, clip.params, doc.assets);
    const snapshot = await snapshotScriptedHtml({ markup, ...sizeOf(doc, clip), timeS: htmlAnimationTiming(clip, clip.startUs).timeS });
    cuts.push(...cutsFromSnapshot(snapshot, clip));
  }
  return cuts.sort((a, b) => a - b);
}

/** A measurer for `createBlurPlanner`: how far a scripted clip's contents move between two timeline instants. */
export function createHtmlMotionMeasurer(doc: ProjectDocument): ((clip: HtmlClip, fromUs: Us, toUs: Us) => Promise<number | null>) | undefined {
  if (typeof document === "undefined") return undefined;
  const markups = new Map<string, Promise<string>>();
  return async (clip, fromUs, toUs) => {
    // Only the stage kit can measure; other runtimes (and CSS-animated clips) report null.
    if (!clip.scripted) return null;
    let markup = markups.get(clip.id);
    if (!markup) markups.set(clip.id, (markup = scriptedMarkup(clip.template, clip.params, doc.assets)));
    return motionScriptedHtml({
      markup: await markup,
      ...sizeOf(doc, clip),
      fromS: htmlAnimationTiming(clip, fromUs).timeS,
      toS: htmlAnimationTiming(clip, toUs).timeS,
    });
  };
}
