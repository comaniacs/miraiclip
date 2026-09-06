/**
 * Minimal Node example for @miraiclip/server-export.
 *
 * From the repo root:
 *   pnpm install && pnpm --filter @miraiclip/server-export build
 *   node examples/server-export/export.mjs
 *
 * Uses your installed Google Chrome by default; point MIRAICLIP_BROWSER at
 * any Chrome/Chromium binary to override. MP4 needs real Chrome (H.264);
 * pass "webm" below for free-Chromium environments.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// In your own project: import { exportProjectFile } from "@miraiclip/server-export";
import { exportProjectFile } from "../../packages/server-export/dist/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const doc = JSON.parse(await readFile(path.join(here, "project.json"), "utf8"));

const { filePath, bytes } = await exportProjectFile(doc, {
  format: process.env.MIRAICLIP_FORMAT ?? "mp4", // "webm" works on any Chromium; mp4 needs real Chrome
  quality: "high",
  out: path.join(here, `out.${process.env.MIRAICLIP_FORMAT ?? "mp4"}`),
  // Relative asset srcs in project.json resolve against this directory.
  assetsDir: here,
  onProgress: (p) => {
    const line =
      p.phase === "audio"
        ? `audio ${Math.round((p.audioMixedUs ?? 0) / 1e6)}s/${Math.round((p.audioTotalUs ?? 0) / 1e6)}s`
        : `${p.phase} ${p.framesDone}/${p.totalFrames}`;
    process.stdout.write(`\r${line}      `);
  },
});

console.log(`\nexported ${filePath} (${(bytes.length / 1024).toFixed(0)} KB)`);
