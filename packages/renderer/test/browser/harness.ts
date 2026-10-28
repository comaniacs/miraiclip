/**
 * Browser harness for the stage kit. jsdom has no layout, so anything that
 * measures boxes or pixels runs here, in real Chromium.
 *
 * The browser is found from MIRAICLIP_BROWSER, then the sandbox default, then
 * Playwright's own install. When none can be launched the suite skips.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";
import { ANIME_SOURCE, STAGE_KIT_SOURCE } from "../../src/stage/stage.generated.js";

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = join(here, "../fixtures/shots");

export const SIZES = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const;
export type SizeName = keyof typeof SIZES;

function executablePath(): string | undefined {
  const candidates = [process.env.MIRAICLIP_BROWSER, process.env.PLAYWRIGHT_CHROMIUM_PATH, "/opt/pw-browsers/chromium"];
  return candidates.find((p): p is string => !!p && existsSync(p));
}

let shared: Promise<Browser | null> | null = null;
/** One browser for the whole run; null when none can be launched. */
export function browser(): Promise<Browser | null> {
  shared ??= chromium
    .launch({ executablePath: executablePath(), args: ["--use-angle=swiftshader"] })
    .catch(() => null);
  return shared;
}

export interface Shot {
  page: Page;
  /** Seek the timeline to t seconds and wait a frame. */
  seek(t: number): Promise<void>;
  /** Milliseconds from running the sequence's script to the timeline being ready (build, follow pre-pass, rest checks). */
  buildMs: number;
  /** The stage root's data-stage-* attributes. */
  attrs(): Promise<Record<string, string>>;
  close(): Promise<void>;
}

/**
 * Load a sequence (markup with a `.stage` root and a stage.build script) with
 * the kit and anime.js injected ahead of it, at a given frame size.
 */
export async function openShot(html: string, size: SizeName = "landscape"): Promise<Shot | null> {
  const b = await browser();
  if (!b) return null;
  const page = await b.newPage({ viewport: SIZES[size], deviceScaleFactor: 1 });
  // The kit and anime.js go in as scripts of their own (their source may contain "</script>"),
  // ahead of the sequence's inline script, which is held back until they have run.
  const split = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>\s*$/i.exec(html);
  const markup = split ? html.slice(0, split.index) : html;
  const inline = split ? split[1]! : "";
  const doc = `<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}.stage{position:relative;width:100vw;height:100vh}</style></head><body>${markup}</body></html>`;
  await page.setContent(doc, { waitUntil: "load" });
  await page.addScriptTag({ content: ANIME_SOURCE });
  await page.addScriptTag({ content: STAGE_KIT_SOURCE });
  const started = Date.now();
  if (inline) await page.addScriptTag({ content: inline });
  await page.evaluate(() => (window as unknown as { __miraiclipReady: Promise<void> }).__miraiclipReady);
  const buildMs = Date.now() - started;
  return {
    page,
    buildMs,
    seek: (t) => page.evaluate((time) => (window as unknown as { __miraiclipSeek(t: number): void }).__miraiclipSeek(time), t),
    attrs: () =>
      page.evaluate(() => {
        const out: Record<string, string> = {};
        const root = document.querySelector(".stage")!;
        for (const a of Array.from(root.attributes)) if (a.name.startsWith("data-stage")) out[a.name] = a.value;
        return out;
      }),
    close: () => page.close(),
  };
}

export function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}
