import { defineConfig } from "tsup";

export default defineConfig([
  // Node side: the public API + CLI. playwright-core stays external (a real
  // dependency); everything under node: is built in.
  {
    entry: { index: "src/index.ts", cli: "src/cli.ts" },
    format: ["esm", "cjs"],
    dts: { entry: { index: "src/index.ts" } },
    sourcemap: true,
    clean: true,
    target: "es2022",
    platform: "node",
    external: ["playwright-core"],
  },
  // Browser side: the harness bundle served to the page. Self-contained —
  // @miraiclip/core, @miraiclip/renderer, pixi.js and mediabunny are all
  // bundled in, so the published package is version-locked to the renderer
  // it was built with and consumers install nothing browser-side.
  {
    entry: { harness: "src/harness/main.ts" },
    format: ["iife"],
    outExtension: () => ({ js: ".js" }),
    sourcemap: false,
    minify: true,
    clean: false,
    target: "es2022",
    platform: "browser",
    noExternal: [/.*/],
  },
]);
