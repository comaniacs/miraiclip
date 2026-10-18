/**
 * A narration script: one line of voiceover per step, each anchored to the
 * timeline moment its step starts. Build it from the project's markers (one
 * line per step) or from a transcript (one line per sentence group), then
 * edit the text freely: anchors stay put.
 */
import { listMarkers, type ProjectDocument } from "@miraiclip/core";
import { transcriptOnTimeline, type TimelineWord, type Transcript } from "@miraiclip/transcript";

export interface ScriptSegment {
  id: string;
  /** What the voice will say. */
  text: string;
  /** Timeline time the line belongs to (its step's start). */
  startUs: number;
  /** What was said in the recording over this step, for context when rewriting. */
  sourceText?: string;
  /** The marker this line came from. */
  markerId?: string;
  /** The step's name (the marker label), for context. */
  label?: string;
}

export interface Script {
  language?: string;
  segments: ScriptSegment[];
}

export interface Command {
  type: string;
  payload: Record<string, unknown>;
}

/** Where the narrated content ends: the end of the last clip on a video track. */
export function contentEndUs(doc: ProjectDocument): number {
  let end = 0;
  for (const c of Object.values(doc.clips)) if (doc.tracks[c.trackId]?.kind === "video") end = Math.max(end, c.startUs + c.durationUs);
  return end;
}

/** Each segment's slot: from its start to the next segment's (the last runs to `endUs`). */
export function segmentSlots(script: Script, endUs: number): { id: string; startUs: number; endUs: number }[] {
  const sorted = [...script.segments].sort((a, b) => a.startUs - b.startUs);
  return sorted.map((s, i) => ({ id: s.id, startUs: s.startUs, endUs: Math.max(s.startUs, sorted[i + 1]?.startUs ?? endUs) }));
}

const said = (words: TimelineWord[], from: number, to: number) =>
  words
    .filter((w) => w.timelineStartUs >= from && w.timelineStartUs < to)
    .map((w) => w.text)
    .join(" ");

export interface ScriptFromMarkersOptions {
  /** Words spoken in the recording, to fill each line (default: the marker label). */
  transcript?: Transcript;
  assetId?: string;
  /** Only markers this returns true for (default: all). */
  filter?: (marker: { id: string; label: string; data?: Record<string, unknown> }) => boolean;
}

/** One line per marker (step), filled with what was said during it, or its label. */
export function scriptFromMarkers(doc: ProjectDocument, options: ScriptFromMarkersOptions = {}): Script {
  const markers = listMarkers(doc).filter((m) => !options.filter || options.filter(m));
  const words = options.transcript ? transcriptOnTimeline(doc, options.transcript, options.assetId ? { assetId: options.assetId } : {}) : [];
  const end = contentEndUs(doc);
  return {
    ...(options.transcript?.language ? { language: options.transcript.language } : {}),
    segments: markers.map((m, i) => {
      const next = markers[i + 1]?.timeUs ?? end;
      // Speech before the first step belongs to it (people talk before their first click).
      const text = said(words, i === 0 ? 0 : m.timeUs, next);
      return { id: `line-${m.id}`, text: text || m.label, startUs: m.timeUs, markerId: m.id, label: m.label, ...(text ? { sourceText: text } : {}) };
    }),
  };
}

export interface ScriptFromTranscriptOptions {
  assetId?: string;
  /** Start a new line after a sentence end once a line is at least this long (default 4 s). */
  minLineUs?: number;
  /** …or at any pause longer than this (default 0.9 s). */
  pauseUs?: number;
}

/** Lines from the recording's own speech: sentences grouped into lines at pauses. */
export function scriptFromTranscript(doc: ProjectDocument, transcript: Transcript, options: ScriptFromTranscriptOptions = {}): Script {
  const words = transcriptOnTimeline(doc, transcript, options.assetId ? { assetId: options.assetId } : {});
  const minLine = options.minLineUs ?? 4_000_000;
  const pause = options.pauseUs ?? 900_000;
  const lines: TimelineWord[][] = [];
  for (const w of words) {
    const line = lines[lines.length - 1];
    const prev = line?.[line.length - 1];
    const breakHere = !line || (prev && (w.timelineStartUs - prev.timelineEndUs > pause || (/[.!?]$/.test(prev.text) && prev.timelineEndUs - line[0]!.timelineStartUs >= minLine)));
    if (breakHere) lines.push([w]);
    else line!.push(w);
  }
  return {
    ...(transcript.language ? { language: transcript.language } : {}),
    segments: lines.map((line, i) => {
      const text = line.map((w) => w.text).join(" ");
      return { id: `line-${i + 1}`, text, sourceText: text, startUs: line[0]!.timelineStartUs };
    }),
  };
}
