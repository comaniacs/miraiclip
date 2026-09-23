import { existsSync } from "node:fs";
import { mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright-core";
import { resolveAssetSources } from "./assets.js";
import "./harness/protocol.js";
import { launchBrowser } from "./browser.js";
import { startHarnessServer, type HarnessServer } from "./server.js";
import {
  ServerExportAbortedError,
  type BrowserOptions,
  type ExportProjectFileOptions,
  type ExportProjectFileResult,
  type ProjectDocument,
  type ServerExportProgress,
} from "./types.js";

export interface CreateExportSessionOptions {
  /** Asset id → local file path (same contract as `exportProjectFile`). */
  assets?: Record<string, string>;
  /** Base directory for resolving relative asset `src` paths (default: cwd). */
  assetsDir?: string;
  browser?: BrowserOptions;
}

/** Per-export options: everything `exportProjectFile` takes minus the session-level fields. */
export type ExportFileOptions = Omit<ExportProjectFileOptions, "assets" | "assetsDir" | "browser">;

export interface ExportSession {
  /**
   * Export one document — same options and result as `exportProjectFile`,
   * without the browser launch. The document is passed per call, so a session
   * outlives edits and serves any number of documents.
   */
  exportFile(doc: ProjectDocument, options: ExportFileOptions): Promise<ExportProjectFileResult>;
  close(): Promise<void>;
}

/**
 * A persistent exporter: ONE headless Chrome + harness page kept warm across
 * calls, so an export costs an export — not a browser launch (~1-2s each that
 * `exportProjectFile` pays per call). Exports run through the exact same
 * in-page `exportProject` pipeline; one page runs one export at a time, so
 * calls queue. Built for batch rendering (`@miraiclip/templates`) and
 * export-on-demand services.
 */
export async function createExportSession(
  options: CreateExportSessionOptions = {},
): Promise<ExportSession> {
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

  // Session-lifetime mutable state, routed per queued export: the server and
  // the exposed progress function are created ONCE, so the current export's
  // output writer and progress callback live behind these references.
  const files = new Map<string, string>();
  let currentOutput: ((position: number, data: Buffer) => Promise<void>) | undefined;
  let currentProgress: ((progress: ServerExportProgress) => void) | undefined;

  let server: HarnessServer | undefined;
  let page: Page | undefined;
  const browser = await launchBrowser(options.browser);
  const errors: string[] = [];
  try {
    server = await startHarnessServer({
      harnessScriptPath,
      files,
      output: (position, data) => {
        if (!currentOutput) return Promise.reject(new Error("no streamed export is active"));
        return currentOutput(position, data);
      },
    });
    page = await browser.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.exposeFunction("__miraiProgress", (progress: ServerExportProgress) => {
      currentProgress?.(progress);
    });
    await page.goto(server.url);
    await page.waitForFunction(() => typeof window.__miraiExport === "function");
  } catch (error) {
    await page?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await server?.close();
    throw error;
  }
  const readyPage = page;
  const readyServer = server;

  // One page runs one export at a time — serialize callers instead of letting
  // two exports interleave on the same compositor and output route.
  let queue: Promise<unknown> = Promise.resolve();
  let closed = false;

  return {
    exportFile(doc, exportOptions) {
      const run = queue.then(async (): Promise<ExportProjectFileResult> => {
        if (closed) throw new Error("export session is closed");
        if (exportOptions.signal?.aborted) throw new ServerExportAbortedError();

        const resolved = resolveAssetSources(doc, {
          assets: options.assets,
          assetsDir: options.assetsDir,
          exists: existsSync,
        });
        files.clear();
        for (const [urlPath, filePath] of resolved.files) files.set(urlPath, filePath);

        // With `out`, chunks stream from the page into the file exactly like
        // exportProjectFile — flat memory, no half files left on failure.
        const filePath = exportOptions.out ? path.resolve(exportOptions.out) : undefined;
        let handle: Awaited<ReturnType<typeof open>> | undefined;
        let bytesWritten = 0;
        if (filePath) {
          await mkdir(path.dirname(filePath), { recursive: true });
          handle = await open(filePath, "w");
          currentOutput = async (position, data) => {
            await handle!.write(data, 0, data.length, position);
            bytesWritten = Math.max(bytesWritten, position + data.length);
          };
        }
        currentProgress = exportOptions.onProgress
          ? (progress) =>
              exportOptions.onProgress!(filePath ? { ...progress, bytesWritten } : progress)
          : undefined;

        const onAbort = (): void => {
          void readyPage.evaluate(() => window.__miraiAbort()).catch(() => undefined);
        };
        exportOptions.signal?.addEventListener("abort", onAbort, { once: true });

        errors.length = 0;
        let succeeded = false;
        try {
          const base64 = await readyPage
            .evaluate(
              ([exportDoc, wire]) => window.__miraiExport(exportDoc, wire),
              [
                resolved.doc,
                {
                  format: exportOptions.format,
                  ...(exportOptions.quality !== undefined ? { quality: exportOptions.quality } : {}),
                  ...(exportOptions.fps !== undefined ? { fps: exportOptions.fps } : {}),
                  ...(exportOptions.width !== undefined ? { width: exportOptions.width } : {}),
                  ...(exportOptions.height !== undefined ? { height: exportOptions.height } : {}),
                  ...(exportOptions.range !== undefined ? { range: exportOptions.range } : {}),
                  ...(exportOptions.audioChunkSeconds !== undefined
                    ? { audioChunkSeconds: exportOptions.audioChunkSeconds }
                    : {}),
                  ...(filePath ? { stream: true } : {}),
                },
              ] as const,
            )
            .catch((error: unknown) => {
              const message = error instanceof Error ? error.message : String(error);
              if (message.includes("export aborted")) throw new ServerExportAbortedError();
              const context =
                errors.length > 0 ? `\npage errors:\n  ${errors.slice(-5).join("\n  ")}` : "";
              throw new Error(`server export failed: ${message}${context}`);
            });

          if (filePath) {
            if (bytesWritten === 0) throw new Error("streamed export produced no output");
            succeeded = true;
            return { filePath, bytesWritten };
          }
          succeeded = true;
          return { bytes: Uint8Array.from(Buffer.from(base64, "base64")) };
        } finally {
          exportOptions.signal?.removeEventListener("abort", onAbort);
          currentOutput = undefined;
          currentProgress = undefined;
          if (handle) {
            await handle.close().catch(() => undefined);
            if (!succeeded) await unlink(filePath!).catch(() => undefined); // no half files
          }
        }
      });
      queue = run.catch(() => undefined); // a failed export never wedges the queue
      return run;
    },
    async close() {
      closed = true;
      await queue.catch(() => undefined);
      await readyPage.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
      await readyServer.close();
    },
  };
}
