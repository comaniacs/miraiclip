import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * Crash-repro tier: reproduce field-reported export failures under FULL
 * process-level memory observation, with a watchdog that aborts the export
 * before it can exhaust the machine (a runaway GPU/unified-memory export can
 * hard-restart a laptop — the JS heap alone never sees it coming).
 *
 * Runs HEADED by default: the suspect capture/decode paths are the real-GPU
 * ones, and headless Chromium falls back to SwiftShader (macOS especially),
 * which silently swaps in the software paths (`cpuCapture`, software decode)
 * and can hide the bug. REPRO_SOFTWARE=1 pins SwiftShader headless for a
 * sandbox/CI run of the same harness.
 *
 *   pnpm --filter miraiclip-playground repro:4k
 */
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const executablePath = existsSync(systemChromium) ? systemChromium : undefined;

export default defineConfig({
  testDir: "./stress",
  testMatch: "fourk-crash-repro.spec.ts",
  timeout: 3 * 60 * 60_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5197",
    headless: Boolean(process.env.REPRO_SOFTWARE),
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: [
        ...(process.env.REPRO_SOFTWARE ? ["--use-angle=swiftshader"] : []),
        "--autoplay-policy=no-user-gesture-required",
        "--enable-precise-memory-info",
        "--js-flags=--expose-gc",
      ],
    },
  },
  webServer: {
    command: "pnpm build && pnpm preview --port 5197 --strictPort",
    url: "http://localhost:5197",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
