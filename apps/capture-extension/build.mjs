// Bundles the scripts and copies the manifest, pages and icons into dist/ (load dist/ as an unpacked extension).
import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["src/content.ts", "src/background.ts", "src/logger.ts", "src/bridge.ts", "src/review.ts"],
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir: "dist",
  logLevel: "info",
});
cpSync("manifest.json", "dist/manifest.json");
cpSync("static", "dist", { recursive: true });
