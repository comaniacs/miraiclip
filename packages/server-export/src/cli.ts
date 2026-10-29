#!/usr/bin/env node
/**
 * miraiclip-export — export a project document from the command line.
 *
 *   miraiclip-export project.json --out out.mp4 [--format mp4|webm]
 *     [--quality draft|standard|high] [--fps 30] [--width 1920] [--height 1080]
 *     [--start 5] [--end 20]            range, in seconds
 *     [--motion-blur]                   180° shutter motion blur (finals: slower)
 *     [--workers 4]                     render frame-aligned chunks in parallel browsers
 *     [--asset id=path]...              media file per asset id
 *     [--assets-dir dir]                base for relative asset srcs
 *     [--browser /path/to/chrome]       else system Chrome / $MIRAICLIP_BROWSER
 *     [--quiet]
 *
 *   miraiclip-export stills project.json --at 1,9.5,15 [--out-dir stills] [--sheet] [--width 1280]
 *   miraiclip-export check project.json [--clip id] [--json] [--strict]
 *   miraiclip-export doctor [--fix]      build outputs, browser, ffmpeg
 *
 * Run from source inside the monorepo (pnpm mc …), every command first brings the generated bundles and the
 * export harness up to date with their sources, so a render never uses stale code.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseCliArgs } from "./cli-args.js";
import { formatCheck, parseCheckArgs, parseStillsArgs, runCheck, runStills } from "./cli-tools.js";
import { localRunner, renderDistributed } from "./distributed.js";
import { checkBuild, formatDoctor, runDoctor, workspaceRoot } from "./doctor.js";
import { exportProjectFile } from "./export-file.js";
import type { ProjectDocument, ServerExportProgress } from "./types.js";

const readDoc = async (projectPath: string) => JSON.parse(await readFile(projectPath, "utf8")) as ProjectDocument;
const elapsed = (started: number) => ((Date.now() - started) / 1000).toFixed(1);

async function stills(argv: string[]): Promise<void> {
  const args = parseStillsArgs(argv);
  const started = Date.now();
  const files = await runStills(await readDoc(args.projectPath), args, path.dirname(path.resolve(args.projectPath)));
  console.log(`${files.join("\n")}\n(${args.times.length} stills, ${elapsed(started)}s)`);
}

async function check(argv: string[]): Promise<void> {
  const args = parseCheckArgs(argv);
  const result = await runCheck(await readDoc(args.projectPath), args);
  console.log(args.json ? JSON.stringify(result, null, 2) : formatCheck(result));
  if (args.strict && result.findings.length) process.exitCode = 2;
}

async function exportCommand(argv: string[]): Promise<void> {
  const { projectPath, options, quiet, workers } = parseCliArgs(argv);
  const doc = await readDoc(projectPath);
  const controller = new AbortController();
  process.on("SIGINT", () => controller.abort());
  // Relative asset srcs resolve against the project file's directory by default.
  const assetsDir = options.assetsDir ?? path.dirname(path.resolve(projectPath));
  const started = Date.now();

  if (workers > 1) {
    const runner = localRunner({ assetsDir, concurrency: workers, ...(options.assets ? { assets: options.assets } : {}), ...(options.browser ? { browser: options.browser } : {}) });
    try {
      const result = await renderDistributed(doc, {
        format: options.format,
        out: options.out!,
        runner,
        signal: controller.signal,
        ...(options.quality ? { quality: options.quality } : {}),
        ...(options.fps ? { fps: options.fps } : {}),
        ...(options.width ? { width: options.width } : {}),
        ...(options.height ? { height: options.height } : {}),
        ...(options.range ? { range: options.range } : {}),
        ...(options.motionBlur ? { motionBlur: options.motionBlur } : {}),
        ...(quiet ? {} : { onProgress: (p) => process.stderr.write(`\r${p.phase} ${p.jobsDone}/${p.jobsTotal} chunks          `) }),
      });
      if (!quiet) process.stderr.write("\n");
      console.log(`${result.filePath} (${result.chunks.length} chunks on ${workers} workers, ${elapsed(started)}s)`);
    } finally {
      await runner.close?.();
    }
    return;
  }

  const result = await exportProjectFile(doc, {
    ...options,
    assetsDir,
    signal: controller.signal,
    ...(quiet
      ? {}
      : {
          onProgress: (p: ServerExportProgress) => {
            const line =
              p.phase === "audio"
                ? `audio ${Math.round((p.audioMixedUs ?? 0) / 1e6)}s / ${Math.round((p.audioTotalUs ?? 0) / 1e6)}s`
                : `${p.phase} ${p.framesDone}/${p.totalFrames}`;
            process.stderr.write(`\r${line}          `);
          },
        }),
  });
  if (!quiet) process.stderr.write("\n");
  const mb = (((result.bytesWritten ?? result.bytes?.length) ?? 0) / 1_048_576).toFixed(1);
  console.log(`${result.filePath} (${mb} MB, ${elapsed(started)}s)`);
}

async function doctor(argv: string[]): Promise<void> {
  const unknown = argv.find((a) => a !== "--fix");
  if (unknown) throw new Error(`unknown flag ${unknown}`);
  const checks = await runDoctor({ fix: argv.includes("--fix") });
  console.log(formatDoctor(checks));
  if (checks.some((c) => !c.ok)) process.exitCode = 1;
}

/** In the monorepo: refresh stale bundles before any render, and say so. Published installs skip this. */
function preflight(): void {
  const root = workspaceRoot();
  if (!root) return;
  const checks = checkBuild(root, true);
  const changed = checks.filter((c) => c.fixed || !c.ok);
  if (changed.length) process.stderr.write(formatDoctor(changed) + "\n");
  if (checks.some((c) => !c.ok)) throw new Error("preflight failed: fix the build above, or run miraiclip-export doctor");
}

async function main(): Promise<void> {
  const [first, ...rest] = process.argv.slice(2);
  if (first === "doctor") return doctor(rest);
  preflight();
  if (first === "stills") return stills(rest);
  if (first === "check") return check(rest);
  return exportCommand(first === "export" ? rest : process.argv.slice(2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
