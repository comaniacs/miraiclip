/**
 * Render cost benchmark: CPU-seconds per minute of output for a typical
 * product video (a screen recording with zooms, an animated cursor, an html
 * lower third and karaoke captions), through the server export path on THIS
 * machine. CPU time is read from /proc/stat across the whole machine, so it
 * includes the browser's processes; run it on an otherwise idle box.
 *
 *   pnpm --filter @miraiclip/server-export bench:cost [-- --seconds 30 --sizes 1080,2160 --format webm]
 *
 * Needs ffmpeg (to make the source footage) and a browser. Prints a table
 * and writes bench/render-cost.json.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyCommands, createProject } from "@miraiclip/core";
import { createExportSession } from "../src/export-session.js";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : fallback;
};
const seconds = Number(arg("seconds", "20"));
const sizes = arg("sizes", "1080").split(",").map(Number);
const format = arg("format", "webm") as "webm" | "mp4";
const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const S = 1_000_000;

/** Total CPU time used by everything on the machine so far, seconds. */
function machineCpuSeconds(): number {
  const line = readFileSync("/proc/stat", "utf8").split("\n")[0]!.trim().split(/\s+/).slice(1).map(Number);
  // user nice system idle iowait irq softirq steal …: busy = all but idle + iowait.
  const busy = line[0]! + line[1]! + line[2]! + line[5]! + line[6]! + (line[7] ?? 0);
  return busy / 100; // USER_HZ
}

function documentFor(height: number) {
  const width = Math.round((height * 16) / 9);
  const p = createProject({ width, height, fps: 30 });
  const dur = seconds * S;
  const words = Array.from({ length: Math.floor(seconds * 2.5) }, (_, i) => ({ text: ["Open", "the", "settings", "and", "turn", "on", "dark", "mode"][i % 8]!, startUs: i * 400_000, durationUs: 350_000 }));
  const commands = [
    { type: "asset/add", payload: { id: "screen", kind: "video", src: `screen-${height}.webm`, durationUs: dur, width, height } },
    { type: "track/add", payload: { id: "v", kind: "video" } },
    { type: "clip/add", payload: { kind: "video", id: "screen", trackId: "v", assetId: "screen", startUs: 0, durationUs: dur } },
    // A zoom in and out every 6 s.
    ...Array.from({ length: Math.floor(seconds / 6) }, (_, i) => [
      { type: "keyframe/set", payload: { clipId: "screen", property: "scale", timeUs: i * 6 * S + 1 * S, value: 1, easing: "easeInOut" } },
      { type: "keyframe/set", payload: { clipId: "screen", property: "scale", timeUs: i * 6 * S + 1.6 * S, value: 1.8, easing: "easeInOut" } },
      { type: "keyframe/set", payload: { clipId: "screen", property: "scale", timeUs: i * 6 * S + 4.4 * S, value: 1.8, easing: "easeInOut" } },
      { type: "keyframe/set", payload: { clipId: "screen", property: "scale", timeUs: i * 6 * S + 5 * S, value: 1, easing: "easeInOut" } },
    ]).flat(),
    { type: "track/add", payload: { id: "o", kind: "video" } },
    { type: "clip/add", payload: { kind: "html", id: "cursor", trackId: "o", startUs: 0, durationUs: dur, widthPx: 64, heightPx: 64, template: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><path d="M32 32 L32 58 L39 51 L44 62 L49 60 L44 49 L54 49 Z" fill="#fff" stroke="#111" stroke-width="2.5"/></svg>`, transform: { scale: height / 1080 } } },
    ...Array.from({ length: seconds }, (_, i) => ({ type: "keyframe/set", payload: { clipId: "cursor", property: "x", timeUs: i * S, value: 0.2 + 0.6 * Math.abs(Math.sin(i)), easing: "easeInOut" } })),
    { type: "track/add", payload: { id: "lt", kind: "video" } },
    { type: "clip/add", payload: { kind: "html", id: "lower-third", trackId: "lt", startUs: 1 * S, durationUs: Math.min(dur - S, 5 * S), animated: true, widthPx: 900, heightPx: 160, template: `<div style="width:900px;height:160px;background:#111827e6;color:#fff;font:600 54px sans-serif;display:flex;align-items:center;padding-left:40px;border-radius:20px;animation:a .6s both"><style>@keyframes a{from{transform:translateX(-60px);opacity:0}}</style>Dark mode in 30 seconds</div>`, transform: { x: 0.3, y: 0.82, scale: height / 1080 } } },
    { type: "track/add", payload: { id: "c", kind: "video" } },
    { type: "clip/add", payload: { kind: "caption", id: "captions", trackId: "c", startUs: 0, durationUs: dur, words, style: { preset: "karaoke" } } },
  ];
  const r = applyCommands(p, commands);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return p.toJSON();
}

if (!browserPath && !process.env["MIRAICLIP_BROWSER"]) console.warn("no browser path found; trying the installed Chrome");
const dir = mkdtempSync(path.join(tmpdir(), "mc-cost-"));
const results: Record<string, unknown>[] = [];
for (const height of sizes) {
  const width = Math.round((height * 16) / 9);
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `testsrc2=size=${width}x${height}:rate=30:duration=${seconds}`, "-f", "lavfi", "-i", `sine=frequency=220:duration=${seconds}`, "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "4M", "-c:a", "libopus", "-shortest", "-y", path.join(dir, `screen-${height}.webm`)]);
  const session = await createExportSession({ assetsDir: dir, browser: { ...(browserPath ? { executablePath: browserPath } : {}), swiftshader: true } });
  try {
    const doc = documentFor(height);
    // Warm-up (font and decoder start-up are per-session costs, not per-minute ones).
    await session.exportFile(doc, { format, range: { startUs: 0, endUs: S }, out: path.join(dir, "warm." + format) });
    const cpu0 = machineCpuSeconds();
    const t0 = performance.now();
    await session.exportFile(doc, { format, out: path.join(dir, `out-${height}.${format}`) });
    const wall = (performance.now() - t0) / 1000;
    const cpu = machineCpuSeconds() - cpu0;
    const minutes = seconds / 60;
    results.push({
      size: `${width}x${height}`,
      fps: 30,
      format,
      outputSeconds: seconds,
      wallSeconds: Math.round(wall * 10) / 10,
      realtimeFactor: Math.round((seconds / wall) * 100) / 100,
      cpuSeconds: Math.round(cpu * 10) / 10,
      cpuSecondsPerOutputMinute: Math.round(cpu / minutes),
      machineCpus: cpus().length,
      cpuModel: cpus()[0]?.model ?? "unknown",
    });
  } finally {
    await session.close();
  }
}
console.table(results);
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "render-cost.json");
writeFileSync(out, `${JSON.stringify({ date: new Date().toISOString(), note: "software GL (SwiftShader), software video encode", results }, null, 2)}\n`);
console.log(`wrote ${out}`);
