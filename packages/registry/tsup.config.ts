import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", cli: "src/cli.ts" },
  format: ["esm", "cjs"],
  dts: { entry: { index: "src/index.ts" } },
  sourcemap: true,
  clean: true,
  target: "es2022",
  platform: "node",
  // The main entry is environment-agnostic (no Node builtins); only the CLI touches the file system.
  external: ["@miraiclip/core", "zod"],
});
