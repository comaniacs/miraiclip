import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", define: "src/define.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  platform: "browser",
  // Live (document) playback loads core + renderer on demand; video playback needs neither.
  external: ["@miraiclip/core", "@miraiclip/renderer"],
});
