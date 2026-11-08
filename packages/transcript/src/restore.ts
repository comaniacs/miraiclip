/**
 * Putting cut words back. A ripple cut (`cutCommands`, `removeWords`) leaves
 * the media clip in pieces side by side on its track, each later piece
 * starting further into the file than the one before it ends. `cutWords`
 * reads those cuts back from the timeline (with the transcript words they
 * took out), and `restoreWords` plans the commands that put chosen words back
 * where they were: the piece before them grows (or a new piece is inserted for
 * words in the middle of a cut), later clips on the affected tracks move right,
 * and pieces that meet again in the source are joined. Computed on a scratch
 * copy, so the commands replay as one undo step.
 */
import {
  applyCommands,
  createProject,
  isAudioClip,
  isVideoClip,
  sourceSpanUs,
  type AudioClip,
  type ProjectDocument,
  type VideoClip,
} from "@miraiclip/core";
import type { Command, Transcript } from "./types.js";

type MediaClip = VideoClip | AudioClip;

export interface FindCutsOptions {
  /** The transcribed asset (default `transcript.assetId`). */
  assetId?: string;
  /** Only these clips (and the pieces cuts made of them, `id~n`). Default: every clip of the asset. */
  clipIds?: string[];
}

export interface RestoreOptions extends FindCutsOptions {
  /** Clips cut alongside the media (`CutOptions.linkedClipIds`): they get their own time back too. */
  linkedClipIds?: string[];
  /** Move later clips right to make room (default true, like `cutCommands`). */
  ripple?: boolean;
}

/** One cut, on every track the media plays on. */
export interface Cut {
  /** Timeline time where the cut is (the end of the piece before it). */
  atUs: number;
  /** The source the cut took out: from the end of the piece before to the start of the piece after. */
  sourceStartUs: number;
  sourceEndUs: number;
  /** Transcript words in it (indexes), in order. */
  words: number[];
  /** Timeline time it took out. */
  removedUs: number;
  /** The pieces either side, per track. */
  pieces: { trackId: string; beforeClipId: string; afterClipId: string }[];
}

export interface RestorePlan {
  commands: Command[];
  /** Timeline ranges put back, in the timeline as it is after the restore. */
  restored: { startUs: number; endUs: number }[];
  /** Total timeline time put back, µs. */
  restoredUs: number;
  /** The project after the restore (a copy). */
  doc: ProjectDocument;
}

const speedOf = (c: MediaClip) => c.speed ?? 1;
const sourceEnd = (c: MediaClip) => c.trimStartUs + sourceSpanUs(c);
const baseId = (id: string) => id.split("~")[0]!;

function frameUs(doc: ProjectDocument) {
  return 1_000_000 / (doc.settings.fps || 30);
}

function mediaClips(doc: ProjectDocument, transcript: Transcript, options: FindCutsOptions): MediaClip[] {
  const assetId = options.assetId ?? transcript.assetId;
  if (!options.clipIds && !assetId) throw new Error("cutWords needs assetId (or transcript.assetId) or clipIds");
  const wanted = options.clipIds ? new Set(options.clipIds) : null;
  return Object.values(doc.clips).filter((c): c is MediaClip => {
    if (!(isVideoClip(c) || isAudioClip(c))) return false;
    return wanted ? wanted.has(c.id) || wanted.has(baseId(c.id)) : c.assetId === assetId;
  });
}

