// Render "Old Light" end to end: picture (frame by frame, headless Chrome), score (synthesized), mux, and validate.
//
//   node build.mjs && ../../../packages/server-export/node_modules/.bin/tsx render.mjs [--blur] [--draft]
//
// --blur   shutter motion blur (180°): slower, for the final
// --draft  standard quality, no blur
// Writes out/old-light.mp4 and prints a validation summary. Run with tsx: the workspace packages export TS source.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { exportProjectFile } from "../../../packages/server-export/src/index.ts";
import { T } from "./timeline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = (f) => path.join(here, "out", f);
const blur = process.argv.includes("--blur"), draft = process.argv.includes("--draft");
fs.mkdirSync(path.join(here, "out"), { recursive: true });

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(" ")}… failed:\n${r.stderr}`);
  return r.stdout + r.stderr;
}

// 1 · picture
const doc = JSON.parse(fs.readFileSync(path.join(here, "video.miraiclip.json"), "utf8"));
const started = Date.now();
await exportProjectFile(doc, {
  format: "mp4",
  quality: draft ? "standard" : "high",
  out: out("old-light-picture.mp4"),
  ...(blur && !draft ? { motionBlur: {} } : {}),
  onProgress: (p) => { if ((p.framesDone ?? 0) % 90 === 0) process.stderr.write(`picture ${p.framesDone ?? 0}/${p.totalFrames ?? "?"}\n`); },
});
process.stderr.write(`\npicture done in ${((Date.now() - started) / 1000).toFixed(0)} s${blur ? " (motion blur)" : ""}\n`);

// 2 · score
run("node", [path.join(here, "audio.mjs"), out("old-light-score.wav")]);

// 3 · mux: the picture stream as rendered, the score loudness-normalized for the web (-16 LUFS, -1.5 dBTP)
run("ffmpeg", ["-v", "error", "-y", "-i", out("old-light-picture.mp4"), "-i", out("old-light-score.wav"),
  "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000",
  "-c:a", "aac", "-b:a", "192k", "-t", String(T.DUR), "-movflags", "+faststart", out("old-light.mp4")]);

// 4 · validate what was actually written, not what was asked for
const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-count_frames", "-of", "json", out("old-light.mp4")]));
const v = probe.streams.find((s) => s.codec_type === "video"), a = probe.streams.find((s) => s.codec_type === "audio");
const loud = run("ffmpeg", ["-hide_banner", "-i", out("old-light.mp4"), "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"]);
const I = /I:\s+(-?[\d.]+) LUFS/.exec(loud.slice(loud.lastIndexOf("Summary")))?.[1], TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(loud.slice(loud.lastIndexOf("Summary")))?.[1];
const summary = {
  file: out("old-light.mp4"),
  sizeMB: +(Number(probe.format.size) / 1048576).toFixed(1),
  container: Number(probe.format.duration),
  video: { codec: v.codec_name, width: v.width, height: v.height, fps: v.r_frame_rate, frames: Number(v.nb_read_frames), duration: Number(v.duration) },
  audio: { codec: a.codec_name, rate: Number(a.sample_rate), channels: a.channels, duration: Number(a.duration), loudnessLUFS: Number(I), truePeakDBFS: Number(TP) },
};
const checks = [
  ["1920x1080", v.width === 1920 && v.height === 1080],
  ["30 fps", v.r_frame_rate === "30/1"],
  ["900 frames", summary.video.frames === T.DUR * T.FPS],
  ["audio within 1 frame of 30 s", Math.abs(summary.audio.duration - T.DUR) < 1 / T.FPS],
  ["no clipping (true peak < 0 dBFS)", summary.audio.truePeakDBFS < 0],
];
console.log(JSON.stringify(summary, null, 2));
checks.forEach(([name, ok]) => console.log(`${ok ? "PASS" : "FAIL"}  ${name}`));
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
