/* Smoke test for the docs live-example widget: serves docs/static/examples,
   clicks Run in each block, and asserts pixels/status like the e2e suite. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright-core";

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../docs/static/examples");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".webm": "video/webm", ".mp4": "video/mp4" };

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const path = pathname === "/test-live.html" ? join(HERE, "test-live.html") : join(ROOT, pathname);
  try {
    const data = await readFile(path);
    const type = TYPES[extname(path)] ?? "application/octet-stream";
    // Range support: mediabunny seeks by byte range.
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : data.length - 1;
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${data.length}`,
        "Content-Length": end - start + 1,
        "Accept-Ranges": "bytes",
      });
      res.end(data.subarray(start, end + 1));
    } else {
      res.writeHead(200, { "Content-Type": type, "Content-Length": data.length, "Accept-Ranges": "bytes" });
      res.end(data);
    }
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(8788, resolve));

const browser = await chromium.launch({
  executablePath: process.env["MIRAICLIP_CHROMIUM"] ?? "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
await page.goto("http://127.0.0.1:8788/test-live.html");

const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
  if (!ok) failures.push(name);
};

async function census(id) {
  return page.evaluate((blockId) => {
    const canvas = document.querySelector(`#${blockId} canvas`);
    if (!canvas) return null;
    const probe = document.createElement("canvas");
    probe.width = canvas.width; probe.height = canvas.height;
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
    const result = { nonBlack: 0, green: 0, red: 0, white: 0, blue: 0, warm: 0, cool: 0, yellow: 0 };
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r + g + b > 40) result.nonBlack++;
      if (g > 200 && r < 60 && b < 60) result.green++;
      if (r > 140 && g < 80 && b < 80) result.red++;
      if (r >= 240 && g >= 240 && b >= 240) result.white++;
      else if (b >= 240 && r <= 40 && g <= 40) result.blue++;
      if (r > b + 20) result.warm++;
      else if (b > r + 20) result.cool++;
      if (r > 200 && g > 160 && b < 80) result.yellow++;
    }
    return result;
  }, id);
}

async function run(id) {
  await page.click(`#${id} .mirai-example-run`);
}

async function status(id) {
  return page.textContent(`#${id} .mirai-example-status`);
}

async function poll(fn, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) return false;
    await page.waitForTimeout(300);
  }
}

// 1 — carousel group: run variant 0, then switching tabs auto-runs variant 1.
await run("grp-transitions");
check("group variant renders", !!(await poll(async () => {
  const c = await census("grp-transitions");
  return c && c.nonBlack > 50_000 ? c : false;
})));
check("group tabs present", (await page.locator("#grp-transitions .mirai-variant-tabs button").count()) === 2);
await page.click("#grp-transitions .mirai-variant-tabs button:nth-child(2)");
await page.waitForTimeout(500);
check("variant switch reruns", !!(await poll(async () => {
  const c = await census("grp-transitions");
  const cls = await page.getAttribute("#grp-transitions .mirai-example-status", "class");
  return c && c.nonBlack > 10_000 && !cls?.includes("error") ? c : false;
})));
check("active code switched", (await page.textContent("#grp-transitions .mirai-variant.active")).includes("dipToBlack"));

// 2 — chroma key: red box present, green screen gone.
await run("ex-chroma");
check("chroma keys out green", !!(await poll(async () => {
  const c = await census("ex-chroma");
  return c && c.red > 2_000 && c.green < 500 ? c : false;
})), JSON.stringify(await census("ex-chroma")));

// 3 — caption: white + blue words on screen.
await run("ex-caption");
check("caption words render", !!(await poll(async () => {
  const c = await census("ex-caption");
  return c && c.white > 200 && c.blue > 200 ? c : false;
})), JSON.stringify(await census("ex-caption")));


// 4 — custom kinds: a registered sepia effect (r ≥ g ≥ b everywhere — the
// frame skews warm, never cool), a registered flash transition, and a custom
// typewriter CLIP KIND whose node types white text via tick() — all through
// the public registration APIs exposed to snippets.
await run("ex-custom");
check("custom effect + transition + clip kind render", !!(await poll(async () => {
  const c = await census("ex-custom");
  const cls = await page.getAttribute("#ex-custom .mirai-example-status", "class");
  return c && c.nonBlack > 50_000 && c.warm > 30_000 && c.cool < 1_000 && c.white > 150 && !cls?.includes("error") ? c : false;
})), JSON.stringify(await census("ex-custom")));

// 4b — custom caption style: the wordPop clip kind shows one big yellow word
// at a time, animated by tick().
await run("ex-caption-custom");
check("custom caption (wordPop) renders", !!(await poll(async () => {
  const c = await census("ex-caption-custom");
  const cls = await page.getAttribute("#ex-caption-custom .mirai-example-status", "class");
  return c && c.yellow > 500 && !cls?.includes("error") ? c : false;
})), JSON.stringify(await census("ex-caption-custom")));

// 4c — html clip: the template rasterizes and composites (solid red card).
await run("ex-html");
check("html clip renders", !!(await poll(async () => {
  const c = await census("ex-html");
  const cls = await page.getAttribute("#ex-html .mirai-example-status", "class");
  return c && c.red > 2_000 && !cls?.includes("error") ? c : false;
})), JSON.stringify(await census("ex-html")));

// 4d — banner ad html clip: a full-page ad (cream/orange palette, inline SVG
// can) rasterizes and dominates the frame — the canvas skews strongly warm.
await run("ex-html-banner");
check("html banner ad renders", !!(await poll(async () => {
  const c = await census("ex-html-banner");
  const cls = await page.getAttribute("#ex-html-banner .mirai-example-status", "class");
  return c && c.warm > 120_000 && c.nonBlack > 180_000 && !cls?.includes("error") ? c : false;
})), JSON.stringify(await census("ex-html-banner")));

// 5 — export: status reaches "exported N bytes".
await run("ex-export");
const exported = await poll(async () => {
  const text = await status("ex-export");
  return text?.startsWith("exported ") ? text : false;
}, 60000);
check("export completes", !!exported, String(exported));

const realErrors = consoleErrors.filter((e) => !e.includes("favicon") && !e.includes("404"));
check("no console errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

await browser.close();
server.close();
if (failures.length > 0) { console.log("FAILURES:", failures.join(", ")); process.exit(1); }
console.log("ALL GREEN");
