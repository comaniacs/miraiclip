/**
 * A word-level transcript of one media file. Times are in the media's own
 * (source) time, so the transcript stays valid however the clips that use
 * the file are trimmed, cut, moved or sped up: map through the clips when
 * you need timeline times (`transcriptOnTimeline`).
 */

export interface TranscriptWord {
  /** The word as spoken, with attached punctuation ("Hello,"). */
  text: string;
  /** Source time, µs from the start of the media file. */
  startUs: number;
  endUs: number;
  /** 0..1 when the recognizer reports it. */
  confidence?: number;
  /** Speaker label when diarization is on ("0", "1", "A"…). */
  speaker?: string;
}

export interface Transcript {
  /** BCP-47 / ISO 639-1 language, when known. */
  language?: string;
  /** The asset these words belong to (optional; functions also take it explicitly). */
  assetId?: string;
  words: TranscriptWord[];
}

/** A span of source time, µs. */
export interface SourceRange {
  startUs: number;
  endUs: number;
}

export interface Command {
  type: string;
  payload: Record<string, unknown>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
