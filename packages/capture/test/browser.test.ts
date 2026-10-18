/**
 * The recorder in real headless Chromium: an animated canvas stream stands in
 * for the screen share, the page is clicked while recording, and the result
 * must be a decodable WebM plus a session whose events sit on the same clock.
 */
import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));

describe.skipIf(!browserPath)("startRecording in Chromium", () => {
  let server: Server;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    const bundle = await build({
      stdin: {
        contents: `export * from "${path.resolve(here, "../src/index.ts")}"; export { Input, BlobSource, ALL_FORMATS } from "mediabunny";`,
        resolveDir: here,
        loader: "ts",
      },
      bundle: true,
      format: "esm",
      write: false,
      platform: "browser",
      target: "es2022",
      logLevel: "silent",
    });
    const js = bundle.outputFiles[0]!.text;
    server = createServer((req, res) => {
      if (req.url === "/capture.js") {
        res.writeHead(200, { "content-type": "text/javascript" });
        res.end(js);
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><body style="margin:0"><canvas id="c" width="320" height="180"></canvas>
<button id="save" style="position:absolute;left:200px;top:100px;width:80px;height:30px">Save</button>
<input id="pw" type="password" style="position:absolute;left:10px;top:150px">
<script type="module">import * as m from "/capture.js"; window.capture = m; window.ready = true;</script></body>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as { port: number };
    browser = await chromium.launch({ executablePath: browserPath!, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
    page = await browser.newPage({ viewport: { width: 400, height: 240 } });
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise((resolve) => server?.close(resolve));
  });

  it("records a stream into a decodable WebM with an event log on the same clock", async () => {
    await page.evaluate(async () => {
      const w = window as unknown as Record<string, any>;
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      let frame = 0;
      w.timer = setInterval(() => {
        ctx.fillStyle = `hsl(${(frame++ * 12) % 360} 80% 50%)`;
        ctx.fillRect(0, 0, 320, 180);
      }, 33);
      w.recording = await w.capture.startRecording({ screen: canvas.captureStream(30), events: true });
    });
    await page.waitForTimeout(400);
    await page.click("#save");
    await page.evaluate(() => (window as unknown as Record<string, any>).recording.mark("Saved"));
    await page.click("#pw");
    await page.keyboard.type("hunter2");
    await page.waitForTimeout(400);
    const result = await page.evaluate(async () => {
      const w = window as unknown as Record<string, any>;
      const { screen, session } = await w.recording.stop();
      clearInterval(w.timer);
      const input = new w.capture.Input({ source: new w.capture.BlobSource(screen), formats: w.capture.ALL_FORMATS });
      const track = await input.getPrimaryVideoTrack();
      return {
        bytes: screen.size,
        type: screen.type,
        codec: track?.codec,
        width: track?.displayWidth,
        decodedDuration: await input.computeDuration(),
        session,
      };
    });
    expect(result.bytes).toBeGreaterThan(1000);
    expect(result.type).toBe("video/webm");
    expect(result.codec).toBe("vp9");
    expect(result.width).toBe(320);
    expect(result.decodedDuration).toBeGreaterThan(0.3);

    const s = result.session;
    expect(s.format).toBe(1);
    expect(s.viewport).toMatchObject({ width: 400, height: 240 });
    expect(s.durationUs).toBeGreaterThan(700_000);
    const click = s.events.find((e: { type: string }) => e.type === "click");
    expect(click).toMatchObject({ x: 240, y: 115, target: { selector: "#save", label: "Save" } });
    const marker = s.events.find((e: { type: string }) => e.type === "marker");
    expect(marker.label).toBe("Saved");
    expect(marker.tUs).toBeGreaterThanOrEqual(click.tUs);
    for (const e of s.events) {
      expect(e.tUs).toBeGreaterThanOrEqual(0);
      expect(e.tUs).toBeLessThanOrEqual(s.durationUs);
    }
    const input = s.events.find((e: { type: string }) => e.type === "input");
    expect(input.target.sensitive).toBe(true);
    expect(JSON.stringify(s)).not.toContain("hunter2");
  }, 60_000);
});
