#!/usr/bin/env node
/**
 * miraiclip-templates — batch-render a template from the command line.
 *
 *   miraiclip-templates render template.json --data rows.json --out "out/{name}.mp4"
 *   miraiclip-templates describe template.json
 *
 * Data rows: a JSON array of objects (.json), one JSON object per line
 * (.ndjson/.jsonl), or CSV with a header row (.csv — values coerce to each
 * field's declared type). Output format comes from --format or the --out
 * extension. All diagnostics go to stderr; stdout stays clean.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { describeTemplate } from "./ai.js";
import { rowsFromCsv, rowsFromNdjson } from "./data.js";
import { parseTemplate } from "./define.js";
import { renderTemplateBatch } from "./render.js";
import type { Template, TemplateData } from "./types.js";

const USAGE = `Usage:
  miraiclip-templates render <template.json> --data <rows.json|.ndjson|.csv> --out <pattern> [options]
  miraiclip-templates describe <template.json>

Render options:
  --data <file>          Data rows: JSON array, NDJSON, or CSV with a header row (required)
  --out <pattern>        Output path per row; {field} and {index} substitute (required)
  --format mp4|webm      Container (default: from the --out extension)
  --quality draft|standard|high   Quality preset (default standard)
  --fps <n>              Output frame rate (default: the template's)
  --width <n> --height <n>        Output size (default: the composition size)
  --concurrency <n>      Parallel browsers working the rows (default 1)
  --assets-dir <dir>     Base directory for relative asset paths (default: the template file's directory)
  --browser <path>       Chrome/Chromium executable (MP4 needs real Chrome)
  --stop-on-error        Stop scheduling rows after the first failure
`;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function loadTemplate(file: string): Template {
  const raw = readFileSync(file, "utf8");
  return parseTemplate(JSON.parse(raw) as unknown);
}

function loadRows(template: Template, file: string): TemplateData[] {
  const raw = readFileSync(file, "utf8");
  const ext = path.extname(file).toLowerCase();
  if (ext === ".csv") return rowsFromCsv(template, raw);
  if (ext === ".ndjson" || ext === ".jsonl") return rowsFromNdjson(raw);
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) fail(`--data ${file}: expected a JSON array of row objects`);
  return parsed as TemplateData[];
}

interface Flags {
  positional: string[];
  options: Map<string, string>;
  switches: Set<string>;
}

function parseFlags(argv: string[]): Flags {
  const positional: string[] = [];
  const options = new Map<string, string>();
  const switches = new Set<string>();
  const SWITCHES = new Set(["stop-on-error", "help"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      if (SWITCHES.has(name)) switches.add(name);
      else {
        const value = argv[++i];
        if (value === undefined) fail(`--${name} needs a value`);
        options.set(name, value);
      }
    } else positional.push(arg);
  }
  return { positional, options, switches };
}

async function render(flags: Flags): Promise<void> {
  const templateFile = flags.positional[0];
  const dataFile = flags.options.get("data");
  const out = flags.options.get("out");
  if (!templateFile || !dataFile || !out) fail(USAGE);

  const template = loadTemplate(templateFile);
  const rows = loadRows(template, dataFile);
  if (rows.length === 0) fail(`--data ${dataFile}: no rows`);

  const extension = path.extname(out).toLowerCase().replace(".", "");
  const format = (flags.options.get("format") ?? extension) as "mp4" | "webm";
  if (format !== "mp4" && format !== "webm") {
    fail(`cannot infer the container from "${out}" — pass --format mp4|webm`);
  }
  const quality = flags.options.get("quality") as "draft" | "standard" | "high" | undefined;
  const fps = flags.options.get("fps");
  const width = flags.options.get("width");
  const height = flags.options.get("height");
  const concurrency = Number(flags.options.get("concurrency") ?? "1");
  const assetsDir = flags.options.get("assets-dir") ?? path.dirname(path.resolve(templateFile));
  const executablePath = flags.options.get("browser");

  process.stderr.write(`rendering ${rows.length} row(s) of "${template.name}" → ${out}\n`);
  const started = Date.now();
  const { failed } = await renderTemplateBatch(template, rows, {
    out,
    format,
    ...(quality !== undefined ? { quality } : {}),
    ...(fps !== undefined ? { fps: Number(fps) } : {}),
    ...(width !== undefined ? { width: Number(width) } : {}),
    ...(height !== undefined ? { height: Number(height) } : {}),
    concurrency,
    assetsDir,
    ...(executablePath !== undefined ? { browser: { executablePath } } : {}),
    ...(flags.switches.has("stop-on-error") ? { stopOnError: true } : {}),
    onProgress: ({ rowsDone, totalRows, row }) => {
      const status = row.ok
        ? `→ ${row.filePath} (${((row.bytesWritten ?? 0) / 1024).toFixed(0)} KB)`
        : `FAILED: ${row.error}`;
      process.stderr.write(`[${rowsDone}/${totalRows}] row ${row.index} ${status}\n`);
    },
  });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failed.length > 0) {
    process.stderr.write(`${failed.length}/${rows.length} row(s) failed after ${seconds}s\n`);
    process.exit(1);
  }
  process.stderr.write(`done: ${rows.length} file(s) in ${seconds}s\n`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (!command || flags.switches.has("help") || command === "help") {
    process.stderr.write(USAGE);
    process.exit(command ? 0 : 1);
  }
  if (command === "describe") {
    const templateFile = flags.positional[0];
    if (!templateFile) fail(USAGE);
    process.stdout.write(`${describeTemplate(loadTemplate(templateFile))}\n`);
    return;
  }
  if (command === "render") {
    await render(flags);
    return;
  }
  fail(`unknown command "${command}"\n\n${USAGE}`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
