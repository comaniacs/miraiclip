/**
 * What to cut: filler words, stutters (a word said twice) and long silences.
 * Pure functions over a transcript; they return source ranges and never
 * touch a project. Feed the ranges to `cutCommands`.
 */
import type { SourceRange, Transcript, TranscriptWord } from "./types.js";

/** The word with punctuation and case removed ("Um," → "um"). */
export const bareWord = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/** Common hesitation sounds. Real words ("like", "so") are left alone: they're often meant. */
export const DEFAULT_FILLERS: Record<string, string[]> = {
  en: ["um", "umm", "uh", "uhh", "uhm", "erm", "er", "ah", "hmm", "mm", "mhm"],
  hi: ["um", "uh", "matlab", "haan", "hmm"],
  es: ["eh", "em", "este", "mmm"],
  fr: ["euh", "heu", "bah", "hum"],
  de: ["äh", "ähm", "öh", "hm"],
};

export interface Span extends SourceRange {
  reason: "filler" | "repeat" | "silence";
  /** Indexes of the transcript words this span removes (none for silences). */
  words: number[];
  text?: string;
}

export interface DetectFillersOptions {
  /** Words to treat as fillers (default: `DEFAULT_FILLERS` for the transcript's language, else English). */
  fillers?: string[];
  /** Multi-word fillers ("you know", "i mean"); off by default. */
  phrases?: string[];
}

/** Filler words and phrases, each widened to swallow the pause around it. */
export function detectFillers(transcript: Transcript, options: DetectFillersOptions = {}): Span[] {
  const lang = (transcript.language ?? "en").slice(0, 2);
  const fillers = new Set((options.fillers ?? DEFAULT_FILLERS[lang] ?? DEFAULT_FILLERS["en"]!).map(bareWord));
  const phrases = (options.phrases ?? []).map((p) => p.split(/\s+/).map(bareWord));
  const words = transcript.words;
  const spans: Span[] = [];
  for (let i = 0; i < words.length; i++) {
    const phrase = phrases.find((p) => p.every((w, k) => words[i + k] && bareWord(words[i + k]!.text) === w));
    const n = phrase ? phrase.length : fillers.has(bareWord(words[i]!.text)) ? 1 : 0;
    if (!n) continue;
    const idx = Array.from({ length: n }, (_, k) => i + k);
    spans.push({ ...wordSpan(words, i, i + n - 1), reason: "filler", words: idx, text: idx.map((k) => words[k]!.text).join(" ") });
    i += n - 1;
  }
  return spans;
}

/** "I I think" → drop the first "I". Only immediate repeats of the same word. */
export function detectRepeats(transcript: Transcript, options: { maxGapUs?: number } = {}): Span[] {
  const maxGap = options.maxGapUs ?? 600_000;
  const words = transcript.words;
  const spans: Span[] = [];
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i]!;
    const b = words[i + 1]!;
    // Only when the first one has no sentence-ending punctuation ("Go. Go!" is meant).
    if (bareWord(a.text) && bareWord(a.text) === bareWord(b.text) && b.startUs - a.endUs <= maxGap && !/[.!?]$/.test(a.text)) {
      spans.push({ startUs: a.startUs, endUs: b.startUs, reason: "repeat", words: [i], text: a.text });
    }
  }
  return spans;
}

export interface DetectSilencesOptions {
  /** Gaps longer than this are silences (default 0.8 s). */
  minGapUs?: number;
  /** Keep this much pause on each side so speech doesn't sound clipped (default 0.2 s). */
  keepUs?: number;
  /** The media's length, to catch a silent tail (optional). */
  mediaDurationUs?: number;
  /** Also trim silence before the first word and after the last (default true). */
  edges?: boolean;
}

/** Pauses between words longer than `minGapUs`, shortened to leave `keepUs` on each side. */
export function detectSilences(transcript: Transcript, options: DetectSilencesOptions = {}): Span[] {
  const minGap = options.minGapUs ?? 800_000;
  const keep = options.keepUs ?? 200_000;
  const words = transcript.words;
  const spans: Span[] = [];
  const push = (startUs: number, endUs: number) => {
    if (endUs - startUs > 0) spans.push({ startUs, endUs, reason: "silence", words: [] });
  };
  if (words.length === 0) return spans;
  if (options.edges !== false && words[0]!.startUs > minGap) push(0, words[0]!.startUs - keep);
  for (let i = 0; i + 1 < words.length; i++) {
    const gap = words[i + 1]!.startUs - words[i]!.endUs;
    if (gap > minGap) push(words[i]!.endUs + keep, words[i + 1]!.startUs - keep);
  }
  const end = options.mediaDurationUs;
  const last = words[words.length - 1]!;
  if (options.edges !== false && end !== undefined && end - last.endUs > minGap) push(last.endUs + keep, end);
  return spans;
}

/**
 * The source range that removing words i..j should cut: the words plus the
 * pause on each side, split at the middle so the neighbours keep their share.
 */
export function wordSpan(words: readonly TranscriptWord[], i: number, j: number): SourceRange {
  const first = words[i]!;
  const last = words[j]!;
  const prev = words[i - 1];
  const next = words[j + 1];
  const startUs = prev ? Math.min(first.startUs, Math.round((prev.endUs + first.startUs) / 2)) : first.startUs;
  const endUs = next ? Math.max(last.endUs, Math.round((last.endUs + next.startUs) / 2)) : last.endUs;
  return { startUs, endUs };
}

/** Sort and merge overlapping or touching ranges (gaps under `joinUs` merge too). */
export function mergeRanges(ranges: readonly SourceRange[], joinUs = 0): SourceRange[] {
  const sorted = [...ranges].filter((r) => r.endUs > r.startUs).sort((a, b) => a.startUs - b.startUs);
  const out: SourceRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.startUs <= last.endUs + joinUs) last.endUs = Math.max(last.endUs, r.endUs);
    else out.push({ startUs: r.startUs, endUs: r.endUs });
  }
  return out;
}

/** The transcript with words inside `ranges` removed (what the edit will say). */
export function withoutRanges(transcript: Transcript, ranges: readonly SourceRange[]): Transcript {
  const merged = mergeRanges(ranges);
  return {
    ...transcript,
    words: transcript.words.filter((w) => !merged.some((r) => w.startUs >= r.startUs && w.endUs <= r.endUs)),
  };
}
