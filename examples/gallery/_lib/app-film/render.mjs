// app-film kit · render: picture (headless Chrome through `mc`), score, mux, then validation of the written file.
// A film's render.mjs is one line:   renderFilm(import.meta.url, { name: "kiteline", T });
// An edited (cut) film passes cuts: [seconds…]; the validator then fails only on cuts that weren't planned.
//
//   node render.mjs [--draft] [--blur] [--workers 4] [--mux-only]
//
// It always prints how long each stage took, and checks what was written, not what was asked for: size, frame rate,
// frame count, audio length, clipping, hard cuts (ffmpeg scene score) and black frames.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MC = fileURLToPath(new URL("../../../../scripts/mc.mjs", import.meta.url));

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(" ")}… failed:\n${r.stderr}`);
  return r.stdout + r.stderr;
}
const secs = (t0) => ((Date.now() - t0) / 1000).toFixed(1) + " s";

export function renderFilm(buildUrl, { name, T, cuts = null, argv = process.argv }) {
  const here = path.dirname(fileURLToPath(buildUrl)), out = (f) => path.join(here, "out", f);
  const flag = (f) => argv.includes(f), wi = argv.indexOf("--workers"), workers = wi > 0 ? argv[wi + 1] : "4";
  const draft = flag("--draft"), blur = flag("--blur") && !draft, muxOnly = flag("--mux-only");
  fs.mkdirSync(path.join(here, "out"), { recursive: true });
  const times = {}, start = Date.now();

  // 1 · picture
  if (!muxOnly) {
    const t0 = Date.now();
    const pic = spawnSync("node", [MC, path.join(here, "video.miraiclip.json"), "--out", out(`${name}-picture.mp4`), "--quality", draft ? "standard" : "high", "--workers", workers, ...(blur ? ["--motion-blur"] : []), "--quiet"], { stdio: "inherit" });
    if (pic.status !== 0) throw new Error("picture render failed");
    times.picture = secs(t0);
  } else if (!fs.existsSync(out(`${name}-picture.mp4`))) throw new Error("--mux-only needs an earlier picture render");

  // 2 · score
  let t0 = Date.now();
  run("node", [path.join(here, "audio.mjs"), out(`${name}-score.wav`)]);
  times.score = secs(t0);

  // 3 · mux: the picture as rendered; the score loudness-normalized (-16 LUFS) and limited, because loudnorm alone
  // lets the AAC encode overshoot to 0 dBTP
  t0 = Date.now();
  run("ffmpeg", ["-v", "error", "-y", "-i", out(`${name}-picture.mp4`), "-i", out(`${name}-score.wav`),
    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.79:attack=1:release=60:level=disabled", "-ar", "48000",
    "-c:a", "aac", "-b:a", "192k", "-t", String(T.DUR), "-movflags", "+faststart", out(`${name}.mp4`)]);
  times.mux = secs(t0);

  // 4 · validate the written file
  t0 = Date.now();
  const file = out(`${name}.mp4`);
  const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-count_frames", "-of", "json", file]));
  const v = probe.streams.find((s) => s.codec_type === "video"), a = probe.streams.find((s) => s.codec_type === "audio");
  const loud = run("ffmpeg", ["-hide_banner", "-i", file, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"]), sum = loud.slice(loud.lastIndexOf("Summary"));
  const scenes = run("ffmpeg", ["-hide_banner", "-i", file, "-vf", "select='gte(scene,0)',metadata=print:file=-", "-an", "-f", "null", "-"]);
  const sceneScores = [...scenes.matchAll(/pts_time:([\d.]+)[\s\S]*?scene_score=([\d.]+)/g)].map((m) => ({ t: +m[1], s: +m[2] }));
  const maxScene = Math.max(0, ...sceneScores.map((x) => x.s));
  // an edited film (cuts: [planned cut times]) may cut, but only where planned: every hard cut must sit on one
  const strayCuts = cuts ? sceneScores.filter((x) => x.s >= 0.3 && !cuts.some((c) => Math.abs(c - x.t) <= 1.5 / T.FPS)).map((x) => +x.t.toFixed(3)) : [];
  const blacks = (run("ffmpeg", ["-hide_banner", "-i", file, "-vf", "blackdetect=d=0.03:pix_th=0.02", "-an", "-f", "null", "-"]).match(/black_start/g) || []).length;
  times.validate = secs(t0);
  times.total = secs(start);
  const summary = {
    file, sizeMB: +(Number(probe.format.size) / 1048576).toFixed(1),
    video: { codec: v.codec_name, width: v.width, height: v.height, fps: v.r_frame_rate, frames: Number(v.nb_read_frames), duration: Number(v.duration), maxSceneScore: +maxScene.toFixed(3), blackFrames: blacks },
    audio: { codec: a.codec_name, rate: Number(a.sample_rate), channels: a.channels, duration: Number(a.duration), loudnessLUFS: Number(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), truePeakDBFS: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]) },
    times,
  };
  const checks = [
    [`${T.W || 1920}x${T.H || 1080}`, v.width === (T.W || 1920) && v.height === (T.H || 1080)], // vertical films set T.W / T.H
    [`${T.FPS} fps`, v.r_frame_rate === `${T.FPS}/1`],
    [`${T.DUR * T.FPS} frames`, summary.video.frames === T.DUR * T.FPS],
    [`audio within 1 frame of ${T.DUR} s`, Math.abs(summary.audio.duration - T.DUR) < 1 / T.FPS],
    ["no clipping (true peak < 0 dBFS)", summary.audio.truePeakDBFS < 0],
    cuts ? [`hard cuts only where planned (${cuts.length} planned${strayCuts.length ? "; stray at " + strayCuts.join(", ") : ""})`, strayCuts.length === 0] : ["no hard cuts (max scene score < 0.3)", maxScene < 0.3],
    ["no black frames", blacks === 0],
  ];
  console.log(JSON.stringify(summary, null, 2));
  checks.forEach(([n, ok]) => console.log(`${ok ? "PASS" : "FAIL"}  ${n}`));
  console.log(`time: ${Object.entries(times).map(([k, t]) => `${k} ${t}`).join(" · ")}${blur ? " (motion blur)" : ""} on ${workers} workers`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
  return summary;
}
