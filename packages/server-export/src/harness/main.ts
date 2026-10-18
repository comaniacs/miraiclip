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
import { exportProject, isWebCodecsSupported, loadDocumentPlugins, renderProjectStill, type LoadedPlugins } from "@miraiclip/renderer";
import type { HarnessPlugins } from "./protocol.js";
import "./protocol.js";

/** Register the job's plugins for its duration (unloaded after, so warm pages stay clean). */
async function withPlugins<T>(plugins: HarnessPlugins | undefined, run: () => Promise<T>): Promise<T> {
  let loaded: LoadedPlugins | undefined;
  if (plugins && plugins.refs.length > 0) {
    loaded = await loadDocumentPlugins(
      { plugins: plugins.refs },
      {
        environment: "server",
        fetchSource: async (url) => {
          const source = plugins.sources[url];
          if (source === undefined) throw new Error(`plugin source for ${url} was not provided`);
          return source;
        },
      },
    );
  }
  try {
    return await run();
  } finally {
    loaded?.unload();
  }
}

let controller: AbortController | undefined;

window.__miraiAbort = () => controller?.abort();

window.__miraiExport = async (doc, options): Promise<string> => {
  if (!isWebCodecsSupported()) {
    throw new Error("this browser has no WebCodecs — server export needs Chrome 94+");
  }
  const job = new AbortController();
  controller = job;
  const { stream, plugins, ...exportOptions } = options;
  return withPlugins(plugins, async () => {
  const project = createProject(doc as ProjectDocument);
  const bytes = await exportProject(project, {
    ...exportOptions,
    signal: job.signal,
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
  });
};

window.__miraiRenderStill = async (doc, options): Promise<string> =>
  withPlugins(options.plugins, async () => {
    const project = createProject(doc as ProjectDocument);
    const blob = await renderProjectStill(project, {
      timeUs: options.timeUs,
      ...(options.width !== undefined ? { width: options.width } : {}),
      ...(options.height !== undefined ? { height: options.height } : {}),
    });
    return toBase64(new Uint8Array(await blob.arrayBuffer()));
  });

/** Chunked btoa — String.fromCharCode(...bytes) overflows the arg limit on real files. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
