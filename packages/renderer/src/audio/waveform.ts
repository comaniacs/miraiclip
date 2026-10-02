/**
 * Waveform peaks for timeline drawing: one max-abs amplitude (0..1) per
 * bucket of media time, across all channels. Streams the asset through an
 * `AudioTrackSource` chunk by chunk — never holds the decoded file — and is
 * computed once per asset (cache the result; peaks don't depend on clips).
 *
 * Chunks are read as Web Audio `AudioBuffer`-like objects
 * (`numberOfChannels`, `sampleRate`, `getChannelData`).
 */
import type { Us } from "../media/types.js";
import type { AudioChunk, AudioTrackSource } from "./types.js";

export interface WaveformPeaks {
  /** Max |sample| per bucket, 0..1. */
  peaks: Float32Array;
  /** Media time each bucket covers. */
  bucketUs: Us;
  /** Media time the peaks span (`peaks.length * bucketUs`). */
  durationUs: Us;
}

export interface WaveformPeaksOptions {
  /** Media duration (asset `durationUs`). */
  durationUs: Us;
  /** Resolution. Default 50 buckets/second — enough for any zoom a timeline uses. */
  bucketsPerSecond?: number;
  /** Cap on bucket count for very long media. Default 20 000. */
  maxBuckets?: number;
  signal?: AbortSignal;
}

interface PcmLike {
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

function isPcm(native: unknown): native is PcmLike {
  const n = native as Partial<PcmLike> | null;
  return !!n && typeof n.numberOfChannels === "number" && typeof n.sampleRate === "number" && typeof n.getChannelData === "function";
}

/** Fold one decoded chunk into `peaks` (pure; exported for tests and custom decoders). */
export function accumulatePeaks(peaks: Float32Array, bucketUs: Us, chunk: AudioChunk): void {
  if (!isPcm(chunk.native)) return;
  const { numberOfChannels, sampleRate } = chunk.native;
  const usPerSample = 1_000_000 / sampleRate;
  for (let c = 0; c < numberOfChannels; c++) {
    const data = chunk.native.getChannelData(c);
    let bucket = -1;
    let bucketEnd = -1;
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      if (i >= bucketEnd) {
        if (bucket >= 0 && bucket < peaks.length && max > peaks[bucket]!) peaks[bucket] = max;
        bucket = Math.floor((chunk.timestampUs + i * usPerSample) / bucketUs);
        // First sample index belonging to the next bucket.
        bucketEnd = Math.ceil(((bucket + 1) * bucketUs - chunk.timestampUs) / usPerSample);
        max = 0;
      }
      const v = Math.abs(data[i]!);
      if (v > max) max = v;
    }
    if (bucket >= 0 && bucket < peaks.length && max > peaks[bucket]!) peaks[bucket] = max;
  }
}

/** Compute peaks for a whole asset. Resolves with all-zero peaks for silent media. */
export async function computeWaveformPeaks(
  source: AudioTrackSource,
  options: WaveformPeaksOptions,
): Promise<WaveformPeaks> {
  const perSecond = options.bucketsPerSecond ?? 50;
  const maxBuckets = options.maxBuckets ?? 20_000;
  const count = Math.max(1, Math.min(maxBuckets, Math.ceil((options.durationUs / 1_000_000) * perSecond)));
  const bucketUs = options.durationUs / count;
  const peaks = new Float32Array(count);
  for await (const chunk of source.chunksFrom(0)) {
    if (options.signal?.aborted) throw options.signal.reason ?? new Error("aborted");
    if (chunk.timestampUs >= options.durationUs) break;
    accumulatePeaks(peaks, bucketUs, chunk);
  }
  for (let i = 0; i < peaks.length; i++) if (peaks[i]! > 1) peaks[i] = 1;
  return { peaks, bucketUs, durationUs: options.durationUs };
}

/** Downsample peaks to `width` columns (max per column) for drawing a clip's visible range. */
export function peaksForRange(
  waveform: WaveformPeaks,
  fromMediaUs: Us,
  toMediaUs: Us,
  width: number,
): Float32Array {
  const out = new Float32Array(Math.max(0, Math.floor(width)));
  if (!out.length || toMediaUs <= fromMediaUs) return out;
  const span = (toMediaUs - fromMediaUs) / out.length;
  for (let x = 0; x < out.length; x++) {
    const a = Math.floor((fromMediaUs + x * span) / waveform.bucketUs);
    const b = Math.max(a + 1, Math.ceil((fromMediaUs + (x + 1) * span) / waveform.bucketUs));
    let max = 0;
    for (let i = Math.max(0, a); i < Math.min(b, waveform.peaks.length); i++) if (waveform.peaks[i]! > max) max = waveform.peaks[i]!;
    out[x] = max;
  }
  return out;
}
