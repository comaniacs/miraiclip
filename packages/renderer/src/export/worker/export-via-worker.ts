/**
 * Main-thread side of the worker export: serializes the document across,
 * relays progress and abort, mixes audio chunks on THIS thread (the
 * `OfflineAudioContext` mixer is window-only) and transfers them as PCM
 * planes, and resolves with the result exactly like `exportProject`.
 *
 * Two layers:
 * - `exportViaWorker(worker, project, options)` — bring your own Worker
 *   (bundler worker imports, custom URLs). The worker is NOT terminated.
 * - `exportProjectInWorker(project, options)` — convenience: spawns the
 *   bundled entry (`new URL("./export.worker.js", import.meta.url)`, the
 *   pattern Vite/webpack/Rollup rewrite; pass `worker` or `workerUrl` where
 *   that pattern can't resolve) and terminates it when done.
 *
 * Boundary rules: custom clip-kind `factories` cannot cross (functions) —
 * built-in kinds only, same as server export. Media `src` values must be
 * reachable from a worker: http(s)/blob URLs and Blob/File objects all work.
 */
import type { Project } from "@miraiclip/core";
import { openMediabunnyAudio } from "../../audio/webaudio.js";
import { compositionEnd, probeCompositionAudio } from "../export-project.js";
import { mixCompositionAudio } from "../offline-audio.js";
import { ExportAbortedError, type ExportProgress, type ExportRange, type PcmAudioChunk } from "../types.js";
import type { MainToWorkerMessage, WorkerExportWireOptions, WorkerToMainMessage } from "./protocol.js";
import type { StreamTargetChunk } from "mediabunny";

export interface ExportViaWorkerOptions extends WorkerExportWireOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
  /**
   * Stream the encoded file out — same contract as `exportProject`'s target,
   * and a `showSaveFilePicker()` writable works directly. Chunks RELAY from
   * the worker through this thread (`FileSystemWritableFileStream` is not
   * transferable), acked only after each write resolves, so the stream's
   * backpressure reaches the worker's encoders. The stream is left unclosed
   * for the caller, exactly like a main-thread export.
   */
  target?: WritableStream<StreamTargetChunk>;
}

function toPcm(buffer: AudioBuffer): { chunk: PcmAudioChunk; transfer: ArrayBuffer[] } {
  const planes: Float32Array[] = [];
  const transfer: ArrayBuffer[] = [];
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    // Copy out: an AudioBuffer's own channel storage is not transferable.
    const plane = new Float32Array(buffer.length);
    buffer.copyFromChannel(plane, channel);
    planes.push(plane);
    transfer.push(plane.buffer as ArrayBuffer);
  }
  return {
    chunk: {
      sampleRate: buffer.sampleRate,
      numberOfFrames: buffer.length,
      numberOfChannels: buffer.numberOfChannels,
      planes,
    },
    transfer,
  };
}

/** Drive an export inside `worker` (a Worker running the export worker entry). */
export async function exportViaWorker(
  worker: Worker,
  project: Project,
  options: ExportViaWorkerOptions,
): Promise<Uint8Array> {
  const doc = project.getState().doc;
  const range = options.range ?? { startUs: 0, endUs: compositionEnd(doc) };
  const hasAudio = await probeCompositionAudio(doc, range, openMediabunnyAudio);

  const { signal, onProgress, target, ...wire } = options;
  if (signal?.aborted) throw new ExportAbortedError();

  return new Promise<Uint8Array>((resolve, reject) => {
    const post = (message: MainToWorkerMessage, transfer: Transferable[] = []): void =>
      worker.postMessage(message, transfer);

    // Relayed output: the worker posts encoded chunks; this thread writes them
    // into the caller's stream and acks — the ack is the backpressure. The
    // writer lock is released on completion so the caller can close/abort.
    const writer = target?.getWriter();
    const releaseTarget = (): void => {
      try {
        writer?.releaseLock();
      } catch {
        // already released
      }
    };

    const mixChunk = async (chunkRange: ExportRange): Promise<{ chunk: PcmAudioChunk | null; transfer: ArrayBuffer[] }> => {
      const buffer = await mixCompositionAudio({
        doc,
        range: chunkRange,
        openAudio: openMediabunnyAudio,
        silenceIfEmpty: true,
        ...(signal ? { signal } : {}),
      });
      return buffer ? toPcm(buffer) : { chunk: null, transfer: [] };
    };

    const onAbort = (): void => post({ type: "abort" });
    const cleanup = (): void => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onWorkerError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onMessage = (event: MessageEvent<WorkerToMainMessage>): void => {
      const message = event.data;
      if (message.type === "progress") {
        onProgress?.(message.progress);
      } else if (message.type === "output-chunk") {
        void writer!
          .write(message.chunk)
          .then(() => post({ type: "output-chunk-ack", id: message.id }))
          .catch((error: unknown) =>
            post({ type: "output-chunk-ack", id: message.id, error: String((error as Error)?.message ?? error) }),
          );
      } else if (message.type === "need-audio-chunk") {
        void mixChunk({ startUs: message.startUs, endUs: message.endUs })
          .then(({ chunk, transfer }) => post({ type: "audio-chunk", id: message.id, chunk }, transfer))
          .catch((error: unknown) =>
            post({ type: "audio-chunk", id: message.id, chunk: null, error: String((error as Error)?.message ?? error) }),
          );
      } else if (message.type === "done") {
        cleanup();
        releaseTarget();
        resolve(message.bytes);
      } else if (message.type === "error") {
        cleanup();
        releaseTarget();
        reject(
          message.name === "ExportAbortedError"
            ? new ExportAbortedError()
            : Object.assign(new Error(message.message), { name: message.name }),
        );
      }
    };
    const onWorkerError = (event: ErrorEvent): void => {
      cleanup();
      releaseTarget();
      reject(new Error(`export worker failed: ${event.message || "could not load the worker script"}`));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onWorkerError);
    signal?.addEventListener("abort", onAbort);

    post({ type: "start", doc, options: wire, hasAudio, ...(target ? { streamOutput: true } : {}) });
  });
}

export interface ExportProjectInWorkerOptions extends ExportViaWorkerOptions {
  /** Use this Worker instead of spawning one (it will NOT be terminated). */
  worker?: Worker;
  /** Spawn from this URL instead of the bundled entry (module worker). */
  workerUrl?: string | URL;
}

/**
 * Run `exportProject` in a dedicated worker so the main thread stays free.
 * Same total CPU — the work is identical — but the page keeps rendering and
 * responding while the export runs, and the export stops competing with the
 * UI for its thread.
 */
export async function exportProjectInWorker(
  project: Project,
  options: ExportProjectInWorkerOptions,
): Promise<Uint8Array> {
  const { worker: provided, workerUrl, ...rest } = options;
  const worker =
    provided ??
    new Worker(workerUrl ?? new URL("./export.worker.js", import.meta.url), { type: "module" });
  try {
    return await exportViaWorker(worker, project, rest);
  } finally {
    if (!provided) worker.terminate();
  }
}
