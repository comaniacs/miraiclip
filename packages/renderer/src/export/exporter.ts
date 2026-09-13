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
   * Produce the mixed audio for the WHOLE range in one buffer
   * (OfflineAudioContext in production). Return null for a silent/audio-less
   * composition — no audio track is added. Receives the abort signal and a
   * progress callback. Simple, but the buffer is the entire timeline's PCM —
   * for long timelines prefer `mixAudioChunk`, which bounds that memory.
   * When both are given, `mixAudioChunk` wins.
   */
  mixAudio?: (context: MixAudioContext) => Promise<unknown | null>;
  /**
   * Produce the mixed audio for ONE chunk of the range. The orchestrator
   * calls it with strictly sequential sub-ranges of `audioChunkUs` (the last
   * one clipped to `endUs`), interleaved with the frame walk, so a long
   * timeline never holds more than one chunk of uncompressed PCM. Return null
   * from the FIRST chunk to declare the whole composition audio-less — no
   * audio track is added and no further chunks are requested. After a first
   * non-null chunk, every later chunk MUST return a buffer (a silent stretch
   * returns a silent buffer — chunk timestamps accumulate by buffer duration,
   * so a skipped chunk would shift all later audio earlier); a null then
   * fails the export loudly.
   */
  mixAudioChunk?: (context: MixAudioContext, chunkRange: { startUs: Us; endUs: Us }) => Promise<unknown | null>;
  /**
   * Audio mix chunk length for `mixAudioChunk` (default 60s). Bounds PCM
   * memory: 48kHz stereo float is ~23MB per minute, so the default holds
   * ~23MB regardless of timeline length. Integer seconds keep chunk
   * boundaries sample-exact.
   */
  audioChunkUs?: Us;
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
  const { startUs, endUs, fps, renderFrame, sink, signal, onProgress } = options;
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
    // Audio is mixed in bounded chunks, interleaved with the frame walk: the
    // first chunk lands before frame 0 (it registers the audio track — tracks
    // freeze when the container starts), and each later chunk is mixed just
    // before the walk crosses into its window. PCM memory stays at one chunk
    // regardless of timeline length, and the muxer's interleaving window
    // stays tight. The legacy whole-range `mixAudio` runs through the same
    // pump as a single chunk covering the entire range — identical behavior
    // to the pre-chunking orchestrator.
    const mixAudio: ExportCompositionOptions["mixAudioChunk"] =
      options.mixAudioChunk ??
      (options.mixAudio ? (context) => options.mixAudio!(context) : undefined);
    const audioChunkUs = options.mixAudioChunk
      ? (Math.max(1_000_000, options.audioChunkUs ?? 60_000_000) as Us)
      : durationUs;
    let audioThroughUs = 0; // relative to startUs; how far audio has been added
    let audioActive = Boolean(mixAudio && sink.addAudio);
    const pumpAudioThrough = async (relativeUs: Us): Promise<void> => {
      while (audioActive && audioThroughUs < Math.min(relativeUs, durationUs)) {
        const chunkStartUs = audioThroughUs;
        const chunkEndUs = Math.min(chunkStartUs + audioChunkUs, durationUs);
        const first = chunkStartUs === 0;
        const phase: ExportProgress["phase"] = first ? "audio" : "video";
        const framesDone = first ? 0 : Math.min(totalFrames, Math.ceil((chunkStartUs * fps) / 1_000_000));
        onProgress?.({ phase, framesDone, totalFrames, audioMixedUs: chunkStartUs, audioTotalUs: durationUs });
        const mixContext: MixAudioContext = {
          ...(signal ? { signal } : {}),
          onProgress: (mixedUs) =>
            onProgress?.({ phase, framesDone, totalFrames, audioMixedUs: chunkStartUs + mixedUs, audioTotalUs: durationUs }),
        };
        const buffer = await mixAudio!(mixContext, {
          startUs: startUs + chunkStartUs,
          endUs: startUs + chunkEndUs,
        });
        await throwIfAborted();
        if (buffer === null) {
          if (first) {
            audioActive = false; // audio-less composition — no track at all
            return;
          }
          // Chunk timestamps accumulate by buffer duration — a skipped chunk
          // would silently shift every later chunk earlier. Fail loudly.
          throw new Error(
            "export audio: a mid-timeline chunk mixed to null — silent stretches of an audible composition must return a silent buffer",
          );
        }
        await sink.addAudio!(buffer);
        audioThroughUs = chunkEndUs;
      }
    };
    await throwIfAborted();
    await pumpAudioThrough(Math.min(audioChunkUs, durationUs) as Us); // chunk 0 before frame 0

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
      // Keep mixed audio ahead of the frame walk, one chunk at a time.
      await pumpAudioThrough((frameEndUs - startUs) as Us);
      if (sinkError) throw sinkError;
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
