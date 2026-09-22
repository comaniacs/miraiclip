/**
 * The message protocol between `exportViaWorker` (main thread) and the export
 * worker entry. Everything that crosses is structured-cloneable or
 * transferable; functions never cross — progress and abort become messages,
 * and audio chunks cross as raw PCM planes (`AudioBuffer` is window-only).
 */
import type { ProjectDocument } from "@miraiclip/core";
import type { StreamTargetChunk } from "mediabunny";
import type { ExportProgress, ExportRange, PcmAudioChunk } from "../types.js";
import type { ExportFormat, ExportQualityPreset } from "../mediabunny-sink.js";

/** The subset of ExportProjectOptions that crosses the boundary as data. */
export interface WorkerExportWireOptions {
  format: ExportFormat;
  quality?: ExportQualityPreset | { videoBitrate: number };
  fps?: number;
  width?: number;
  height?: number;
  range?: ExportRange;
  audioChunkSeconds?: number;
}

export type MainToWorkerMessage =
  | {
      type: "start";
      doc: ProjectDocument;
      options: WorkerExportWireOptions;
      /** Decided on main (the probe opens audio decoders — cheaper once). */
      hasAudio: boolean;
      /**
       * Stream the output: encoded chunks RELAY through the main thread as
       * messages, and main writes them into the caller's WritableStream. A
       * relay (not a transfer) on purpose: `FileSystemWritableFileStream` —
       * the save-picker stream, the main streaming consumer — is NOT
       * transferable, and one relay path covers every stream. Each chunk is
       * acked only after main's write resolves, so the target's backpressure
       * reaches the worker's encoders.
       */
      streamOutput?: boolean;
    }
  | { type: "abort" }
  | {
      type: "audio-chunk";
      id: number;
      chunk: PcmAudioChunk | null;
      /** Set when main-side mixing failed — the worker fails the export. */
      error?: string;
    }
  | {
      type: "output-chunk-ack";
      id: number;
      /** Set when main's write into the target failed — the worker fails the export. */
      error?: string;
    };

export type WorkerToMainMessage =
  | { type: "need-audio-chunk"; id: number; startUs: number; endUs: number }
  | { type: "output-chunk"; id: number; chunk: StreamTargetChunk }
  | { type: "progress"; progress: ExportProgress }
  | { type: "done"; bytes: Uint8Array }
  | { type: "error"; name: string; message: string };
