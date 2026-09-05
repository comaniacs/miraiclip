import type { Us } from "../media/types.js";

/** A decoded chunk of audio on the media's own timeline. */
export interface AudioChunk {
  readonly timestampUs: Us;
  readonly durationUs: Us;
  /** The underlying buffer (a Web Audio `AudioBuffer` in the browser). */
  readonly native: unknown;
}

/**
 * Streaming source of decoded audio for one asset. Audio is pulled in chunks
 * around the playhead — a long file is never decoded whole (an hour of PCM is
 * gigabytes). The real implementation wraps mediabunny's AudioBufferSink.
 */
export interface AudioTrackSource {
  /** Yield chunks in order starting at or before `startUs`. */
  chunksFrom(startUs: Us): AsyncGenerator<AudioChunk, void, undefined>;
  dispose(): void;
}

/** Resolves to null when the asset has no audio track. */
export type AudioSourceFactory = (
  assetId: string,
  src: unknown,
) => Promise<AudioTrackSource | null>;

/** One mixable output lane (per clip): gain + scheduled buffers. */
export interface AudioChannel {
  /**
   * Play `native` starting at absolute output time `whenUs`, skipping
   * `offsetUs` into the buffer, playing at most `durationUs` of it, at
   * `rate` speed.
   */
  schedule(native: unknown, whenUs: Us, offsetUs: Us, durationUs: Us, rate: number): void;
  setGain(value: number): void;
  /** Stop everything scheduled on this channel. */
  stopAll(): void;
  close(): void;
}

/**
 * Audio output abstraction (a WebAudio AudioContext in the browser; a fake in
 * tests). Its clock is the master playback clock.
 */
export interface AudioOutput {
  /** The output's own clock — monotonic, drift-free vs what it plays. */
  readonly currentTimeUs: Us;
  channel(id: string): AudioChannel;
  /** Unlock/resume the output (autoplay policies). Safe to call repeatedly. */
  resume(): Promise<void>;
  close(): void;
}
