// Render single frames through the real exporter and tile them into a contact sheet, for reviewing the shot
// without a full render.
//
//   node stills.mjs <outDir> 0.5 4.2 9.0 ...   writes <outDir>/f-<t>.png and <outDir>/sheet.png
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const CLI = new URL("../../../packages/server-export/dist/cli.js", import.meta.url).pathname;
const PROJECT = new URL("./video.miraiclip.json", import.meta.url).pathname;

const [outDir, ...times] = process.argv.slice(2);
if (!outDir || times.length === 0) {
  console.error("usage: node stills.mjs <outDir> <t> [t...]");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const pngs = [];
for (const raw of times) {
  const t = Number(raw);
  const mp4 = path.join(outDir, `f-${raw}.mp4`), png = path.join(outDir, `f-${raw}.png`);
  const ex = spawnSync("node", [CLI, PROJECT, "--out", mp4, "--quality", "high", "--start", String(t), "--end", String(t + 0.034), "--quiet"], { encoding: "utf8" });
  if (ex.status !== 0) throw new Error(`export failed for t=${raw}: ${ex.stderr}`);
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", mp4, "-frames:v", "1", png]);
  if (r.status !== 0) throw new Error(`ffmpeg failed for t=${raw}: ${r.stderr}`);
  fs.rmSync(mp4);
  pngs.push(png);
  process.stderr.write(`t=${raw} `);
}
const cols = Math.min(4, pngs.length), rows = Math.ceil(pngs.length / cols);
const inputs = pngs.flatMap((p) => ["-i", p]);
const scaled = pngs.map((_, i) => `[${i}:v]scale=640:360,drawtext=text='${times[i]}s':x=12:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5[s${i}]`).join(";");
const layout = pngs.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join("|");
const filter = `${scaled};${pngs.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${pngs.length}:layout=${layout}:fill=black`;
const single = `[0:v]scale=640:360,drawtext=text='${times[0]}s':x=12:y=10:fontsize=22:fontcolor=white`;
const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", pngs.length > 1 ? filter : single, path.join(outDir, "sheet.png")]);
if (r.status !== 0) throw new Error(`contact sheet failed: ${r.stderr}`);
console.error(`\nwrote ${path.join(outDir, "sheet.png")} (${cols}x${rows})`);
