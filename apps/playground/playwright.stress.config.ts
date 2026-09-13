import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * Stress tier — NOT part of the per-commit suite. Long-running scenarios that
 * prove production ceilings: many-clip timelines, long exports with bounded
 * memory, asset churn past the decoder cap, and a throughput benchmark.
 * Run with `pnpm stress` (root) or `pnpm --filter miraiclip-playground stress`.
 *
 * Knobs (env):
 *   STRESS_MINUTES  — long-export timeline length in minutes (default 5)
 *   STRESS_MIN_FPS  — throughput floor in encoded frames/sec (default 5)
 */
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const executablePath = existsSync(systemChromium) ? systemChromium : undefined;

export default defineConfig({
  testDir: "./stress",
  // Generous global cap; the long-export spec sets its own from STRESS_MINUTES.
  timeout: 30 * 60_000,
  retries: 0, // a stress failure is signal, never flake to be retried away
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5199",
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: [
        "--autoplay-policy=no-user-gesture-required",
        "--use-angle=swiftshader",
        // Real heap numbers (performance.memory) + window.gc() so samples
        // measure live objects, not GC scheduling noise.
        "--enable-precise-memory-info",
        "--js-flags=--expose-gc",
      ],
    },
  },
  webServer: {
    command: "pnpm build && pnpm preview --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
