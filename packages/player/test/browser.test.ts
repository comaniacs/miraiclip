/**
 * <miraiclip-player> in real headless Chromium: a rendered WebM with a
 * chapters file, and a live document with markers (WebCodecs + WebGL). The
 * element, core and renderer are bundled with esbuild and served from a
 * loopback server with the playground's media fixtures.
 */
import { createServer, type Server } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(here, "../../../apps/playground/public");
const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));

const DOC = {
  schemaVersion: 1,
  settings: { width: 320, height: 180, fps: 30 },
  assets: { media: { id: "media", kind: "video", src: "e2e-frames.webm", durationUs: 4_000_000 } },
  tracks: { v1: { id: "v1", kind: "video", name: "v1", muted: true, solo: false, locked: false } },
  trackOrder: ["v1"],
  clips: {
    c: { id: "c", kind: "video", trackId: "v1", assetId: "media", startUs: 0, durationUs: 4_000_000, trimStartUs: 0, volume: 0, transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 } },
  },
  transitions: {},
  markers: {
    m1: { id: "m1", timeUs: 0, label: "Intro" },
    m2: { id: "m2", timeUs: 1_500_000, label: "Middle" },
    m3: { id: "m3", timeUs: 3_000_000, label: "End" },
  },
};

describe.skipIf(!browserPath)("<miraiclip-player> in Chromium", () => {
  let server: Server;
  let browser: Browser;
  let page: Page;
  let base = "";

  beforeAll(async () => {
    const bundle = await build({
      stdin: {
        contents: `import "${path.resolve(here, "../src/define.ts")}";`,
        resolveDir: here,
        loader: "ts",
      },
      bundle: true,
      format: "esm",
      write: false,
      platform: "browser",
      target: "es2022",
      // Workspace packages resolve to their TypeScript sources.
      conditions: ["import"],
      logLevel: "silent",
    });
    const js = bundle.outputFiles[0]!.text;
    const files: Record<string, { type: string; body: Buffer | string }> = {
      "/player.js": { type: "text/javascript", body: js },
      "/doc.json": { type: "application/json", body: JSON.stringify(DOC) },
      "/chapters.vtt": { type: "text/vtt", body: "WEBVTT\n\n00:00.000 --> 00:02.000\nOne\n\n00:02.000 --> 00:04.000\nTwo\n" },
      "/": {
        type: "text/html",
        body: `<!doctype html><body style="margin:0;width:640px">
<miraiclip-player id="file" src="e2e-frames.webm" chapters="chapters.vtt" controls muted style="width:320px"></miraiclip-player>
<miraiclip-player id="live" document="doc.json" controls style="width:320px"></miraiclip-player>
<script type="module" src="player.js"></script></body>`,
      },
    };
    server = createServer((req, res) => {
      const url = (req.url ?? "/").split("?")[0]!;
      const hit = files[url];
      if (hit) {
        res.writeHead(200, { "content-type": hit.type });
        res.end(hit.body);
        return;
      }
      const file = path.join(FIXTURES, url);
      if (existsSync(file)) {
        // Media elements only seek when the server honours byte ranges.
        const body = readFileSync(file);
        const type = url.endsWith(".webm") ? "video/webm" : "application/octet-stream";
        const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
        if (range) {
          const start = range[1] ? Number(range[1]) : 0;
          const end = range[2] ? Number(range[2]) : body.length - 1;
          res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${body.length}`, "content-length": end - start + 1 });
          res.end(body.subarray(start, end + 1));
        } else {
          res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": body.length });
          res.end(body);
        }
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    base = `http://127.0.0.1:${address.port}/`;
    browser = await chromium.launch({ executablePath: browserPath!, args: ["--autoplay-policy=no-user-gesture-required", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
    page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForFunction(() => ["file", "live"].every((id) => document.getElementById(id)?.hasAttribute("data-ready")), null, { timeout: 30_000 }).catch((e) => {
      throw new Error(`players never got ready: ${errors.join("; ")} ${e}`);
    });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it("plays a rendered file with chapters from a VTT track", async () => {
    await page.waitForFunction(() => (document.getElementById("file") as unknown as { duration: number }).duration > 3.9);
    const info = await page.evaluate(() => {
      const el = document.getElementById("file") as unknown as { chapters: { label: string }[]; shadowRoot: ShadowRoot };
      return {
        chapters: el.chapters.map((c) => c.label),
        ticks: el.shadowRoot.querySelectorAll(".tick").length,
        menu: el.shadowRoot.querySelectorAll(".menu button").length,
      };
    });
    expect(info).toEqual({ chapters: ["One", "Two"], ticks: 1, menu: 2 });
    const chapter = await page.evaluate(async () => {
      const el = document.getElementById("file") as unknown as HTMLElement & { goToChapter(i: number): void; currentTime: number };
      const changed = new Promise<string>((resolve) =>
        el.addEventListener("chapterchange", (e) => resolve((e as CustomEvent).detail.chapter?.label), { once: true }),
      );
      el.goToChapter(1);
      return { label: await changed, time: el.currentTime };
    });
    expect(chapter.label).toBe("Two");
    expect(chapter.time).toBeCloseTo(2, 1);
    await page.evaluate(() => (document.getElementById("file") as unknown as { play(): void }).play());
    await page.waitForFunction(() => (document.getElementById("file") as unknown as { currentTime: number }).currentTime > 2.3);
  }, 30_000);

  it("plays a live document: chapters from markers, seeking, a drawn frame", async () => {
    const info = await page.evaluate(() => {
      const el = document.getElementById("live") as unknown as { chapters: { label: string }[]; duration: number };
      return { chapters: el.chapters.map((c) => c.label), duration: el.duration };
    });
    expect(info).toEqual({ chapters: ["Intro", "Middle", "End"], duration: 4 });
    await page.evaluate(() => (document.getElementById("live") as unknown as { goToChapter(id: string): void }).goToChapter("m2"));
    await page.waitForFunction(() => (document.getElementById("live") as HTMLElement).shadowRoot!.querySelector(".label")!.textContent === "Middle", null, { timeout: 5_000 });
    await page.evaluate(() => (document.getElementById("live") as unknown as { play(): void }).play());
    await page.waitForFunction(() => (document.getElementById("live") as unknown as { currentTime: number }).currentTime > 2, null, { timeout: 15_000 });
    // The canvas shows real video (the fixture's frames are flat colours, never black).
    const shot = await page.locator("#live").screenshot();
    if (process.env["MIRAICLIP_PLAYER_SHOT"]) {
      await page.evaluate(() => {
        const el = document.getElementById("live") as HTMLElement & { pause(): void };
        el.pause();
        el.shadowRoot!.querySelector<HTMLElement>(".chapters")!.click();
      });
      (await import("node:fs")).writeFileSync(process.env["MIRAICLIP_PLAYER_SHOT"], await page.locator("#live").screenshot());
    }
    const { PNG } = await import("./png.js");
    const pixel = PNG.center(shot);
    expect(pixel.reduce((a, b) => a + b, 0), `center pixel ${pixel}`).toBeGreaterThan(60);
  }, 30_000);
});
