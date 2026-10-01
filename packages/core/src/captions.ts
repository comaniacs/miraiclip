/**
 * Caption import — pure text parsing that produces `clip/add` commands, so
 * importing subtitles is just a transaction of ordinary commands (undoable,
 * replayable, and visible to the AI command catalog like everything else).
 *
 * Two sources: SRT/VTT cues (line-level timing; words get an even split as
 * the fallback) and ASR word timestamps (Whisper-shape; real karaoke timing).
 */
import type { BuiltinCommand } from "./commands/schemas.js";
import type { CaptionStyle, CaptionWord, Us } from "./types.js";

export interface CaptionCue {
  startUs: Us;
  endUs: Us;
  text: string;
}

const TIME_SRT = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

function parseTimestampUs(raw: string): Us | undefined {
  const match = TIME_SRT.exec(raw);
  if (!match) return undefined;
  const [, h, m, s, frac] = match;
  const ms = Number(frac!.padEnd(3, "0"));
  return ((Number(h) * 3600 + Number(m!) * 60 + Number(s!)) * 1000 + ms) * 1000;
}

/**
 * Parse SubRip (.srt) or WebVTT (.vtt) text into cues. Tolerant subset:
 * numeric counters, WEBVTT headers, NOTE/STYLE blocks, and cue settings are
 * ignored; HTML-ish tags inside cue text are stripped.
 */
export function parseSubtitles(text: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const timingIndex = lines.findIndex((l) => l.includes("-->"));
    if (timingIndex < 0) continue; // WEBVTT header, NOTE, STYLE, bare counters
    const [rawStart, rawEnd] = lines[timingIndex]!.split("-->");
    const startUs = parseTimestampUs(rawStart ?? "");
    const endUs = parseTimestampUs(rawEnd ?? "");
    if (startUs === undefined || endUs === undefined || endUs <= startUs) continue;
    const cueText = lines
      .slice(timingIndex + 1)
      .join(" ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cueText === "") continue;
    cues.push({ startUs, endUs, text: cueText });
  }
  return cues;
}

/** Fallback word timing: split a cue's span evenly across its words. */
export function wordsFromCue(cue: CaptionCue): CaptionWord[] {
  const tokens = cue.text.split(/\s+/).filter((t) => t !== "");
  const span = cue.endUs - cue.startUs;
  const per = Math.floor(span / Math.max(1, tokens.length));
  return tokens.map((text, i) => ({
    text,
    startUs: i * per,
    durationUs: i === tokens.length - 1 ? span - per * (tokens.length - 1) : per,
  }));
}

/** One ASR word, in seconds — the shape Whisper-style pipelines emit. */
export interface AsrWord {
  text: string;
  startS: number;
  endS: number;
}

export interface CaptionImportOptions {
  trackId: string;
  /** Merged over the default caption style. */
  style?: Partial<CaptionStyle>;
  /** Deterministic clip ids: `${idPrefix}-<n>` (default "caption"). */
  idPrefix?: string;
}

interface CaptionGroup {
  startUs: Us;
  endUs: Us;
  words: CaptionWord[];
}

function toCommands(groups: CaptionGroup[], options: CaptionImportOptions): BuiltinCommand[] {
  const prefix = options.idPrefix ?? "caption";
  return groups.map((group, i) => ({
    type: "clip/add",
    payload: {
      kind: "caption",
      id: `${prefix}-${i + 1}`,
      trackId: options.trackId,
      startUs: group.startUs,
      durationUs: group.endUs - group.startUs,
      words: group.words,
      ...(options.style ? { style: options.style } : {}),
    },
  }));
}

/**
 * SRT/VTT → one caption clip per cue (words evenly split across the cue).
 * Dispatch the result in one transaction.
 */
export function captionClipsFromSubtitles(
  text: string,
  options: CaptionImportOptions,
): BuiltinCommand[] {
  const groups = parseSubtitles(text).map((cue) => ({
    startUs: cue.startUs,
    endUs: cue.endUs,
    words: wordsFromCue(cue),
  }));
  return toCommands(groups, options);
}

export interface AsrGroupingOptions {
  /** Start a new caption clip when the gap between words exceeds this (default 600ms). */
  maxGapUs?: Us;
  /** Maximum words per caption clip (default 8). */
  maxWordsPerGroup?: number;
}

