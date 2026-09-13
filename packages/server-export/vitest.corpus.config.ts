import { defineConfig } from "vitest/config";

/**
 * The export validation corpus (Gate 3) — release/nightly tier, never part of
 * the default `*.test.ts` glob. Exports run through the real pipeline
 * (headless Chromium via this package); verification decodes them with
 * ffmpeg/ffprobe — an independent decoder. Long timeout: the full matrix is
 * ~25–35 short exports.
 */
export default defineConfig({
  test: {
    include: ["corpus/**/*.corpus-test.ts"],
    testTimeout: 1_800_000,
    hookTimeout: 120_000,
    // One export at a time — cells share the machine's codec resources.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
