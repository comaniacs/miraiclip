import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", cli: "src/cli.ts" },
  format: ["esm", "cjs"],
  dts: { entry: { index: "src/index.ts" } },
  sourcemap: true,
  clean: true,
  target: "es2022",
  platform: "node",
  // Real runtime dependencies stay external — the workspace packages resolve
  // to their published dist at install time.
  external: ["@miraiclip/core", "@miraiclip/server-export", "@modelcontextprotocol/sdk"],
});