/** The cuts on the timeline: pieces side by side whose source skips ahead. Head and tail trims aren't cuts. */
export function cutWords(doc: ProjectDocument, transcript: Transcript, options: FindCutsOptions = {}): Cut[] {
  const frame = frameUs(doc);
  const byTrack = new Map<string, MediaClip[]>();
  for (const c of mediaClips(doc, transcript, options)) {
    const list = byTrack.get(c.trackId) ?? [];
    list.push(c);
    byTrack.set(c.trackId, list);
  }
  const cuts: Cut[] = [];
  for (const [trackId, list] of byTrack) {
    list.sort((a, b) => a.startUs - b.startUs);
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i]!;
      const b = list[i + 1]!;
      const speed = speedOf(a);
      if (speed <= 0 || speedOf(b) !== speed || a.assetId !== b.assetId) continue;
      const atUs = a.startUs + a.durationUs;
      if (Math.abs(b.startUs - atUs) > frame) continue;
      const sourceStartUs = sourceEnd(a);
      const sourceEndUs = b.trimStartUs;
      if (sourceEndUs - sourceStartUs <= frame * speed) continue;
      const same = cuts.find((x) => x.atUs === atUs && x.sourceStartUs === sourceStartUs && x.sourceEndUs === sourceEndUs);
      if (same) {
        same.pieces.push({ trackId, beforeClipId: a.id, afterClipId: b.id });
        continue;
      }
      const words: number[] = [];
      transcript.words.forEach((w, index) => {
        const mid = (w.startUs + w.endUs) / 2;
        if (mid > sourceStartUs && mid < sourceEndUs) words.push(index);
      });
      cuts.push({
        atUs,
        sourceStartUs,
        sourceEndUs,
        words,
        removedUs: Math.round((sourceEndUs - sourceStartUs) / speed),
        pieces: [{ trackId, beforeClipId: a.id, afterClipId: b.id }],
      });
    }
  }
  return cuts.sort((x, y) => x.atUs - y.atUs);
}

/**
 * Commands that put the given transcript words back where they were cut. Words in the middle of a cut come
 * back with the pause before them (cut boundaries between words are mid-pause, as `rangesForWords` cuts them);
 * restoring every word of a cut gives back exactly what it took out. Words that aren't cut are ignored.
 */
