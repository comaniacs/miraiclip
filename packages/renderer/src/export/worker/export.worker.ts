/**
 * The export worker entry: runs the ENTIRE export pipeline — decode,
 * compositing on an OffscreenCanvas, capture, encode, mux — off the main
 * thread, so a running export no longer saturates the UI's thread. Total CPU
 * is unchanged (same work); responsiveness is the win.
 *
 * Spawned by `exportProjectInWorker`, or by the application directly
 * (`new Worker(new URL(...), { type: "module" })`, or a bundler's worker
 * import) and driven with `exportViaWorker`. Package subpath:
 * `@miraiclip/renderer/export-worker`.
 *
 * Boundary rules (same as server export): the document crosses as data, so
 * custom clip-kind `factories` are not supported here — built-in kinds only.
 * Audio mixes on the MAIN thread (`OfflineAudioContext` is window-only) and
 * crosses as transferred PCM planes; fonts load in the worker's own
 * FontFaceSet (`self.fonts`); html clips arrive as pre-rendered bitmaps
 * (rasterized on main — no DOM here) and are installed before the export.
 */
import { DOMAdapter, WebWorkerAdapter } from "pixi.js";
import { createProject } from "@miraiclip/core";
import type { StreamTargetChunk } from "mediabunny";
import { provideHtmlRasters } from "../../html/rasterize.js";
import { exportProject } from "../export-project.js";
import type { ExportRange, PcmAudioChunk } from "../types.js";
import type { MainToWorkerMessage, WorkerToMainMessage } from "./protocol.js";

// Pixi must resolve canvas/document features through the worker adapter
// BEFORE any backend is created.
DOMAdapter.set(WebWorkerAdapter);

const scope = globalThis as unknown as {
  postMessage(message: WorkerToMainMessage, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<MainToWorkerMessage>) => void) | null;
};

let abortController: AbortController | undefined;
let nextAudioRequestId = 0;
const pendingAudio = new Map<number, { resolve: (chunk: PcmAudioChunk | null) => void; reject: (error: Error) => void }>();
let nextOutputChunkId = 0;
const pendingOutput = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();

function requestAudioChunk(range: ExportRange): Promise<PcmAudioChunk | null> {
  return new Promise((resolve, reject) => {
    const id = nextAudioRequestId++;
    pendingAudio.set(id, { resolve, reject });
    scope.postMessage({ type: "need-audio-chunk", id, startUs: range.startUs, endUs: range.endUs });
  });
}

/**
 * Streaming output relays through main: `FileSystemWritableFileStream` — the
 * save-picker stream, the main streaming consumer — is NOT transferable, so
 * the worker never receives a stream; it posts each encoded chunk and waits
 * for main's ack (sent after main's write into the real target resolves), so
 * the target's backpressure throttles the encoders exactly as a direct
 * `target` does. Chunk data is COPIED before transfer — the muxer may hand
 * out views into buffers it still owns, and transferring those would detach
 * them under it.
 */
function relayTarget(): WritableStream<StreamTargetChunk> {
  return new WritableStream<StreamTargetChunk>({
    write(chunk) {
      return new Promise<void>((resolve, reject) => {
        const id = nextOutputChunkId++;
        pendingOutput.set(id, { resolve, reject });
        const data = chunk.data.slice();
        scope.postMessage(
          { type: "output-chunk", id, chunk: { ...chunk, data } },
          [data.buffer as ArrayBuffer],
        );
      });
    },
  });
}

async function run(message: Extract<MainToWorkerMessage, { type: "start" }>): Promise<void> {
  abortController = new AbortController();
  try {
    // One-line environment diagnostic (worker console lines surface in the
    // page's DevTools): a worker's WebGL context CAN fall back to software
    // where the page's is hardware — that flips the sink to the slower CPU
    // capture path and software rendering, and this line is how you tell.
    try {
      const probe = new OffscreenCanvas(1, 1);
      const gl = (probe.getContext("webgl2") ?? probe.getContext("webgl")) as WebGLRenderingContext | null;
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      const renderer = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "no webgl context";
      // eslint-disable-next-line no-console
      console.log(`[miraiclip] export worker GL: ${renderer}`);
    } catch {
      // diagnostic only
    }
    // Html clips: no DOM here, so their rasters arrived pre-rendered with the
    // start message — install them for `rasterizeHtml` to serve from.
    provideHtmlRasters(message.htmlRasters ?? {});
    const project = createProject(message.doc);
    const bytes = await exportProject(project, {
      ...message.options,
      signal: abortController.signal,
      ...(message.streamOutput ? { target: relayTarget() } : {}),
      onProgress: (progress) => scope.postMessage({ type: "progress", progress }),
      audioOverride: {
        hasAudio: message.hasAudio,
        mixChunk: (_context, chunkRange) => requestAudioChunk(chunkRange),
      },
    });
    scope.postMessage({ type: "done", bytes }, bytes.byteLength > 0 ? [bytes.buffer as ArrayBuffer] : []);
  } catch (error) {
    const err = error as Error;
    scope.postMessage({
      type: "error",
      name: typeof err?.name === "string" ? err.name : "Error",
      message: String(err?.message ?? error),
    });
  }
}

scope.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  const message = event.data;
  if (message.type === "start") {
    void run(message);
  } else if (message.type === "abort") {
    abortController?.abort();
  } else if (message.type === "audio-chunk") {
    const pending = pendingAudio.get(message.id);
    pendingAudio.delete(message.id);
    if (!pending) return;
    if (message.error !== undefined) pending.reject(new Error(message.error));
    else pending.resolve(message.chunk);
  } else if (message.type === "output-chunk-ack") {
    const pending = pendingOutput.get(message.id);
    pendingOutput.delete(message.id);
    if (!pending) return;
    if (message.error !== undefined) pending.reject(new Error(message.error));
    else pending.resolve();
  }
};
