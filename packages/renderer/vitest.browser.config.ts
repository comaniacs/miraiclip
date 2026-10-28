import { defineConfig } from "vitest/config";

/** Real-browser suite for the stage kit: layout, boxes and pixels. Run with `pnpm test:browser`. */
export default defineConfig({
  test: {
    include: ["test/browser/**/*.browser.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
