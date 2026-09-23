import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", render: "src/render.ts", cli: "src/cli.ts" },
  format: ["esm", "cjs"],
  dts: { entry: { index: "src/index.ts", render: "src/render.ts" } },
  sourcemap: true,
  clean: true,
  target: "es2022",
  platform: "node",
  // Real runtime dependencies stay external — the workspace packages resolve
  // to their published dist at install time. The render entry and CLI are
  // Node-only (they pull in @miraiclip/server-export); the main entry imports
  // no Node builtins, so it stays environment-agnostic like core.
  external: ["@miraiclip/core", "@miraiclip/server-export", "zod"],
});
