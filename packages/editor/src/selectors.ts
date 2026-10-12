import type { Clip, ProjectDocument, Transition, Us } from "@miraiclip/core";

/*
 * Derived indexes, cached per document object. The store replaces
 * `doc.clips` / `doc.transitions` only on an edit — never on playhead or
 * selection updates — so during playback (a store update every frame) each
 * lookup is a WeakMap hit instead of a scan over every clip in the project.
 */
const clipsByTrackCache = new WeakMap<object, Map<string, Clip[]>>();
const transitionsByTrackCache = new WeakMap<object, Map<string, Transition[]>>();
const durationCache = new WeakMap<object, Us>();

/** Every track's clips, sorted by start time. Cached per `doc.clips` object. */
export function clipsByTrack(clips: ProjectDocument["clips"]): Map<string, Clip[]> {
  let byTrack = clipsByTrackCache.get(clips);
  if (!byTrack) {
    byTrack = new Map();
    for (const clip of Object.values(clips)) {
      const list = byTrack.get(clip.trackId);
      if (list) list.push(clip);
      else byTrack.set(clip.trackId, [clip]);
    }
    for (const list of byTrack.values()) list.sort((a, b) => a.startUs - b.startUs);
    clipsByTrackCache.set(clips, byTrack);
  }
  return byTrack;
}

/** Every track's transitions. Cached per `doc.transitions` object. */
export function transitionsByTrack(transitions: ProjectDocument["transitions"]): Map<string, Transition[]> {
  let byTrack = transitionsByTrackCache.get(transitions);
  if (!byTrack) {
    byTrack = new Map();
    for (const transition of Object.values(transitions)) {
      const list = byTrack.get(transition.trackId);
      if (list) list.push(transition);
      else byTrack.set(transition.trackId, [transition]);
    }
    transitionsByTrackCache.set(transitions, byTrack);
  }
  return byTrack;
}

/** End of the last clip: the composition's length. Cached per `doc.clips` object. */
export function compositionDurationUs(clips: ProjectDocument["clips"]): Us {
  let end = durationCache.get(clips);
  if (end === undefined) {
    end = 0;
    for (const clip of Object.values(clips)) end = Math.max(end, clip.startUs + clip.durationUs);
    durationCache.set(clips, end);
  }
  return end;
}

/** First index in start-sorted `clips` whose start is at or after `us`. */
export function lowerBound(clips: readonly Clip[], us: Us): number {
  let lo = 0;
  let hi = clips.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (clips[mid]!.startUs < us) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Clips overlapping [fromUs, toUs), from a start-sorted list (one track from
 * `clipsByTrack`). A clip starting before the range can still reach into it,
 * so the search looks back past the longest clip on the list. Use it to mount
 * only the clips a timeline lane shows.
 */
export function clipsInRange(clips: readonly Clip[], fromUs: Us, toUs: Us): Clip[] {
  if (clips.length === 0) return [];
  let longest = 0;
  for (const clip of clips) if (clip.durationUs > longest) longest = clip.durationUs;
  const out: Clip[] = [];
  for (let i = lowerBound(clips, fromUs - longest); i < clips.length; i++) {
    const clip = clips[i]!;
    if (clip.startUs >= toUs) break;
    if (clip.startUs + clip.durationUs > fromUs) out.push(clip);
  }
  return out;
}

/**
 * True when [startUs, endUs) overlaps no clip on the track, except `ignoreClipId`
 * (the clip being moved).
 */
export function isTrackFree(
  doc: ProjectDocument,
  trackId: string,
  startUs: Us,
  endUs: Us,
  ignoreClipId?: string,
): boolean {
  const clips = clipsByTrack(doc.clips).get(trackId) ?? [];
  return !clipsInRange(clips, startUs, endUs).some((clip) => clip.id !== ignoreClipId);
}

/** A cut on one track: `from` ends exactly where `to` starts. */
export interface TrackCut {
  from: Clip;
  to: Clip;
  /** Timeline position of the cut. */
  atUs: Us;
  /** The transition on this cut, if any. */
  transition?: Transition;
}

const CUT_KINDS = new Set(["video", "image", "text", "html"]);

/**
 * The cuts on one track, in time order, from its start-sorted clips (one
 * list from `clipsByTrack`) and its transitions. Only visual clips form
 * cuts, as in core's `findCuts`, which covers the whole project with the
 * transition-length limits.
 */
export function trackCuts(clips: readonly Clip[], transitions: readonly Transition[] = []): TrackCut[] {
  const byPair = new Map<string, Transition>();
  for (const t of transitions) byPair.set(`${t.fromClipId}>${t.toClipId}`, t);
  const visual = clips.filter((c) => CUT_KINDS.has(c.kind));
  const out: TrackCut[] = [];
  for (let i = 0; i + 1 < visual.length; i++) {
    const from = visual[i]!;
    const to = visual[i + 1]!;
    if (from.startUs + from.durationUs !== to.startUs) continue;
    const transition = byPair.get(`${from.id}>${to.id}`);
    out.push(transition ? { from, to, atUs: to.startUs, transition } : { from, to, atUs: to.startUs });
  }
  return out;
}
