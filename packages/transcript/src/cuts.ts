/**
 * Ripple cuts: remove ranges of a media file from the timeline and close the
 * gaps. Computed against a scratch copy of the project, so the commands are
 * exactly the splits, removals and moves that produce the result, and they
 * replay as one undo step.
 */
import {
  applyCommands,
  createProject,
  isAudioClip,
  isVideoClip,
  toTimelineUs,
  type AudioClip,
  type ProjectDocument,
  type VideoClip,
} from "@miraiclip/core";
import { mergeRanges } from "./detect.js";
import type { Command, SourceRange } from "./types.js";

export interface CutOptions {
  /**
   * The clips playing the transcribed media (a screen recording with its
   * mic, a talking head). Default: every video and audio clip of `assetId`.
   */
  clipIds?: string[];
  /** The transcribed asset (needed when `clipIds` is omitted). */
  assetId?: string;
  /**
   * Clips that stay in sync with them and are cut at the same timeline
   * moments (a camera recorded alongside the screen). Their own source is
   * not consulted.
   */
  linkedClipIds?: string[];
  /** Close the gaps by moving later clips left on the affected tracks (default true). */
  ripple?: boolean;
  /** Skip removed pieces shorter than this, µs (default 1 frame at the project rate). */
  minCutUs?: number;
}

export interface CutPlan {
  commands: Command[];
  /** Timeline ranges removed, in the timeline as it was before the cut (latest first). */
  removed: { startUs: number; endUs: number }[];
  /** Total timeline time removed, µs. */
  removedUs: number;
  /** The project after the cut (a copy). */
  doc: ProjectDocument;
}

type MediaClip = VideoClip | AudioClip;

function mediaClips(doc: ProjectDocument, options: CutOptions): MediaClip[] {
  const ids = options.clipIds ?? Object.values(doc.clips).filter((c) => (isVideoClip(c) || isAudioClip(c)) && c.assetId === options.assetId).map((c) => c.id);
  if (!options.clipIds && !options.assetId) throw new Error("cutCommands needs clipIds or assetId");
  return ids.map((id) => {
    const clip = doc.clips[id];
    if (!clip || !(isVideoClip(clip) || isAudioClip(clip))) throw new Error(`clip "${id}" is not a video or audio clip`);
    return clip;
  });
}

/** Source ranges → timeline ranges, through every clip that plays them (trims and speed respected). */
export function sourceRangesOnTimeline(doc: ProjectDocument, ranges: readonly SourceRange[], options: CutOptions): { startUs: number; endUs: number }[] {
  const out: { startUs: number; endUs: number }[] = [];
  for (const clip of mediaClips(doc, options)) {
    const end = clip.startUs + clip.durationUs;
    for (const r of mergeRanges(ranges)) {
      const a = toTimelineUs(clip, r.startUs);
      const b = toTimelineUs(clip, r.endUs);
      if (a === undefined || b === undefined) continue;
      const startUs = Math.max(clip.startUs, Math.round(a));
      const endUs = Math.min(end, Math.round(b));
      if (endUs > startUs) out.push({ startUs, endUs });
    }
  }
  return mergeRanges(out);
}

/** Commands that cut `ranges` (source time of the transcribed media) out of the timeline. */
export function cutCommands(doc: ProjectDocument, ranges: readonly SourceRange[], options: CutOptions = {}): CutPlan {
  const fps = doc.settings.fps || 30;
  const minCut = options.minCutUs ?? Math.round(1_000_000 / fps);
  const timeline = sourceRangesOnTimeline(doc, ranges, options).filter((r) => r.endUs - r.startUs >= minCut);
  const scratch = createProject(structuredClone(doc), { historyLimit: 1 });
  const commands: Command[] = [];
  const run = (command: Command) => {
    const result = applyCommands(scratch, [command]);
    if (!result.ok) throw new Error(`cut failed at ${command.type}: ${JSON.stringify(result.error)}`);
    commands.push(command);
  };
  const cutSet = new Set([...mediaClips(doc, options).map((c) => c.id), ...(options.linkedClipIds ?? [])]);
  const tracks = new Set([...cutSet].map((id) => doc.clips[id]?.trackId).filter((t): t is string => !!t));
  let n = 0;
  const freshId = (base: string) => {
    let id: string;
    do id = `${base}~${++n}`;
    while (scratch.getState().doc.clips[id]);
    return id;
  };

  // Latest first, so earlier timeline positions don't move under us.
  const removed = [...timeline].sort((x, y) => y.startUs - x.startUs);
  for (const range of removed) {
    const state = () => scratch.getState().doc;
    // Every clip on an affected track that overlaps the range is cut: the media clips, their linked
    // clips, and the pieces earlier cuts left behind (they carry derived ids).
    const overlapping = Object.values(state().clips).filter(
      (c) => tracks.has(c.trackId) && c.startUs < range.endUs && c.startUs + c.durationUs > range.startUs && (cutSet.has(c.id) || [...cutSet].some((id) => c.id.startsWith(`${id}~`))),
    );
    for (const clip of overlapping) {
      let target = clip.id;
      const end = clip.startUs + clip.durationUs;
      if (range.endUs < end) run({ type: "clip/split", payload: { clipId: target, atUs: range.endUs, newClipId: freshId(clip.id.split("~")[0]!) } });
      if (range.startUs > clip.startUs) {
        const middle = freshId(clip.id.split("~")[0]!);
        run({ type: "clip/split", payload: { clipId: target, atUs: range.startUs, newClipId: middle } });
        target = middle;
      }
      run({ type: "clip/remove", payload: { clipId: target } });
    }
    if (options.ripple !== false) {
      const shift = range.endUs - range.startUs;
      const later = Object.values(state().clips)
        .filter((c) => tracks.has(c.trackId) && c.startUs >= range.endUs)
        .sort((a, b) => a.startUs - b.startUs);
      for (const c of later) run({ type: "clip/move", payload: { clipId: c.id, startUs: c.startUs - shift } });
      // Markers after the cut move with the content; ones inside it land on the cut.
      for (const m of Object.values(state().markers ?? {})) {
        if (m.timeUs >= range.endUs) run({ type: "marker/update", payload: { markerId: m.id, timeUs: m.timeUs - shift } });
        else if (m.timeUs > range.startUs) run({ type: "marker/update", payload: { markerId: m.id, timeUs: range.startUs } });
      }
    }
  }
  return {
    commands,
    removed,
    removedUs: removed.reduce((sum, r) => sum + (r.endUs - r.startUs), 0),
    doc: scratch.getState().doc,
  };
}
