/**
 * Text-based editing and transcript-aware views of the timeline: edit the
 * words, get the cuts; and see (or caption) what the edited timeline
 * actually says.
 */
import { captionClipsFromAsrWords, isAudioClip, isVideoClip, toTimelineUs, type ProjectDocument } from "@miraiclip/core";
import { cutCommands, type CutOptions, type CutPlan } from "./cuts.js";
import { bareWord, detectFillers, detectRepeats, detectSilences, mergeRanges, wordSpan, type DetectFillersOptions, type DetectSilencesOptions, type Span } from "./detect.js";
import type { Command, SourceRange, Transcript, TranscriptWord } from "./types.js";

/** The transcript as plain text (words joined with spaces). */
export function transcriptText(transcript: Transcript): string {
  return transcript.words.map((w) => w.text).join(" ");
}

/** Source ranges that removing these word indexes cuts (adjacent words merge into one cut). */
export function rangesForWords(transcript: Transcript, indexes: Iterable<number>): SourceRange[] {
  const sorted = [...new Set(indexes)].filter((i) => i >= 0 && i < transcript.words.length).sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const i of sorted) {
    const last = runs[runs.length - 1];
    if (last && i === last[1] + 1) last[1] = i;
    else runs.push([i, i]);
  }
  return mergeRanges(runs.map(([a, b]) => wordSpan(transcript.words, a, b)));
}

/**
 * Which words were deleted, comparing the transcript with an edited copy of
 * its text. Only deletions count (a typo fix is not a cut): words are
 * matched by their bare form with a longest-common-subsequence diff.
 */
export function deletedWords(transcript: Transcript, editedText: string): number[] {
  const a = transcript.words.map((w) => bareWord(w.text));
  const b = editedText.split(/\s+/).map(bareWord).filter(Boolean);
  const n = a.length;
  const m = b.length;
  // LCS table, row by row from the end (n×m small enough for a recording's worth of words).
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  }
  const deleted: number[] = [];
  let i = 0;
  let j = 0;
  // Prefer deleting the earlier of two equal words ("the the" → drop the first), like stutter removal.
  while (i < n) {
    if (dp[i + 1]![j]! === dp[i]![j]!) deleted.push(i++);
    else if (a[i] === b[j]) {
      i++;
      j++;
    } else j++;
  }
  return deleted;
}

/** Edit the text, get the cut: words missing from `editedText` are cut from the timeline. */
export function editByText(doc: ProjectDocument, transcript: Transcript, editedText: string, options: CutOptions = {}): CutPlan & { deleted: number[] } {
  const deleted = deletedWords(transcript, editedText);
  return { ...cutCommands(doc, rangesForWords(transcript, deleted), withAsset(transcript, options)), deleted };
}

/** Cut these words (by index) from the timeline. */
export function removeWords(doc: ProjectDocument, transcript: Transcript, indexes: Iterable<number>, options: CutOptions = {}): CutPlan {
  return cutCommands(doc, rangesForWords(transcript, indexes), withAsset(transcript, options));
}

const withAsset = (transcript: Transcript, options: CutOptions): CutOptions =>
  options.clipIds || options.assetId ? options : transcript.assetId ? { ...options, assetId: transcript.assetId } : options;

export interface CleanupOptions extends CutOptions {
  /** Remove filler words (default true; options or false). */
  fillers?: boolean | DetectFillersOptions;
  /** Remove stutters (default true). */
  repeats?: boolean;
  /** Shorten long pauses (default true; options or false). */
  silences?: boolean | DetectSilencesOptions;
}

/** Fillers, stutters and long pauses → one ripple cut. `spans` says what was removed and why (for review UIs). */
export function planCleanup(doc: ProjectDocument, transcript: Transcript, options: CleanupOptions = {}): CutPlan & { spans: Span[] } {
  const spans: Span[] = [];
  if (options.fillers !== false) spans.push(...detectFillers(transcript, typeof options.fillers === "object" ? options.fillers : {}));
  if (options.repeats !== false) spans.push(...detectRepeats(transcript));
  if (options.silences !== false) {
    const asset = transcript.assetId ?? options.assetId;
    const mediaDurationUs = asset ? doc.assets[asset]?.durationUs : undefined;
    spans.push(...detectSilences(transcript, { ...(mediaDurationUs ? { mediaDurationUs } : {}), ...(typeof options.silences === "object" ? options.silences : {}) }));
  }
  spans.sort((a, b) => a.startUs - b.startUs);
  return { ...cutCommands(doc, spans, withAsset(transcript, options)), spans };
}

