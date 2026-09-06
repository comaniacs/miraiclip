import type { Us } from "../media/types.js";
import {
  ExportAbortedError,
  type ExportProgress,
  type ExportSink,
  type MixAudioContext,
} from "./types.js";

export interface ExportCompositionOptions {
  /** Composition range to export. `endUs` must be greater than `startUs`. */
  startUs: Us;
  endUs: Us;
  /** Output frame rate. */
  fps: number;
  /**
   * Render the composition at a timeline position into the sink's canvas —
   * awaits exact decode (`videos.renderFrameAt` in production).
   */
  renderFrame: (timeUs: Us) => Promise<void>;
  sink: ExportSink;
  /**
   * Produce the mixed audio for the range (OfflineAudioContext in production).
   * Return null for a silent/audio-less composition — no audio track is added.
   * Receives the abort signal and a progress callback: mixing a long timeline
   * decodes its full audio and can take minutes — it must be interruptible
   * and visible.
   */
  mixAudio?: (context: MixAudioContext) => Promise<unknown | null>;
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
  /**
   * How many encoder submissions may be in flight while the next frame
   * renders (default 4). 1 = fully serial. The window is what lets decode,
   * compositing, and encoding overlap instead of hand-off lockstep.
   */
  encodeAheadFrames?: number;
}

/**
 * The export orchestrator: a deterministic frame walk over the composition.
 * Time never moves backwards, so the streaming decode pipeline performs zero
 * re-seeks; every frame awaits the sink, so encoder/muxer backpressure bounds
 * memory and the export runs as fast as decode+encode allow — no realtime
 * clock anywhere. Cancellation is checked between frames and the sink is
 * always cancelled exactly once on any failure path.
 */
export async function exportComposition(
  options: ExportCompositionOptions,
): Promise<Uint8Array> {
  const { startUs, endUs, fps, renderFrame, sink, mixAudio, signal, onProgress } =
    options;
  if (!(endUs > startUs)) throw new Error("export range is empty");
  if (!(fps > 0)) throw new Error(`invalid fps: ${fps}`);

  const durationUs = endUs - startUs;
  const totalFrames = Math.max(1, Math.ceil((durationUs * fps) / 1_000_000));
  const progress = (phase: ExportProgress["phase"], framesDone: number): void => {
    onProgress?.({ phase, framesDone, totalFrames });
  };
  let sinkCancelled = false;
  const cancelSink = async (): Promise<void> => {
    if (sinkCancelled) return;
    sinkCancelled = true;
    await sink.cancel().catch(() => undefined);
  };
  const throwIfAborted = async (): Promise<void> => {
    if (signal?.aborted) {
      await cancelSink();
      throw new ExportAbortedError();
    }
  };

  try {
    // Audio first: it encodes incrementally inside the sink while the (much
    // slower) video frame walk proceeds.
    await throwIfAborted();
    if (mixAudio && sink.addAudio) {
      onProgress?.({ phase: "audio", framesDone: 0, totalFrames, audioMixedUs: 0, audioTotalUs: durationUs });
      const mixContext: MixAudioContext = {
        ...(signal ? { signal } : {}),
        onProgress: (mixedUs) =>
          onProgress?.({ phase: "audio", framesDone: 0, totalFrames, audioMixedUs: mixedUs, audioTotalUs: durationUs }),
      };
      const buffer = await mixAudio(mixContext);
      await throwIfAborted();
      if (buffer !== null) await sink.addAudio(buffer);
    }

    // Frame timestamps are derived per index — never accumulated — so a long
    // export cannot drift; the last frame is clipped to end exactly at endUs.
    // Encoder submissions run in a bounded in-flight window so decode,
    // compositing, and encoding OVERLAP: the sink captures the canvas
    // synchronously inside addVideoFrame (its contract), so the next frame
    // can render while previous frames are still encoding. Fully awaiting
    // each frame runs everything in lockstep — measured at ~realtime with an
    // idle CPU.
    const encodeWindow = Math.max(1, options.encodeAheadFrames ?? 4);
    const inFlight: Promise<void>[] = [];
    let sinkError: unknown;
    const trackAdd = (add: Promise<void>): void => {
      inFlight.push(
        add.catch((error: unknown) => {
          sinkError ??= error;
        }),
      );
    };

    progress("video", 0);
    for (let n = 0; n < totalFrames; n++) {
      await throwIfAborted();
      if (sinkError) throw sinkError;
      const frameStartUs = startUs + Math.round((n * 1_000_000) / fps);
      const frameEndUs = Math.min(
        startUs + Math.round(((n + 1) * 1_000_000) / fps),
        endUs,
      );
      // Sample at the frame's temporal MIDPOINT (the NLE convention): source
      // timestamps carry container rounding (WebM stores milliseconds), and
      // sampling at the exact frame start grabs the previous source frame
      // whenever that jitter lands the boundary ±1ms off. The midpoint is
      // maximally far from both boundaries.
      const sampleUs = frameStartUs + Math.floor((frameEndUs - frameStartUs) / 2);
      await renderFrame(sampleUs);
      await throwIfAborted(); // rendering awaits decode — abort may land there
      if (sinkError) throw sinkError;
      trackAdd(sink.addVideoFrame(frameStartUs - startUs, frameEndUs - frameStartUs));
      if (inFlight.length >= encodeWindow) await inFlight.shift();
      progress("video", n + 1);
    }
    while (inFlight.length > 0) await inFlight.shift(); // drain the window
    if (sinkError) throw sinkError;

    await throwIfAborted();
    progress("finalizing", totalFrames);
    return await sink.finalize();
  } catch (error) {
    // Every failure path releases the sink exactly once: aborts (whether
    // detected here or thrown inside mixAudio), render errors, sink errors.
    await cancelSink();
    throw error;
  }
}
