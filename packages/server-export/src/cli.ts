#!/usr/bin/env node
/**
 * miraiclip-export — export a project document from the command line.
 *
 *   miraiclip-export project.json --out out.mp4 [--format mp4|webm]
 *     [--quality draft|standard|high] [--fps 30] [--width 1920] [--height 1080]
 *     [--start 5] [--end 20]            range, in seconds
 *     [--asset id=path]...              media file per asset id
 *     [--assets-dir dir]                base for relative asset srcs
 *     [--browser /path/to/chrome]       else system Chrome / $MIRAICLIP_BROWSER
 *     [--quiet]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseCliArgs } from "./cli-args.js";
import { exportProjectFile } from "./export-file.js";
import type { ProjectDocument, ServerExportProgress } from "./types.js";

async function main(): Promise<void> {
  const { projectPath, options, quiet } = parseCliArgs(process.argv.slice(2));
  const doc = JSON.parse(await readFile(projectPath, "utf8")) as ProjectDocument;

  const controller = new AbortController();
  process.on("SIGINT", () => controller.abort());

  const started = Date.now();
  const result = await exportProjectFile(doc, {
    ...options,
    // Relative asset srcs resolve against the project file's directory by default.
    assetsDir: options.assetsDir ?? path.dirname(path.resolve(projectPath)),
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
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const mb = (result.bytes.length / 1_048_576).toFixed(1);
  console.log(`${result.filePath} (${mb} MB, ${seconds}s)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
