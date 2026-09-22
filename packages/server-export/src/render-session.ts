import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright-core";
import { resolveAssetSources } from "./assets.js";
import "./harness/protocol.js";
import { launchBrowser } from "./browser.js";
import { startHarnessServer, type HarnessServer } from "./server.js";
import type { BrowserOptions, ProjectDocument } from "./types.js";

export interface CreateRenderSessionOptions {
  /** Asset id → local file path (same contract as `exportProjectFile`). */
  assets?: Record<string, string>;
  /** Base directory for resolving relative asset `src` paths (default: cwd). */
  assetsDir?: string;
  browser?: BrowserOptions;
}

export interface RenderStillOptions {
  /** Composition time to render, in microseconds. */
  timeUs: number;
  /** Output size (default: the document's composition size). */
  width?: number;
  height?: number;
}

export interface RenderSession {
  /**
   * Render one frame of `doc` as a PNG. The document is passed per call, so a
   * session outlives edits — hand it the latest state every time.
   */
  renderStill(doc: ProjectDocument, options: RenderStillOptions): Promise<Uint8Array>;
  close(): Promise<void>;
}

/**
 * A persistent still-frame renderer: ONE headless Chrome + harness page kept
 * warm across calls, so rendering a frame costs a frame — not a browser
 * launch. Frames render through the exact export pipeline (same compositor,
 * decode path, and fonts), so a still is what that composition time will look
 * like in the exported file. Built for agent loops (`@miraiclip/mcp`'s
 * preview_frame) and thumbnail generation.
 */
export async function createRenderSession(
  options: CreateRenderSessionOptions = {},
): Promise<RenderSession> {
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

  // ONE mutable file map for the session: the server holds it by reference,
  // and each renderStill re-resolves the (possibly edited) document's assets
  // into it, so new assets become servable without restarting anything.
  const files = new Map<string, string>();
  let server: HarnessServer | undefined;
  let page: Page | undefined;
  const browser = await launchBrowser(options.browser);
  const errors: string[] = [];
  try {
    server = await startHarnessServer({ harnessScriptPath, files });
    page = await browser.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(server.url);
    await page.waitForFunction(() => typeof window.__miraiRenderStill === "function");
  } catch (error) {
    await page?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await server?.close();
    throw error;
  }
  const readyPage = page;
  const readyServer = server;

  // One page renders one frame at a time — serialize callers instead of
  // letting two renders interleave on the same compositor.
  let queue: Promise<unknown> = Promise.resolve();
  let closed = false;

  return {
    renderStill(doc, stillOptions) {
      const run = queue.then(async (): Promise<Uint8Array> => {
        if (closed) throw new Error("render session is closed");
        const resolved = resolveAssetSources(doc, {
          assets: options.assets,
          assetsDir: options.assetsDir,
          exists: existsSync,
        });
        files.clear();
        for (const [urlPath, filePath] of resolved.files) files.set(urlPath, filePath);

        errors.length = 0;
        const base64 = await readyPage
          .evaluate(
            ([stillDoc, opts]) => window.__miraiRenderStill(stillDoc, opts),
            [
              resolved.doc,
              {
                timeUs: stillOptions.timeUs,
                ...(stillOptions.width !== undefined ? { width: stillOptions.width } : {}),
                ...(stillOptions.height !== undefined ? { height: stillOptions.height } : {}),
              },
            ] as const,
          )
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            const context =
              errors.length > 0 ? `\npage errors:\n  ${errors.slice(-5).join("\n  ")}` : "";
            throw new Error(`render still failed: ${message}${context}`);
          });
        return Uint8Array.from(Buffer.from(base64, "base64"));
      });
      queue = run.catch(() => undefined); // a failed render never wedges the queue
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
