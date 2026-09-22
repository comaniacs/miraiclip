/**
 * The in-page half of server export. Bundled (with @miraiclip/core,
 * @miraiclip/renderer and their dependencies) into dist/harness.js at build
 * time and served by the harness server, so the published package is
 * self-contained and version-locked to the renderer it was built with.
 *
 * The page runs the SAME `exportProject` the browser playground uses —
 * that identity is the whole design: preview/export parity by construction.
 */
import { createProject, type ProjectDocument } from "@miraiclip/core";
import { exportProject, isWebCodecsSupported, renderProjectStill } from "@miraiclip/renderer";
import "./protocol.js";

let controller: AbortController | undefined;

window.__miraiAbort = () => controller?.abort();

window.__miraiExport = async (doc, options): Promise<string> => {
  if (!isWebCodecsSupported()) {
    throw new Error("this browser has no WebCodecs — server export needs Chrome 94+");
  }
  controller = new AbortController();
  const project = createProject(doc as ProjectDocument);
  const { stream, ...exportOptions } = options;
  const bytes = await exportProject(project, {
    ...exportOptions,
    signal: controller.signal,
    onProgress: (progress) => {
      window.__miraiProgress?.(progress);
    },
    // Streamed export: every encoded chunk POSTs to the loopback server,
    // which writes it at its byte position — the file never accumulates in
    // the page, and the awaited fetch is the encoder backpressure.
    ...(stream
      ? {
          target: new WritableStream<{ type: "write"; data: Uint8Array; position: number }>({
            async write(chunk) {
              const response = await fetch(`/__output?pos=${chunk.position}`, {
                method: "POST",
                body: chunk.data as BodyInit,
              });
              if (!response.ok) throw new Error(`output write failed: HTTP ${response.status}`);
            },
          }),
        }
      : {}),
  });
  return stream ? "" : toBase64(bytes);
};

window.__miraiRenderStill = async (doc, options): Promise<string> => {
  const project = createProject(doc as ProjectDocument);
  const blob = await renderProjectStill(project, {
    timeUs: options.timeUs,
    ...(options.width !== undefined ? { width: options.width } : {}),
    ...(options.height !== undefined ? { height: options.height } : {}),
  });
  return toBase64(new Uint8Array(await blob.arrayBuffer()));
};

/** Chunked btoa — String.fromCharCode(...bytes) overflows the arg limit on real files. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
