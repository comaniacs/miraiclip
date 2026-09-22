import { defineConfig } from "tsup";

export default defineConfig({
  // The worker entry ships as its own file so `new Worker(new URL(
  // "./export.worker.js", import.meta.url), { type: "module" })` resolves next
  // to the main bundle — bundlers rewrite that pattern and bundle the worker
  // graph (bare imports inside a module worker don't resolve without one).
  entry: { index: "src/index.ts", "export.worker": "src/export/worker/export.worker.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["mediabunny", "@miraiclip/core"],
});
