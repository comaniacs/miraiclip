import type { Us } from "../media/types.js";

/**
 * Where exported media goes: one video frame at a time (the sink captures the
 * canvas it was constructed around), plus the mixed audio. The production
 * implementation wraps mediabunny's `Output`; tests use a fake.
 */
export interface ExportSink {
  /**
   * Capture the canvas's CURRENT content as the frame at `timestampUs`.
   * CONTRACT: the capture must happen SYNCHRONOUSLY during this call (before
   * the promise is returned), so the caller may repaint the canvas for the
   * next frame immediately. The returned promise is encode/mux backpressure
   * only — the export loop keeps a small bounded window of them in flight
   * (encoder works on frames n-3…n-1 while frame n renders) and awaits the
   * oldest when the window is full, which bounds memory.
   */
  addVideoFrame(timestampUs: Us, durationUs: Us): Promise<void>;
  /** Append mixed audio (an `AudioBuffer` in the browser). Optional per sink. */
  addAudio?(buffer: unknown): Promise<void>;
  /** Finish the container and return the encoded file bytes. */
  finalize(): Promise<Uint8Array>;
  /** Abort: discard everything, release encoders. Safe to call once, any time. */
  cancel(): Promise<void>;
}

export interface ExportProgress {
  phase: "audio" | "video" | "finalizing";
  framesDone: number;
  totalFrames: number;
  /** During the audio phase: timeline µs mixed so far, out of the range total. */
  audioMixedUs?: Us;
  audioTotalUs?: Us;
}

/** Passed to the audio mixer so a long mix is abortable and reports progress. */
export interface MixAudioContext {
  signal?: AbortSignal;
  onProgress?: (mixedUs: Us) => void;
}

export interface ExportRange {
  startUs: Us;
  endUs: Us;
}

export class ExportAbortedError extends Error {
  constructor() {
    super("export aborted");
    this.name = "ExportAbortedError";
  }
}
