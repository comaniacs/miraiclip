import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Environments with a system-provided Chromium (e.g. a sandbox that forbids
// downloads) can point at it; otherwise Playwright's own browser is used.
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const executablePath = existsSync(systemChromium) ? systemChromium : undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  // Serial: parallel pages each run a decoder + software GL — they starve
  // each other on small machines and make media timing meaningless.
  workers: 1,
  use: {
    baseURL: "http://localhost:5199",
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: [
        // The player resumes the AudioContext programmatically; the master
        // clock is the audio clock, so autoplay must not need a gesture.
        "--autoplay-policy=no-user-gesture-required",
        // Explicit software ANGLE: the default backend in headless containers
        // stalls ~90ms per VideoFrame→ImageBitmap copy ("GPU stall due to
        // ReadPixels"), throttling decode to ~10fps and making media timing
        // meaningless. With swiftshader ANGLE, decode runs at full speed.
        "--use-angle=swiftshader",
      ],
    },
  },
  webServer: {
    // Built app, not the dev server: cold Vite transforms peg the CPU for the
    // first seconds, starving the decoder and making timings nondeterministic.
    command: "pnpm build && pnpm preview --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
