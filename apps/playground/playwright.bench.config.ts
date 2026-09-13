import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Environments with a system-provided Chromium (e.g. a sandbox that forbids
// downloads) can point at it; otherwise Playwright's own browser is used.
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const executablePath = existsSync(systemChromium) ? systemChromium : undefined;

/**
 * The device benchmark tier (production-target gates 1+4): presentation
 * quality and seek latency, measured on ACTUALLY PRESENTED frames via the
 * frame-index fixture's pixel oracle — never render-loop callbacks.
 *
 * Run it on the reference device for publishable numbers (`pnpm bench` on a
 * real machine), and in CI for the software-rendering regression baseline
 * (`BENCH_SOFTWARE=1` forces SwiftShader so the baseline is stable across
 * runners). Unlike the stress tier, gates here are loose sanity floors — the
 * deliverable is the recorded distribution in bench-results.json, which
 * carries the device identity alongside every number.
 */
export default defineConfig({
  testDir: "./bench",
  timeout: 10 * 60_000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5199",
    // HEADED for device runs: headless Chromium renders on SwiftShader (on
    // macOS in particular), which silently turns a "real device" run into a
    // software one. A window appears for the few minutes the bench runs.
    // The CI baseline (BENCH_SOFTWARE=1) stays headless on purpose.
    headless: Boolean(process.env.BENCH_SOFTWARE),
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: [
        // No forced ANGLE backend by default: the point of a device run is
        // the machine's real GPU path. BENCH_SOFTWARE pins SwiftShader for a
        // stable CI baseline.
        ...(process.env.BENCH_SOFTWARE ? ["--use-angle=swiftshader"] : []),
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
  webServer: {
    command: "pnpm build && pnpm preview --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: false,
    stdout: "pipe",
    timeout: 180_000,
  },
});
