/**
 * Batch rendering (Node-only): hydrate a template once per data row and
 * export each hydrated document through ONE (or a few) warm headless-Chrome
 * export sessions — `createExportSession` keeps the browser alive across
 * rows, so a row costs an export, not a browser launch.
 *
 * Import path: `@miraiclip/templates/render` — kept out of the main entry so
 * browser bundles never touch playwright.
 */
import {
  createExportSession,
  type CreateExportSessionOptions,
  type ExportFileOptions,
} from "@miraiclip/server-export";
import { tryHydrate } from "./hydrate.js";
import type { Template, TemplateData, TemplateIssue } from "./types.js";

export interface BatchRow {
  index: number;
  data: TemplateData;
  ok: boolean;
  /** Set on success. */
  filePath?: string;
  bytesWritten?: number;
  /** Set on failure: hydration issues, or the export error message. */
  issues?: TemplateIssue[];
  error?: string;
}

export interface BatchProgress {
  rowsDone: number;
  totalRows: number;
  /** The row that just finished. */
  row: BatchRow;
}

export interface RenderTemplateBatchOptions
  extends Omit<ExportFileOptions, "out" | "onProgress" | "signal">,
    Pick<CreateExportSessionOptions, "assets" | "assetsDir" | "browser"> {
  /**
   * Where each row's file goes: a pattern with `{field}` placeholders (any
   * template field plus `{index}`), or a function of the row. Parent
   * directories are created.
   */
  out: string | ((data: TemplateData, index: number) => string);
  /** Warm export sessions (= browsers) working the rows (default 1). */
  concurrency?: number;
  /** Stop scheduling new rows after the first failure (default: keep going). */
  stopOnError?: boolean;
  onProgress?: (progress: BatchProgress) => void;
  signal?: AbortSignal;
}

export interface RenderTemplateBatchResult {
  rows: BatchRow[];
  /** The rows that failed (empty means a clean batch). */
  failed: BatchRow[];
}

function outPathFor(
  out: RenderTemplateBatchOptions["out"],
  data: TemplateData,
  index: number,
): string {
  if (typeof out === "function") return out(data, index);
  return out.replace(/\{([\w.-]+)\}/g, (whole, name: string) => {
    if (name === "index") return String(index);
    const value = data[name];
    if (value === undefined || typeof value === "object") return whole;
    // A filename component, not markup: keep it path-safe.
    return String(value).replace(/[/\\:*?"<>|\s]+/g, "-");
  });
}

/**
 * Render every row of `rows` through the template. Rows that fail (bad
 * payload, missing media) are reported per row and never abort the others,
 * unless `stopOnError` asks for that.
 */
export async function renderTemplateBatch(
  template: Template,
  rows: TemplateData[],
  options: RenderTemplateBatchOptions,
): Promise<RenderTemplateBatchResult> {
  const {
    out,
    concurrency = 1,
    stopOnError = false,
    onProgress,
    signal,
    assets,
    assetsDir,
    browser,
    ...exportOptions
  } = options;

  const results: BatchRow[] = rows.map((data, index) => ({ index, data, ok: false }));
  let next = 0;
  let done = 0;
  let stopped = false;

  const sessionCount = Math.max(1, Math.min(concurrency, rows.length || 1));
  const sessions = await Promise.all(
    Array.from({ length: sessionCount }, () =>
      createExportSession({
        ...(assets !== undefined ? { assets } : {}),
        ...(assetsDir !== undefined ? { assetsDir } : {}),
        ...(browser !== undefined ? { browser } : {}),
      }),
    ),
  );

  try {
    await Promise.all(
      sessions.map(async (session) => {
        for (;;) {
          if (stopped || signal?.aborted) return;
          const index = next++;
          if (index >= rows.length) return;
          const row = results[index]!;

          const hydrated = tryHydrate(template, row.data);
          if (!hydrated.ok) {
            row.issues = hydrated.issues;
            row.error = `invalid data: ${hydrated.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`;
          } else {
            try {
              const result = await session.exportFile(hydrated.doc, {
                ...exportOptions,
                out: outPathFor(out, row.data, index),
                ...(signal ? { signal } : {}),
              });
              row.ok = true;
              row.filePath = result.filePath!;
              row.bytesWritten = result.bytesWritten!;
            } catch (error) {
              row.error = error instanceof Error ? error.message : String(error);
            }
          }
          if (!row.ok && stopOnError) stopped = true;
          done++;
          onProgress?.({ rowsDone: done, totalRows: rows.length, row });
        }
      }),
    );
  } finally {
    await Promise.all(sessions.map((session) => session.close().catch(() => undefined)));
  }

  for (const row of results) {
    if (!row.ok && row.error === undefined && row.issues === undefined) {
      row.error = signal?.aborted ? "not attempted (aborted)" : "not attempted (stopOnError)";
    }
  }
  return { rows: results, failed: results.filter((row) => !row.ok) };
}
