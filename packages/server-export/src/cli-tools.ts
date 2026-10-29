/**
 * The review subcommands of miraiclip-export, for iterating on a film without exporting it:
 *
 *   miraiclip-export stills <project.json> --at 1,9.5,15 [--out-dir stills] [--sheet] [--width 1280]
 *     One warm browser renders every requested frame (a still costs ~0.3 s, not a browser launch).
 *   miraiclip-export check <project.json> [--clip id] [--json] [--strict]
 *     The continuous-shot check (carries, framing, rests, rhythm) without the MCP server.
 */
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkShot, type CheckShotResult } from "./check-shot.js";
import { createRenderSession } from "./render-session.js";
import type { BrowserOptions, ProjectDocument } from "./types.js";

export interface StillsArgs {
  projectPath: string;
  /** Seconds. */
  times: number[];
  outDir: string;
  sheet: boolean;
  width?: number;
  browser?: BrowserOptions;
}

export interface CheckArgs {
  projectPath: string;
  clipId?: string;
  json: boolean;
  /** Exit non-zero when there are findings. */
  strict: boolean;
  browser?: BrowserOptions;
}

function flagValue(flag: string, value: string | undefined): string {
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
  return value;
}

/** Pure: argv after `stills` → validated arguments. */
export function parseStillsArgs(argv: string[]): StillsArgs {
  let projectPath: string | undefined;
  let times: number[] | undefined;
  let outDir = "stills";
  let sheet = false;
  let width: number | undefined;
  let browser: BrowserOptions | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--at") {
      times = flagValue(arg, argv[++i]).split(",").map((x) => Number(x.trim()));
      if (times.length === 0 || times.some((t) => !Number.isFinite(t) || t < 0)) throw new Error("--at needs times in seconds, like 1,9.5,15");
    } else if (arg === "--out-dir") outDir = flagValue(arg, argv[++i]);
    else if (arg === "--sheet") sheet = true;
    else if (arg === "--width") {
      width = Number(flagValue(arg, argv[++i]));
      if (!Number.isInteger(width) || width < 16) throw new Error("--width needs a whole number of pixels, 16 or more");
    } else if (arg === "--browser") browser = { executablePath: flagValue(arg, argv[++i]) };
    else if (arg.startsWith("-")) throw new Error(`unknown flag ${arg}`);
    else if (projectPath !== undefined) throw new Error(`unexpected argument ${arg}`);
    else projectPath = arg;
  }
  if (!projectPath) throw new Error("usage: miraiclip-export stills <project.json> --at 1,9.5,15 [--out-dir dir] [--sheet]");
  if (!times) throw new Error("--at is required");
  return { projectPath, times, outDir, sheet, ...(width !== undefined ? { width } : {}), ...(browser ? { browser } : {}) };
}

/** Pure: argv after `check` → validated arguments. */
export function parseCheckArgs(argv: string[]): CheckArgs {
  let projectPath: string | undefined;
  let clipId: string | undefined;
  let json = false;
  let strict = false;
  let browser: BrowserOptions | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--clip") clipId = flagValue(arg, argv[++i]);
    else if (arg === "--json") json = true;
    else if (arg === "--strict") strict = true;
    else if (arg === "--browser") browser = { executablePath: flagValue(arg, argv[++i]) };
    else if (arg.startsWith("-")) throw new Error(`unknown flag ${arg}`);
    else if (projectPath !== undefined) throw new Error(`unexpected argument ${arg}`);
    else projectPath = arg;
  }
  if (!projectPath) throw new Error("usage: miraiclip-export check <project.json> [--clip id] [--json] [--strict]");
  return { projectPath, json, strict, ...(clipId ? { clipId } : {}), ...(browser ? { browser } : {}) };
}

/** Render each still to <outDir>/f-<t>.png; with `sheet`, also tile them into <outDir>/sheet.png (needs ffmpeg). */
export async function runStills(doc: ProjectDocument, args: StillsArgs, assetsDir: string): Promise<string[]> {
  await mkdir(args.outDir, { recursive: true });
  const session = await createRenderSession({ assetsDir, ...(args.browser ? { browser: args.browser } : {}) });
  const files: string[] = [];
  try {
    // a smaller still keeps the composition's aspect ratio
    const size = args.width ? { width: args.width, height: Math.round((args.width * doc.settings.height) / doc.settings.width / 2) * 2 } : {};
    for (const t of args.times) {
      const png = await session.renderStill(doc, { timeUs: Math.round(t * 1e6), ...size });
      const file = path.join(args.outDir, `f-${t}.png`);
      await writeFile(file, png);
      files.push(file);
    }
  } finally {
    await session.close();
  }
  if (args.sheet) files.push(contactSheet(files, args.times, path.join(args.outDir, "sheet.png")));
  return files;
}

/** Tile frames 4 across at 640×360, each labelled with its time. */
export function contactSheet(frames: string[], times: number[], out: string): string {
  const cols = Math.min(4, frames.length);
  const tiles = frames.map((_, i) => `[${i}:v]scale=640:360,drawtext=text='${times[i]}s':x=12:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5[s${i}]`);
  const filter = frames.length === 1
    ? tiles[0]!.replace(/\[s0\]$/, "")
    : `${tiles.join(";")};${frames.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${frames.length}:layout=${frames.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join("|")}:fill=black`;
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...frames.flatMap((f) => ["-i", f]), "-filter_complex", filter, out], { encoding: "utf8" });
  if (r.error) throw new Error(`contact sheet needs ffmpeg on PATH: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`contact sheet failed: ${r.stderr}`);
  return out;
}

/** The check report as readable lines: one block per sequence clip, then the joins between clips. */
export function formatCheck(result: CheckShotResult): string {
  const lines: string[] = [];
  for (const c of result.clips) {
    if (!c.report) {
      lines.push(`clip ${c.clipId}: skipped (${c.skipped})`);
      continue;
    }
    const r = c.report;
    const score = r.score === null ? "n/a" : r.score.toFixed(2);
    lines.push(`clip ${c.clipId} @ ${c.startSec}s · ${r.duration}s · carry score ${score} (${r.carried} carried, ${r.anchored} anchored, ${r.bare} bare, ${r.exempt} exempt)`);
    for (const b of r.boundaries) lines.push(`  ${b.t.toFixed(2).padStart(6)}s ${b.label.padEnd(14)} ${b.kind}${b.survivor ? ` · ${b.survivor}` : ""}`);
    for (const f of r.findings) lines.push(`  ! ${f.rule}${f.t === null ? "" : ` @ ${f.t.toFixed(2)}s`}: ${f.message}\n      → ${f.hint}`);
  }
  for (const f of result.across) lines.push(`! ${f.rule} @ ${f.t}s: ${f.message}\n    → ${f.hint}`);
  lines.push(result.findings.length ? `${result.findings.length} finding(s)` : "clean: no findings");
  return lines.join("\n");
}

export async function runCheck(doc: ProjectDocument, args: CheckArgs): Promise<CheckShotResult> {
  return checkShot(doc, { ...(args.clipId ? { clipId: args.clipId } : {}), ...(args.browser ? { browser: args.browser } : {}) });
}
