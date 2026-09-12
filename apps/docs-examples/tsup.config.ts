import { defineConfig } from "tsup";

/**
 * One self-contained IIFE — core + renderer (pixi, mediabunny, zod) baked in,
 * version-locked to this repo checkout, served as a static docs asset. The
 * examples page loads it once; nothing else on the site pays for it.
 */
export default defineConfig({
  entry: { "miraiclip-examples": "src/widget.ts" },
  format: ["iife"],
  outDir: "../../docs/static/examples",
  platform: "browser",
  target: "es2022",
  minify: true,
  sourcemap: false,
  clean: false, // the media files live in the same folder
  outExtension: () => ({ js: ".js" }),
});
