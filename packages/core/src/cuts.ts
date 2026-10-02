/**
 * Cuts: where one clip ends exactly where the next starts on the same video
 * track — the only places `transition/add` accepts. A transition is centered
 * on the cut, so it borrows half its length from footage past the outgoing
 * clip's end and half from before the incoming clip's start ("handles");
 * `maxTransitionUs` is what those handles (and both clips' lengths) allow.
 *
 * Editor panels and AI tools share this, so "every cut" means the same thing
 * everywhere.
 */
import type { Clip, ProjectDocument, Transition, Us } from "./types.js";

export interface Cut {
  trackId: string;
  fromClipId: string;
  toClipId: string;
  /** Timeline position of the cut. */
  atUs: Us;
  /** The transition on this cut, if any. */
  transition?: Transition;
  /** Longest transition the media allows here (0 when a side has no spare footage). */
  maxTransitionUs: Us;
  /** Which side lacks spare footage, when one does. */
  short?: "from" | "to" | "both";
}

const CUT_KINDS = new Set(["video", "image", "text", "html"]);

/** Source footage past a clip's end ("out") or before its start ("in"). Generated clips are unlimited. */
export function clipHeadroomUs(doc: ProjectDocument, clip: Clip, side: "in" | "out"): number {
  if (!("assetId" in clip) || !("trimStartUs" in clip)) return Number.POSITIVE_INFINITY;
  if (side === "in") return clip.trimStartUs;
  const asset = doc.assets[clip.assetId];
  if (!asset || asset.durationUs === undefined) return Number.POSITIVE_INFINITY;
  return Math.max(0, asset.durationUs - (clip.trimStartUs + clip.durationUs));
}

/** Every cut on the project's video tracks, top track first, in time order. */
export function findCuts(doc: ProjectDocument, options: { minTransitionUs?: Us } = {}): Cut[] {
  const min = options.minTransitionUs ?? 1;
  const byBoundary = new Map<string, Transition>();
  for (const t of Object.values(doc.transitions)) byBoundary.set(`${t.fromClipId}>${t.toClipId}`, t);
  const cuts: Cut[] = [];
  for (const trackId of [...doc.trackOrder].reverse()) {
    const track = doc.tracks[trackId];
    if (!track || track.kind !== "video") continue;
    const clips = Object.values(doc.clips)
      .filter((c) => c.trackId === trackId && CUT_KINDS.has(c.kind))
      .sort((a, b) => a.startUs - b.startUs);
    for (let i = 0; i + 1 < clips.length; i++) {
      const from = clips[i]!;
      const to = clips[i + 1]!;
      if (from.startUs + from.durationUs !== to.startUs) continue;
      const out = clipHeadroomUs(doc, from, "out");
      const into = clipHeadroomUs(doc, to, "in");
      const maxTransitionUs = Math.floor(Math.min(2 * out, 2 * into, from.durationUs, to.durationUs));
      const shortFrom = 2 * out < min;
      const shortTo = 2 * into < min;
      const transition = byBoundary.get(`${from.id}>${to.id}`);
      const cut: Cut = { trackId, fromClipId: from.id, toClipId: to.id, atUs: to.startUs, maxTransitionUs };
      if (transition) cut.transition = transition;
      if (shortFrom || shortTo) cut.short = shortFrom && shortTo ? "both" : shortFrom ? "from" : "to";
      cuts.push(cut);
    }
  }
  return cuts;
}
