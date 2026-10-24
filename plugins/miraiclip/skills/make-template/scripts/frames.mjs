// Capture frames of a project (or template) from a running Miraiclip React studio,
// and lay them out as one contact sheet.
//
//   node frames.mjs <project.miraiclip.json> <out-prefix> <t1,t2,…> [--url http://127.0.0.1:5173] [--cols 4]
//
// Writes <out-prefix>-<t>.png for each time (seconds) and <out-prefix>-sheet.png.
// Needs: `npm i playwright` in the folder you run it from and the studio's dev server running.
// Set CHROME_PATH to use a specific Chromium build. The studio's preview can show a stale
// raster right after a seek, so each frame is captured only once the preview has stopped
// changing; if one still looks blank or wrong, capture that time again before believing it.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
// Resolve playwright from the folder you run in, not from the plugin folder this script lives in.
const { chromium } = createRequire(path.join(process.cwd(), "noop.js"))("playwright");

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const url = opt("--url", process.env.STUDIO_URL ?? "http://127.0.0.1:5173/");
const cols = Number(opt("--cols", "4"));
const [project, out, times] = args;
if (!project || !out || !times) { console.error("usage: node frames.mjs <project.json> <out-prefix> <t1,t2,…> [--url …] [--cols 4]"); process.exit(1); }

const b = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
// Project → Open project… is a hidden file input that accepts .json (projects and templates).
await p.locator('input[type=file][accept*="json"]').first().setInputFiles(path.resolve(project));
await p.waitForTimeout(4000);
// Seek by clicking the timeline ruler. Its labels (00:00, 00:05, 00:10…) share one row; the
// transport clock also shows 00:00, so take the 00:00 that sits on the same row as 00:05.
const labels = await p.evaluate(() => [...document.querySelectorAll("*")]
  .filter((e) => /^00:(00|05)$/.test(e.textContent?.trim() ?? "") && e.children.length === 0)
  .map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), x: r.x, y: r.y }; }));
const five = labels.find((l) => l.t === "00:05");
const zero = five && labels.find((l) => l.t === "00:00" && Math.abs(l.y - five.y) < 2);
if (!zero) throw new Error("could not find the timeline ruler (00:00 and 00:05 on one row)");
const geo = [zero, five];
const x0 = geo[0].x - 2, pps = (geo[1].x - geo[0].x) / 5;
const files = [];
for (const t of times.split(",").map(Number)) {
  await p.mouse.click(x0 + t * pps, geo[0].y + 6); await p.waitForTimeout(800);
  await p.mouse.click(x0 + t * pps + 0.5, geo[0].y + 6);
  // The preview is the largest canvas in the top part of the window (works for 16:9 and 9:16).
  const bb = await p.evaluate(() => {
    const c = [...document.querySelectorAll("canvas")].map((e) => e.getBoundingClientRect()).filter((r) => r.y < 640)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return { x: c.x, y: c.y, width: c.width, height: c.height };
  });
  // Rendering a frame can take seconds (fonts, rasterizing every scene): wait until the
  // preview stops changing for three checks in a row rather than trusting a fixed delay.
  const f = `${out}-${t.toFixed(2)}.png`;
  let last = null, same = 0;
  for (let i = 0; i < 40 && same < 3; i++) {
    await p.waitForTimeout(700);
    const shot = await p.screenshot({ clip: bb });
    same = last && shot.equals(last) ? same + 1 : 0;
    last = shot;
  }
  fs.writeFileSync(f, last);
  files.push(f);
}
// Contact sheet: an HTML grid of the frames, screenshotted.
const imgs = files.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}"/><figcaption>${path.basename(f, ".png").split("-").pop()} s</figcaption></figure>`).join("");
const sheet = await b.newPage({ viewport: { width: 1600, height: 900 } });
await sheet.setContent(`<style>body{margin:0;background:#18181c;font:14px sans-serif;color:#ccc}
.g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px}figure{margin:0}img{width:100%;display:block}figcaption{padding:2px 4px}</style><div class="g">${imgs}</div>`);
await sheet.screenshot({ path: `${out}-sheet.png`, fullPage: true });
console.log(JSON.stringify({ frames: files, sheet: `${out}-sheet.png`, errors: errs.filter((e) => !/assistant|Failed to load resource/.test(e)) }, null, 1));
await b.close();
