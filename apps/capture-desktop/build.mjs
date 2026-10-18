// Bundles the main process, preload and the three windows' scripts into dist/, and copies the pages.
// `--test` also bundles the unit tests into dist-test/ (run with `node --test dist-test/`).
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const test = process.argv.includes("--test");
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
const common = { bundle: true, logLevel: "info", sourcemap: "linked" };
await Promise.all([
  // Main process + preload: Node/CommonJS; electron and the native hook stay external.
  build({ ...common, entryPoints: { main: "src/main/main.ts", preload: "src/preload.ts" }, platform: "node", format: "cjs", target: "node22", outdir: "dist", outExtension: { ".js": ".cjs" }, external: ["electron", "uiohook-napi"] }),
  // Windows: plain browser scripts (loaded with <script defer> from file://).
  build({ ...common, entryPoints: { recorder: "src/renderer/recorder.ts", pill: "src/renderer/pill.ts", camera: "src/renderer/camera.ts" }, platform: "browser", format: "iife", target: "chrome140", outdir: "dist" }),
  ...(test ? [build({ ...common, entryPoints: ["test/input-log.test.ts"], platform: "node", format: "esm", target: "node22", outdir: "dist-test", outExtension: { ".js": ".mjs" } })] : []),
]);
cpSync("static/pages", "dist/pages", { recursive: true });