export interface TimelineWord extends TranscriptWord {
  /** Index in the transcript. */
  index: number;
  /** The clip it plays in. */
  clipId: string;
  /** Timeline times. */
  timelineStartUs: number;
  timelineEndUs: number;
}

/**
 * The words the timeline plays, in timeline order: each transcript word
 * mapped through every clip of the asset that shows it whole. Words cut away
 * are absent; a word played twice (a duplicated clip) appears twice.
 */
export function transcriptOnTimeline(doc: ProjectDocument, transcript: Transcript, options: { assetId?: string; clipIds?: string[] } = {}): TimelineWord[] {
  const assetId = options.assetId ?? transcript.assetId;
  const clips = Object.values(doc.clips).filter(
    (c): c is Extract<typeof c, { assetId: string }> =>
      (isVideoClip(c) || isAudioClip(c)) && (options.clipIds ? options.clipIds.includes(c.id) : c.assetId === assetId),
  );
  if (!clips.length) throw new Error(assetId ? `no clips play asset "${assetId}"` : "transcriptOnTimeline needs assetId or clipIds");
  const out: TimelineWord[] = [];
  for (const clip of clips) {
    if (!(isVideoClip(clip) || isAudioClip(clip))) continue;
    const end = clip.startUs + clip.durationUs;
    transcript.words.forEach((w, index) => {
      const a = toTimelineUs(clip, w.startUs);
      const b = toTimelineUs(clip, w.endUs);
      if (a === undefined || b === undefined) return;
      // A word counts when most of it plays in this clip.
      const visible = Math.min(b, end) - Math.max(a, clip.startUs);
      if (visible < (b - a) * 0.5) return;
      out.push({ ...w, index, clipId: clip.id, timelineStartUs: Math.round(Math.max(a, clip.startUs)), timelineEndUs: Math.round(Math.min(b, end)) });
    });
  }
  return out.sort((x, y) => x.timelineStartUs - y.timelineStartUs);
}

export interface TranscriptCaptionOptions {
  trackId: string;
  /** Add the track first (default: when it doesn't exist). */
  createTrack?: boolean;
  assetId?: string;
  clipIds?: string[];
  /** Caption style (merged over the default), e.g. from a registry caption-style block. */
  style?: Record<string, unknown>;
  idPrefix?: string;
  maxWordsPerGroup?: number;
  maxGapUs?: number;
}

/** Karaoke captions for what the timeline says now (after cuts), with true word timing. */
export function captionCommands(doc: ProjectDocument, transcript: Transcript, options: TranscriptCaptionOptions): Command[] {
  const words = transcriptOnTimeline(doc, transcript, options);
  const commands: Command[] = [];
  if (options.createTrack ?? !doc.tracks[options.trackId]) commands.push({ type: "track/add", payload: { id: options.trackId, kind: "video", name: "Captions" } });
  // Words from different clips never share a caption, so a caption never spans a cut.
  const groups: TimelineWord[][] = [];
  for (const w of words) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1]!.clipId === w.clipId) last.push(w);
    else groups.push([w]);
  }
  let n = 0;
  for (const group of groups) {
    const made = captionClipsFromAsrWords(
      group.map((w) => ({ text: w.text, startS: w.timelineStartUs / 1e6, endS: w.timelineEndUs / 1e6 })),
      {
        trackId: options.trackId,
        idPrefix: `${options.idPrefix ?? "caption"}-${++n}`,
        ...(options.style ? { style: options.style as never } : {}),
        ...(options.maxWordsPerGroup ? { maxWordsPerGroup: options.maxWordsPerGroup } : {}),
        ...(options.maxGapUs ? { maxGapUs: options.maxGapUs } : {}),
      },
    );
    commands.push(...(made as Command[]));
  }
  return commands;
}
