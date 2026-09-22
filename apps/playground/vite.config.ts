import { defineConfig } from "vite";

// Workspace packages resolve to their TypeScript source via their dev
// `exports` (see each package.json; publishConfig swaps in dist on publish),
// so no aliases are needed and edits in packages/* hot-reload directly.
export default defineConfig({
  worker: {
    // The export worker bundles pixi + the renderer; ES format keeps
    // code-splitting legal inside the worker build (iife forbids it).
    format: "es",
  },
});
