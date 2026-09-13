import { existsSync } from "node:fs";
import { mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAssetSources } from "./assets.js";
import "./harness/protocol.js";
import { launchBrowser } from "./browser.js";
import { startHarnessServer } from "./server.js";
import {
  ServerExportAbortedError,
  type ExportProjectFileOptions,
  type ExportProjectFileResult,
  type ProjectDocument,
  type ServerExportProgress,
} from "./types.js";

/**
 * Export a Miraiclip project document from Node: launches headless Chrome,
 * serves a harness page + the project's media on a loopback server, runs the
 * exact same `exportProject` the browser uses, and returns the encoded file.
 *
 * MP4 needs a real Chrome (free Chromium has no H.264 encoder — it fails the
 * up-front codec probe with a clear error); WebM works on any Chromium.
 */
export async function exportProjectFile(
  doc: ProjectDocument,
  options: ExportProjectFileOptions,
): Promise<ExportProjectFileResult> {
  throwIfAborted(options.signal);
  const { doc: rewrittenDoc, files } = resolveAssetSources(doc, {
    assets: options.assets,
    assetsDir: options.assetsDir,
    exists: existsSync,
  });

  // Built layout: dist/index.js + dist/harness.js side by side. When running
  // from source (vitest imports src/), the bundle is in ../dist instead.
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const harnessScriptPath = [
    path.join(moduleDir, "harness.js"),
    path.join(moduleDir, "../dist/harness.js"),
  ].find(existsSync);
  if (!harnessScriptPath) {
    throw new Error(
      `harness bundle missing next to ${moduleDir} — the package was not built (run its build)`,
    );
  }

  // With `out`, the encoded chunks stream from the page straight into the
  // file (positioned writes — containers patch headers at the end), so peak
  // memory stays flat however long the output is. Without it, the file comes
  // back in memory as before.
  const filePath = options.out ? path.resolve(options.out) : undefined;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let bytesWritten = 0;
  if (filePath) {
    await mkdir(path.dirname(filePath), { recursive: true });
    handle = await open(filePath, "w");
  }
  const closeOutput = async (keep: boolean): Promise<void> => {
    if (!handle) return;
    const openHandle = handle;
    handle = undefined;
    await openHandle.close().catch(() => undefined);
    if (!keep) await unlink(filePath!).catch(() => undefined); // no half files
  };

  const server = await startHarnessServer({
    harnessScriptPath,
    files,
    ...(filePath
      ? {
          output: async (position: number, data: Buffer) => {
            await handle!.write(data, 0, data.length, position);
            bytesWritten = Math.max(bytesWritten, position + data.length);
          },
        }
      : {}),
  }).catch(async (error: unknown) => {
    await closeOutput(false);
    throw error;
  });
  const browser = await launchBrowser(options.browser).catch(async (error: unknown) => {
    await server.close();
    await closeOutput(false);
    throw error;
  });
  const errors: string[] = [];
  let onAbort: (() => void) | undefined;
  let succeeded = false;

  try {
    const page = await browser.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.exposeFunction("__miraiProgress", (progress: ServerExportProgress) => {
      // Streamed exports carry the live byte count alongside the frame
      // progress — the exact "how big is the file so far".
      options.onProgress?.(filePath ? { ...progress, bytesWritten } : progress);
    });

    await page.goto(server.url);
    await page.waitForFunction(() => typeof window.__miraiExport === "function");

    throwIfAborted(options.signal);
    onAbort = () => {
      void page.evaluate(() => window.__miraiAbort()).catch(() => undefined);
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    const base64 = await page
      .evaluate(
        ([exportDoc, exportOptions]) => window.__miraiExport(exportDoc, exportOptions),
        [
          rewrittenDoc,
          {
            format: options.format,
            ...(options.quality !== undefined ? { quality: options.quality } : {}),
            ...(options.fps !== undefined ? { fps: options.fps } : {}),
            ...(options.width !== undefined ? { width: options.width } : {}),
            ...(options.height !== undefined ? { height: options.height } : {}),
            ...(options.range !== undefined ? { range: options.range } : {}),
            ...(options.audioChunkSeconds !== undefined ? { audioChunkSeconds: options.audioChunkSeconds } : {}),
            ...(filePath ? { stream: true } : {}),
          },
        ] as const,
      )
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("export aborted")) throw new ServerExportAbortedError();
        const context = errors.length > 0 ? `\npage errors:\n  ${errors.slice(-5).join("\n  ")}` : "";
        throw new Error(`server export failed: ${message}${context}`);
      });

    if (filePath) {
      if (bytesWritten === 0) throw new Error("streamed export produced no output");
      succeeded = true;
      return { filePath, bytesWritten };
    }
    return { bytes: Uint8Array.from(Buffer.from(base64, "base64")) };
  } finally {
    if (onAbort) options.signal?.removeEventListener("abort", onAbort);
    await browser.close().catch(() => undefined);
    await server.close();
    await closeOutput(succeeded);
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new ServerExportAbortedError();
}
