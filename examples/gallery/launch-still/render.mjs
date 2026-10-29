// Render "STILL" end to end: picture (frame by frame, headless Chrome), score (synthesized), mux, and validate.
//
//   node build.mjs && node render.mjs [--blur] [--draft] [--workers 4]
//
// --blur      shutter motion blur (180°): slower, for the final
// --draft     standard quality, no blur
// --workers   parallel browsers for the picture (default 4)
// --mux-only  keep the rendered picture, redo score + mux + validation
// Writes out/still.mp4 and prints a validation summary. The picture goes through `pnpm mc` (the export CLI from
// source), which rebuilds any stale bundle first.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { T } from "./timeline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = (f) => path.join(here, "out", f);
const blur = process.argv.includes("--blur"), draft = process.argv.includes("--draft");
const wi = process.argv.indexOf("--workers"), workers = wi > 0 ? process.argv[wi + 1] : "4";
fs.mkdirSync(path.join(here, "out"), { recursive: true });

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(" ")}… failed:\n${r.stderr}`);
  return r.stdout + r.stderr;
}

// 1 · picture (--mux-only reuses the last picture: for audio-only changes)
const muxOnly = process.argv.includes("--mux-only");
const started = Date.now();
const mc = path.join(here, "../../../scripts/mc.mjs");
const pic = muxOnly ? { status: 0 } : spawnSync("node", [mc, path.join(here, "video.miraiclip.json"), "--out", out("still-picture.mp4"), "--quality", draft ? "standard" : "high", "--workers", workers, ...(blur && !draft ? ["--motion-blur"] : []), "--quiet"], { stdio: "inherit" });
if (pic.status !== 0) throw new Error("picture render failed");
process.stderr.write(`picture done in ${((Date.now() - started) / 1000).toFixed(0)} s on ${workers} workers${blur ? " (motion blur)" : ""}\n`);

// 2 · score
run("node", [path.join(here, "audio.mjs"), out("still-score.wav")]);

// 3 · mux: the picture stream as rendered, the score loudness-normalized for the web (-16 LUFS, -1.5 dBTP)
run("ffmpeg", ["-v", "error", "-y", "-i", out("still-picture.mp4"), "-i", out("still-score.wav"),
  "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.79:attack=1:release=60:level=disabled", "-ar", "48000",
  "-c:a", "aac", "-b:a", "192k", "-t", String(T.DUR), "-movflags", "+faststart", out("still.mp4")]);

// 4 · validate what was actually written, not what was asked for
const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-count_frames", "-of", "json", out("still.mp4")]));
const v = probe.streams.find((s) => s.codec_type === "video"), a = probe.streams.find((s) => s.codec_type === "audio");
const loud = run("ffmpeg", ["-hide_banner", "-i", out("still.mp4"), "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"]);
const I = /I:\s+(-?[\d.]+) LUFS/.exec(loud.slice(loud.lastIndexOf("Summary")))?.[1], TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(loud.slice(loud.lastIndexOf("Summary")))?.[1];
const summary = {
  file: out("still.mp4"),
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
