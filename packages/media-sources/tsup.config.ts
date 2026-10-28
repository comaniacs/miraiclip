import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // Environment-agnostic (fetch only): runs in browsers, Node 18+, workers.
  platform: "neutral",
  external: ["@miraiclip/core"],
});
