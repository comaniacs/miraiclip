/**
 * Per-frame planning for shutter motion blur: what to sample, how often, and
 * where a hard cut forbids blending. Pure of GPU and DOM except through the
 * injected `htmlMotion` measurer, so the rules are testable with fakes.
 */
import { isHtmlClip, type HtmlClip, type ProjectDocument } from "@miraiclip/core";
import type { Compositor } from "../compositor/compositor.js";
import type { Us } from "../media/types.js";
import { clipTimesToCuts, sampleCountFor, shutterSampleTimes, shutterUs, type ResolvedMotionBlur } from "./motion-blur.js";

/**
 * The instants where the picture changes abruptly: every clip start and end
 * on a visible track, except the two sides of a transition's cut (a
 * transition is the author blending there on purpose). A sub-sample on the
 * far side of one of these is dropped, so a cut stays a cut.
 */
export function documentHardCuts(doc: ProjectDocument): Us[] {
  const inTransition = new Set<string>();
  for (const t of Object.values(doc.transitions)) {
    inTransition.add(`${t.fromClipId}:end`);
    inTransition.add(`${t.toClipId}:start`);
  }
  const cuts = new Set<Us>();
  for (const clip of Object.values(doc.clips)) {
    if (doc.tracks[clip.trackId]?.hidden) continue;
    if (!inTransition.has(`${clip.id}:start`)) cuts.add(clip.startUs);
    if (!inTransition.has(`${clip.id}:end`)) cuts.add(clip.startUs + clip.durationUs);
  }
  return [...cuts].sort((a, b) => a - b);
}

/** `tl.cut(...)` times written by sequences, as timeline microseconds, from each clip's snapshot attribute. */
export function cutsFromSnapshot(snapshot: string, clip: Pick<HtmlClip, "startUs" | "animationOffsetUs">): Us[] {
  const match = /data-stage-cuts="([^"]*)"/.exec(snapshot);
  if (!match) return [];
  try {
    const seconds = JSON.parse(match[1]!.replace(/&quot;/g, '"')) as unknown;
    if (!Array.isArray(seconds)) return [];
    return seconds
      .filter((s): s is number => typeof s === "number" && Number.isFinite(s))
      .map((s) => clip.startUs + Math.round(s * 1_000_000) - (clip.animationOffsetUs ?? 0));
  } catch {
    return [];
  }
}

export interface BlurPlannerInit {
  options: ResolvedMotionBlur;
  doc: ProjectDocument;
  compositor: Pick<Compositor, "motionPxBetween">;
  range: { startUs: Us; endUs: Us };
  /** Output pixels per composition pixel (an export at half size blurs half as far in pixels). */
  outputScale: number;
  /** Hard cuts beyond the document's clip bounds (sequence `tl.cut`s). */
  extraCutsUs?: readonly Us[];
  /**
   * Distance (composition px) that things INSIDE an html clip move between two
   * timeline instants; null when its runtime can't say. Omit when no DOM is
   * available — scripted clips then count as moving by `unknownMotionPx`.
   */
  htmlMotion?: (clip: HtmlClip, fromUs: Us, toUs: Us) => Promise<number | null>;
}

/** What a clip whose motion can't be measured is assumed to travel across one shutter, in gaps. */
const UNKNOWN_MOTION_GAPS = 8;

export function createBlurPlanner(init: BlurPlannerInit): (frame: { startUs: Us; endUs: Us; sampleUs: Us }) => Promise<Us[]> {
  const { options, doc, compositor, range, outputScale } = init;
  const cuts = [...documentHardCuts(doc), ...(init.extraCutsUs ?? [])].sort((a, b) => a - b);
  const htmlClips = Object.values(doc.clips).filter((c): c is HtmlClip => isHtmlClip(c) && (c.scripted === true || c.animated === true) && !doc.tracks[c.trackId]?.hidden);
  const last = range.endUs - 1;
  const clamp = (t: Us): Us => Math.min(Math.max(t, range.startUs), last);

  return async ({ startUs, endUs, sampleUs }) => {
    const open = shutterUs(endUs - startUs, options.shutterAngle);
    if (open <= 0) return [sampleUs];
    const from = clamp(sampleUs - Math.floor(open / 2));
    const to = clamp(sampleUs + Math.ceil(open / 2));
    if (to <= from) return [sampleUs];

    let motionPx = compositor.motionPxBetween(from, to) * outputScale;
    for (const clip of htmlClips) {
      if (clip.startUs > to || clip.startUs + clip.durationUs <= from) continue;
      const measured = init.htmlMotion ? await init.htmlMotion(clip, from, to) : null;
      motionPx = Math.max(motionPx, measured === null ? options.gapPx * UNKNOWN_MOTION_GAPS : measured * outputScale);
    }
    const count = sampleCountFor(motionPx, options);
    if (count <= 1) return [sampleUs];
    const times = shutterSampleTimes(sampleUs, open, count).map(clamp);
    const unique = times.filter((t, i) => i === 0 || t > times[i - 1]!);
    return clipTimesToCuts(unique, sampleUs, cuts.filter((c) => c > from && c <= to));
  };
}
