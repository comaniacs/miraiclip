import { chromium, type Browser, type LaunchOptions } from "playwright-core";
import type { BrowserOptions } from "./types.js";

/**
 * Launch order: explicit `executablePath` → `MIRAICLIP_BROWSER` env → the
 * machine's installed Chrome (Playwright's "chrome" channel). We depend on
 * playwright-core (no forced browser download at install); real Chrome is
 * the recommended runtime because it ships the proprietary H.264/AAC
 * encoders — free Chromium builds export WebM only.
 */
export async function launchBrowser(options: BrowserOptions = {}): Promise<Browser> {
  const swiftshader = options.swiftshader ?? process.platform === "linux";
  const args = [
    // Media exports are long CPU-bound page tasks — never throttle them.
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--autoplay-policy=no-user-gesture-required",
    ...(swiftshader ? ["--use-angle=swiftshader"] : []),
    ...(options.args ?? []),
  ];
  const launch: LaunchOptions = { headless: true, args };

  const executablePath = options.executablePath ?? process.env["MIRAICLIP_BROWSER"];
  if (executablePath) {
    return chromium.launch({ ...launch, executablePath });
  }
  try {
    return await chromium.launch({ ...launch, channel: "chrome" });
  } catch (error) {
    throw new Error(
      "no browser found: install Google Chrome, or pass browser.executablePath " +
        "(or set MIRAICLIP_BROWSER) pointing at any Chrome/Chromium binary — " +
        "e.g. one installed via `npx playwright install chrome`. " +
        `(${error instanceof Error ? error.message.split("\n")[0] : String(error)})`,
    );
  }
}
