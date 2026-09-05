import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Point workspace packages at their TypeScript source: no pre-build needed
// for `pnpm dev`, and edits in packages/* hot-reload instantly.
export default defineConfig({
  resolve: {
    alias: {
      "@miraiclip/core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
      "@miraiclip/renderer": fileURLToPath(
        new URL("../../packages/renderer/src/index.ts", import.meta.url),
      ),
    },
  },
});
