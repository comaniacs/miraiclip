import { defineConfig } from "vitest/config";

/** Stress tier only — `pnpm stress`. The default `pnpm test` never sees these files. */
export default defineConfig({
  test: {
    include: ["stress/**/*.stress-test.ts"],
    testTimeout: 900_000,
    hookTimeout: 120_000,
  },
});