/**
 * ASR word timestamps → caption clips with TRUE word timing (karaoke).
 * Words group into clips on silence gaps and a max-words cap.
 */
export function captionClipsFromAsrWords(
  words: readonly AsrWord[],
  options: CaptionImportOptions & AsrGroupingOptions,
): BuiltinCommand[] {
  const maxGapUs = options.maxGapUs ?? 600_000;
  const maxWords = options.maxWordsPerGroup ?? 8;

  interface RawGroup {
    startUs: Us;
    endUs: Us;
    words: AsrWord[];
  }
  const raw: RawGroup[] = [];
  let current: RawGroup | undefined;

  for (const word of words) {
    const startUs = Math.round(word.startS * 1_000_000);
    const endUs = Math.round(word.endS * 1_000_000);
    if (endUs <= startUs || word.text.trim() === "") continue;
    if (!current || startUs - current.endUs > maxGapUs || current.words.length >= maxWords) {
      current = { startUs, endUs, words: [] };
      raw.push(current);
    }
    current.words.push(word);
    current.endUs = Math.max(current.endUs, endUs);
  }

  const groups: CaptionGroup[] = raw.map((group) => ({
    startUs: group.startUs,
    endUs: group.endUs,
    words: group.words.map((w) => ({
      text: w.text.trim(),
      startUs: Math.round(w.startS * 1_000_000) - group.startUs,
      durationUs: Math.round((w.endS - w.startS) * 1_000_000),
    })),
  }));
  return toCommands(groups, options);
}

// ---------------------------------------------------------------------------
// Export + retiming
// ---------------------------------------------------------------------------

/** The caption-clip fields subtitle export reads (any CaptionClip fits). */
export interface CaptionCueSource {
  startUs: Us;
  durationUs: Us;
  words: readonly CaptionWord[];
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function formatTimestamp(us: Us, separator: "," | "."): string {
  const totalMs = Math.max(0, Math.round(us / 1000));
  const ms = totalMs % 1000;
  const s = Math.floor(totalMs / 1000) % 60;
  const m = Math.floor(totalMs / 60_000) % 60;
  const h = Math.floor(totalMs / 3_600_000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${separator}${pad(ms, 3)}`;
}

function cuesFrom(clips: readonly CaptionCueSource[]): CaptionCue[] {
  return [...clips]
    .sort((a, b) => a.startUs - b.startUs)
    .map((clip) => ({
      startUs: clip.startUs,
      endUs: clip.startUs + clip.durationUs,
      text: clip.words.map((w) => w.text).join(" "),
    }))
    .filter((cue) => cue.text.trim() !== "");
}

/** Caption clips → SubRip (.srt), one cue per clip, in timeline order. */
export function captionsToSrt(clips: readonly CaptionCueSource[]): string {
  return cuesFrom(clips)
    .map((cue, i) => `${i + 1}\n${formatTimestamp(cue.startUs, ",")} --> ${formatTimestamp(cue.endUs, ",")}\n${cue.text}\n`)
    .join("\n");
}

/** Caption clips → WebVTT (.vtt), one cue per clip, in timeline order. */
export function captionsToVtt(clips: readonly CaptionCueSource[]): string {
  const body = cuesFrom(clips)
    .map((cue) => `${formatTimestamp(cue.startUs, ".")} --> ${formatTimestamp(cue.endUs, ".")}\n${cue.text}\n`)
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/** Caption clips → plain transcript text, one line per clip. */
export function captionsToText(clips: readonly CaptionCueSource[]): string {
  return cuesFrom(clips).map((cue) => cue.text).join("\n") + "\n";
}

/**
 * New text for a caption clip, re-timed: when the word count is unchanged
 * each word keeps its original timing (a typo fix keeps karaoke sync);
 * otherwise the words split the clip's span evenly. Returns clip-relative
 * words for `clip/set-property { words }`; empty text returns `[]`.
 */
export function retimeWords(previous: readonly CaptionWord[], text: string, durationUs: Us): CaptionWord[] {
  const tokens = text.split(/\s+/).filter((t) => t !== "");
  if (tokens.length === 0) return [];
  if (tokens.length === previous.length) {
    return previous.map((word, i) => ({ text: tokens[i]!, startUs: word.startUs, durationUs: word.durationUs }));
  }
  return wordsFromCue({ startUs: 0, endUs: durationUs, text: tokens.join(" ") });
}