export function restoreWords(
  doc: ProjectDocument,
  transcript: Transcript,
  indexes: Iterable<number>,
  options: RestoreOptions = {},
): RestorePlan {
  const wanted = new Set(indexes);
  const scratch = createProject(structuredClone(doc), { historyLimit: 1 });
  const state = () => scratch.getState().doc;
  const commands: Command[] = [];
  const run = (command: Command) => {
    const result = applyCommands(scratch, [command]);
    if (!result.ok) throw new Error(`restore failed at ${command.type}: ${JSON.stringify(result.error)}`);
    commands.push(command);
  };
  let n = 0;
  const freshId = (base: string) => {
    let id: string;
    do id = `${base}~r${++n}`;
    while (state().clips[id]);
    return id;
  };
  const mid = (a: number, b: number) => Math.round((a + b) / 2);
  const restored: { startUs: number; endUs: number }[] = [];

  // One run of words at a time, latest on the timeline first, reading the cuts again after each.
  for (let guard = 0; guard < 10_000; guard++) {
    const cuts = cutWords(state(), transcript, options);
    let next: { cut: Cut; from: number; to: number } | null = null;
    for (const cut of cuts) {
      const pos = cut.words.map((w, i) => (wanted.has(w) ? i : -1)).filter((i) => i >= 0);
      if (!pos.length) continue;
      // The last run of wanted words in this cut.
      let from = pos[pos.length - 1]!;
      const to = from;
      while (from > 0 && wanted.has(cut.words[from - 1]!)) from--;
      if (!next || cut.atUs >= next.cut.atUs) next = { cut, from, to };
    }
    if (!next) break;
    const { cut, from, to } = next;
    const words = transcript.words;
    const first = cut.words[from]!;
    const last = cut.words[to]!;
    const x0 = from === 0 ? cut.sourceStartUs : mid(words[cut.words[from - 1]!]!.endUs, words[first]!.startUs);
    const x1 = to === cut.words.length - 1 ? cut.sourceEndUs : mid(words[last]!.endUs, words[cut.words[to + 1]!]!.startUs);
    const head = state().clips[cut.pieces[0]!.beforeClipId] as MediaClip;
    const speed = speedOf(head);
    const lenUs = Math.round((x1 - x0) / speed);
    const offsetUs = Math.round((x0 - cut.sourceStartUs) / speed); // timeline time from the cut to x0
    for (const w of cut.words.slice(from, to + 1)) wanted.delete(w);
    if (lenUs <= 0) continue;

    // The tracks to make room on: the media's and the linked clips'.
    const linked = (options.linkedClipIds ?? []).flatMap((id) =>
      Object.values(state().clips).filter((c) => c.id === id || baseId(c.id) === id),
    );
    const tracks = new Set([...cut.pieces.map((p) => p.trackId), ...linked.map((c) => c.trackId)]);
    const fills: { clipId: string; srcUs: number | null }[] = cut.pieces.map((p) => ({ clipId: p.beforeClipId, srcUs: x0 }));
    // A linked piece ending at the cut gets the same stretch of its own source back.
    for (const c of linked) {
      if (!(isVideoClip(c) || isAudioClip(c))) continue;
      if (c.startUs + c.durationUs !== cut.atUs || cut.pieces.some((p) => p.beforeClipId === c.id)) continue;
      fills.push({ clipId: c.id, srcUs: sourceEnd(c) + Math.round(offsetUs * speedOf(c)) });
    }

    if (options.ripple !== false) {
      const later = Object.values(state().clips)
        .filter((c) => tracks.has(c.trackId) && c.startUs >= cut.atUs)
        .sort((a, b) => b.startUs - a.startUs);
      for (const c of later) run({ type: "clip/move", payload: { clipId: c.id, startUs: c.startUs + lenUs } });
      for (const m of Object.values(state().markers ?? {})) {
        if (m.timeUs >= cut.atUs) run({ type: "marker/update", payload: { markerId: m.id, timeUs: m.timeUs + lenUs } });
      }
    }
    for (const fill of fills) {
      const clip = state().clips[fill.clipId] as MediaClip;
      if (offsetUs === 0) {
        run({ type: "clip/trim", payload: { clipId: clip.id, durationUs: clip.durationUs + lenUs } });
      } else {
        const id = freshId(baseId(clip.id));
        run({ type: "clip/duplicate", payload: { clipId: clip.id, newClipId: id, startUs: cut.atUs } });
        run({ type: "clip/trim", payload: { clipId: id, trimStartUs: fill.srcUs, durationUs: lenUs } });
      }
    }
    // Ranges put back later on the timeline moved right with everything else.
    for (const r of restored) {
      if (r.startUs >= cut.atUs) {
        r.startUs += lenUs;
        r.endUs += lenUs;
      }
    }
    restored.push({ startUs: cut.atUs, endUs: cut.atUs + lenUs });
    joinPieces(state, run, tracks);
  }

  return {
    commands,
    restored: restored.sort((a, b) => a.startUs - b.startUs),
    restoredUs: restored.reduce((sum, r) => sum + (r.endUs - r.startUs), 0),
    doc: state(),
  };
}

/** Pieces that meet again in the source (side by side, same file, same settings) become one clip. */
function joinPieces(state: () => ProjectDocument, run: (c: Command) => void, tracks: Set<string>) {
  const timing = new Set(["id", "startUs", "durationUs", "trimStartUs"]);
  const sameOtherwise = (a: MediaClip, b: MediaClip) => {
    const strip = (c: MediaClip) => JSON.stringify(Object.entries(c).filter(([k]) => !timing.has(k)).sort(([x], [y]) => (x < y ? -1 : 1)));
    return strip(a) === strip(b);
  };
  for (const trackId of tracks) {
    for (;;) {
      const list = Object.values(state().clips)
        .filter((c): c is MediaClip => c.trackId === trackId && (isVideoClip(c) || isAudioClip(c)))
        .sort((a, b) => a.startUs - b.startUs);
      let joined = false;
      for (let i = 0; i + 1 < list.length; i++) {
        const a = list[i]!;
        const b = list[i + 1]!;
        if (a.startUs + a.durationUs !== b.startUs) continue;
        if (Math.abs(sourceEnd(a) - b.trimStartUs) > 1 || !sameOtherwise(a, b)) continue;
        run({ type: "clip/remove", payload: { clipId: b.id } });
        run({ type: "clip/trim", payload: { clipId: a.id, durationUs: a.durationUs + b.durationUs } });
        joined = true;
        break;
      }
      if (!joined) break;
    }
  }
}
