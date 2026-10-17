#!/usr/bin/env node
/**
 * mc — helper CLI for the Miraiclip Claude Code skills.
 *
 * Every editing subcommand prints `{ "commands": [...] }` (plus notes) to stdout.
 * Pass `commands` straight to the miraiclip MCP server's `apply_commands` tool.
 * Nothing here writes the project file: the MCP server owns it.
 *
 *   node mc.mjs probe <files...> [--assets <dir>]
 *   node mc.mjs transcribe <media> [--model base] [--language en] [--out words.json]
 *   node mc.mjs cuts <media> [--words words.json] [--fillers um,uh] [--noise -35] [--min-silence-ms 450] [--pad-ms 120]
 *   node mc.mjs recut --asset <id> --keep keep.json [--track v1] [--at-us 0] [--prefix seg] [--project p.json]
 *   node mc.mjs captions <words.json|.srt|.vtt> [--track captions] [--style '{...}'] [--max-words 4] [--map map.json] [--offset-us 0] [--prefix cap]
 *   node mc.mjs animate --clip <id[,id...]> [--in pop] [--out fade] [--loop kenburns] [--in-ms 600] [--out-ms 500] [--easing smooth] [--project p.json]
 *   node mc.mjs sheet <video> [--every 1] [--cols 5] [--width 320] [--out sheet.png]
 *   node mc.mjs subtitles [--format srt|vtt|txt] [--out captions.srt] [--project p.json]
 *   node mc.mjs presets
 *
 * Needs Node 18+. `probe`, `cuts` and `sheet` need ffmpeg/ffprobe on PATH.
 * `captions`, `animate`, `presets` and `subtitles` use @miraiclip/core, installed on first use into ~/.miraiclip/tools.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const DEFAULT_PROJECT = process.env.MIRAICLIP_PROJECT || "video.miraiclip.json";
const TOOLS_DIR = process.env.MIRAICLIP_TOOLS_DIR || path.join(os.homedir(), ".miraiclip", "tools");
const CORE_RANGE = "^0.5.8";

// ---------- args ----------
function parse(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const n = argv[i + 1];
      if (n !== undefined && !n.startsWith("--")) {
        flags[k] = n;
        i++;
      } else flags[k] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}
const die = (msg, code = 1) => {
  process.stderr.write(`mc: ${msg}\n`);
  process.exit(code);
};
const out = (obj, file) => {
  const json = JSON.stringify(obj, null, 2);
  if (file) {
    fs.writeFileSync(file, json);
    process.stderr.write(`mc: wrote ${file}\n`);
  }
  process.stdout.write(json + "\n");
};
const num = (v, d) => (v === undefined || v === true ? d : Number(v));
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "asset";
const has = (cmd) => spawnSync(cmd, ["-version"], { stdio: "ignore", shell: process.platform === "win32" }).status === 0;
const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// ---------- @miraiclip/core (lazy install) ----------
async function core() {
  const tryLoad = async (base) => {
    try {
      const req = createRequire(path.join(base, "noop.js"));
      return await import(pathToFileURL(req.resolve("@miraiclip/core")).href);
    } catch {
      return undefined;
    }
  };
  let mod = (await tryLoad(process.cwd())) ?? (await tryLoad(TOOLS_DIR));
  if (mod) return mod;
  process.stderr.write(`mc: installing @miraiclip/core into ${TOOLS_DIR} (one time)…\n`);
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  if (!fs.existsSync(path.join(TOOLS_DIR, "package.json"))) fs.writeFileSync(path.join(TOOLS_DIR, "package.json"), '{"private":true}');
  const r = spawnSync("npm", ["install", "--no-audit", "--no-fund", "--silent", `@miraiclip/core@${CORE_RANGE}`], {
    cwd: TOOLS_DIR,
    stdio: ["ignore", "ignore", "inherit"],
    shell: process.platform === "win32",
  });
  if (r.status !== 0) die("could not install @miraiclip/core (npm failed)");
  mod = await tryLoad(TOOLS_DIR);
  if (!mod) die("installed @miraiclip/core but could not load it");
  return mod;
}

function readProject(file) {
  const p = file || DEFAULT_PROJECT;
  if (!fs.existsSync(p)) die(`project file not found: ${p} (pass --project <path>)`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// ---------- words (transcripts) ----------
/** Normalize any transcript into [{ text, startS, endS }]. */
async function loadWords(file) {
  const raw = fs.readFileSync(file, "utf8");
  const ext = path.extname(file).toLowerCase();
  if (ext === ".srt" || ext === ".vtt") {
    const { parseSubtitles } = await core();
    const words = [];
    for (const cue of parseSubtitles(raw)) {
      const parts = cue.text.split(/\s+/).filter(Boolean);
      const step = (cue.endUs - cue.startUs) / Math.max(1, parts.length);
      parts.forEach((w, i) =>
        words.push({ text: w, startS: (cue.startUs + i * step) / 1e6, endS: (cue.startUs + (i + 1) * step) / 1e6 }),
      );
    }
    return words;
  }
  const data = JSON.parse(raw);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data.words)
      ? data.words
      : Array.isArray(data.segments)
        ? data.segments.flatMap((s) => s.words ?? [])
        : [];
  return list
    .map((w) => ({
      text: String(w.text ?? w.word ?? "").trim(),
      startS: Number(w.startS ?? w.start),
      endS: Number(w.endS ?? w.end),
    }))
    .filter((w) => w.text && Number.isFinite(w.startS) && Number.isFinite(w.endS) && w.endS > w.startS);
}

// ---------- subcommands ----------
const IMAGE = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif", ".svg"]);
const FONT = new Set([".ttf", ".otf", ".woff", ".woff2"]);

function probe(files, flags) {
  if (files.length === 0) die("probe: give one or more media files");
  const base = path.resolve(flags.assets && flags.assets !== true ? flags.assets : process.cwd());
  const ffprobe = has("ffprobe");
  const commands = [];
  const notes = [];
  const used = new Set();
  for (const f of files) {
    const abs = path.resolve(f);
    if (!fs.existsSync(abs)) {
      notes.push(`missing: ${f}`);
      continue;
    }
    let rel = path.relative(base, abs).split(path.sep).join("/");
    if (rel.startsWith("..")) rel = abs.split(path.sep).join("/");
    let id = slug(path.basename(f));
    while (used.has(id)) id += "-2";
    used.add(id);
    const ext = path.extname(f).toLowerCase();
    if (FONT.has(ext)) {
      const family = path.basename(f, ext).replace(/[-_](regular|bold|italic|medium|light|semibold|black|thin|variable|vf).*$/i, "");
      const weight = /black/i.test(f) ? 900 : /bold/i.test(f) && !/semi/i.test(f) ? 700 : /semibold/i.test(f) ? 600 : /medium/i.test(f) ? 500 : /light/i.test(f) ? 300 : 400;
      commands.push({ type: "asset/add", payload: { id, kind: "font", src: rel, family, weight, ...(/italic/i.test(f) ? { style: "italic" } : {}) } });
      notes.push(`${id}: font family guessed as "${family}" from the file name; check it`);
      continue;
    }
    const payload = { id, kind: IMAGE.has(ext) ? "image" : "video", src: rel };
    if (ffprobe) {
      const r = run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", abs]);
      if (r.status === 0) {
        const info = JSON.parse(r.stdout);
        const v = (info.streams ?? []).find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
        const a = (info.streams ?? []).find((s) => s.codec_type === "audio");
        const dur = Number(info.format?.duration ?? v?.duration ?? a?.duration);
        if (!IMAGE.has(ext)) {
          payload.kind = v ? "video" : a ? "audio" : payload.kind;
          if (Number.isFinite(dur) && dur > 0) payload.durationUs = Math.round(dur * 1e6);
        }
        if (v && payload.kind !== "audio") {
          const rot = Math.abs(Number(v.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0));
          const [w, h] = rot === 90 || rot === 270 ? [v.height, v.width] : [v.width, v.height];
          if (w && h) Object.assign(payload, { width: w, height: h });
          const [n, d] = String(v.avg_frame_rate || v.r_frame_rate || "0/1").split("/").map(Number);
          if (payload.kind === "video" && n > 0 && d > 0) payload.fps = Math.round((n / d) * 1000) / 1000;
        }
        notes.push(`${id}: ${payload.kind}${payload.durationUs ? ` ${(payload.durationUs / 1e6).toFixed(2)}s` : ""}${payload.width ? ` ${payload.width}x${payload.height}` : ""}${payload.kind === "video" ? (a ? ", has audio" : ", NO audio") : ""}`);
      } else notes.push(`${id}: ffprobe failed; durationUs unknown`);
    } else notes.push(`${id}: ffprobe not found; add durationUs/width/height yourself`);
    commands.push({ type: "asset/add", payload });
  }
  out({ commands, notes });
}

function transcribe(file, flags) {
  if (!file) die("transcribe: give a media file");
  const outFile = flags.out && flags.out !== true ? flags.out : `${path.basename(file, path.extname(file))}.words.json`;
  const model = flags.model && flags.model !== true ? flags.model : "base";
  const lang = flags.language && flags.language !== true ? ["--language", flags.language] : [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-asr-"));
  if (spawnSync("whisper", ["--help"], { stdio: "ignore", shell: process.platform === "win32" }).status === 0) {
    const r = spawnSync("whisper", [file, "--model", model, "--word_timestamps", "True", "--output_format", "json", "--output_dir", tmp, ...lang], {
      stdio: ["ignore", "ignore", "inherit"],
      shell: process.platform === "win32",
    });
    const j = path.join(tmp, `${path.basename(file, path.extname(file))}.json`);
    if (r.status === 0 && fs.existsSync(j)) {
      fs.copyFileSync(j, outFile);
      return out({ ok: true, engine: "openai-whisper", out: outFile });
    }
  }
  const py = process.platform === "win32" ? "python" : "python3";
  const script = `import json,sys
from faster_whisper import WhisperModel
m=WhisperModel(sys.argv[2],compute_type="int8")
segs,_=m.transcribe(sys.argv[1],word_timestamps=True${flags.language && flags.language !== true ? `,language="${flags.language}"` : ""})
print(json.dumps({"words":[{"text":w.word.strip(),"start":w.start,"end":w.end} for s in segs for w in (s.words or [])]}))`;
  const r = run(py, ["-c", script, file, model]);
  if (r.status === 0) {
    fs.writeFileSync(outFile, r.stdout);
    return out({ ok: true, engine: "faster-whisper", out: outFile });
  }
  die(
    "no speech-to-text engine found. Install one (ask the user first):\n" +
      "  pip install faster-whisper      (fast, CPU ok)\n" +
      "  pip install -U openai-whisper   (needs ffmpeg)\n" +
      "or ask the user for an .srt/.vtt or a words JSON.",
    2,
  );
}

function cuts(file, flags, words) {
  if (!file) die("cuts: give a media file");
  const r = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  const dur = Number(r.stdout);
  if (!(dur > 0)) die("cuts: could not read duration (is ffprobe on PATH?)");
  const noise = num(flags.noise, -35);
  const minSil = num(flags["min-silence-ms"], 450) / 1000;
  const pad = num(flags["pad-ms"], 120) / 1000;
  const sd = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", `silencedetect=noise=${noise}dB:d=${minSil}`, "-f", "null", "-"]);
  const removes = [];
  let s0;
  for (const line of (sd.stderr || "").split(/\r?\n/)) {
    const a = line.match(/silence_start: (-?[\d.]+)/);
    const b = line.match(/silence_end: ([\d.]+)/);
    if (a) s0 = Math.max(0, Number(a[1]));
    if (b && s0 !== undefined) {
      removes.push([s0 + pad, Number(b[1]) - pad]);
      s0 = undefined;
    }
  }
  if (s0 !== undefined) removes.push([s0 + pad, dur]);
  const fillers = new Set(
    String(flags.fillers && flags.fillers !== true ? flags.fillers : "um,uh,erm,uhm,umm,hmm")
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean),
  );
  let fillerCount = 0;
  for (const w of words ?? []) {
    if (fillers.has(w.text.toLowerCase().replace(/[^a-z']/g, ""))) {
      removes.push([w.startS, w.endS]);
      fillerCount++;
    }
  }
  removes.sort((x, y) => x[0] - y[0]);
  const keep = [];
  let t = 0;
  for (const [a, b] of removes) {
    if (b <= a) continue;
    if (a > t) keep.push([t, a]);
    t = Math.max(t, b);
  }
  if (t < dur) keep.push([t, dur]);
  const minKeep = num(flags["min-keep-ms"], 250) / 1000;
  const ranges = keep
    .filter(([a, b]) => b - a >= minKeep)
    .map(([a, b]) => ({ startUs: Math.round(a * 1e6), endUs: Math.round(b * 1e6) }));
  const kept = ranges.reduce((s, r) => s + (r.endUs - r.startUs), 0) / 1e6;
  out(
    {
      keep: ranges,
      notes: [`source ${dur.toFixed(2)}s → ${kept.toFixed(2)}s kept in ${ranges.length} segments (${fillerCount} filler words cut)`],
    },
    flags.out && flags.out !== true ? flags.out : undefined,
  );
}

function recut(flags) {
  const asset = flags.asset;
  if (!asset || asset === true) die("recut: --asset <id> is required");
  if (!flags.keep || flags.keep === true) die("recut: --keep <keep.json> is required (from `mc cuts`)");
  const keepData = JSON.parse(fs.readFileSync(flags.keep, "utf8"));
  const keep = Array.isArray(keepData) ? keepData : keepData.keep;
  const track = flags.track && flags.track !== true ? flags.track : "v1";
  const prefix = flags.prefix && flags.prefix !== true ? flags.prefix : "seg";
  let tl = num(flags["at-us"], 0);
  const commands = [];
  const map = [];
  keep.forEach((r, i) => {
    const len = r.endUs - r.startUs;
    commands.push({
      type: "clip/add",
      payload: { kind: "video", id: `${prefix}-${i + 1}`, trackId: track, assetId: asset, startUs: tl, trimStartUs: r.startUs, durationUs: len },
    });
    map.push({ clipId: `${prefix}-${i + 1}`, srcStartUs: r.startUs, srcEndUs: r.endUs, tlStartUs: tl });
    tl += len;
  });
  const mapFile = flags["map-out"] && flags["map-out"] !== true ? flags["map-out"] : "recut-map.json";
  fs.writeFileSync(mapFile, JSON.stringify(map, null, 2));
  out({ commands, notes: [`${keep.length} clips on "${track}", ${(tl / 1e6).toFixed(2)}s total. Source→timeline map written to ${mapFile}`] });
}

async function captions(file, flags) {
  if (!file) die("captions: give a words JSON, .srt or .vtt file");
  let words = await loadWords(file);
  if (flags.map && flags.map !== true) {
    const map = JSON.parse(fs.readFileSync(flags.map, "utf8"));
    const remapped = [];
    for (const w of words) {
      const s = Math.round(w.startS * 1e6);
      const seg = map.find((m) => s >= m.srcStartUs && s < m.srcEndUs);
      if (!seg) continue; // word was cut
      const e = Math.min(Math.round(w.endS * 1e6), seg.srcEndUs);
      const ts = seg.tlStartUs + (s - seg.srcStartUs);
      remapped.push({ text: w.text, startS: ts / 1e6, endS: (seg.tlStartUs + (e - seg.srcStartUs)) / 1e6 });
    }
    words = remapped;
  }
  const offset = num(flags["offset-us"], 0) / 1e6;
  if (offset) words = words.map((w) => ({ ...w, startS: w.startS + offset, endS: w.endS + offset }));
  const { captionClipsFromAsrWords } = await core();
  const style = flags.style && flags.style !== true ? JSON.parse(flags.style) : undefined;
  const commands = captionClipsFromAsrWords(words, {
    trackId: flags.track && flags.track !== true ? flags.track : "captions",
    idPrefix: flags.prefix && flags.prefix !== true ? flags.prefix : "cap",
    maxWordsPerGroup: num(flags["max-words"], 4),
    maxGapUs: num(flags["max-gap-ms"], 600) * 1000,
    ...(style ? { style } : {}),
  });
  if (flags.y !== undefined) for (const c of commands) c.payload.transform = { ...(c.payload.transform ?? {}), y: Number(flags.y) };
  out({ commands, notes: [`${words.length} words → ${commands.length} caption clips`] });
}

async function animate(flags) {
  const ids = String(flags.clip && flags.clip !== true ? flags.clip : "").split(",").filter(Boolean);
  if (ids.length === 0) die("animate: --clip <id[,id...]> is required");
  const doc = readProject(flags.project);
  const { animationCommands, animationPreset } = await core();
  const easing = flags.easing && flags.easing !== true ? flags.easing : "smooth";
  const slot = (name, kind, ms) => {
    if (!name || name === true) return undefined;
    const preset = String(name).includes(":") ? String(name) : `${kind}:${name}`;
    if (!animationPreset(preset)) die(`animate: unknown preset "${preset}" (run \`mc presets\`)`);
    return { preset, durationUs: Math.round(ms * 1000), easing };
  };
  const recipe = {};
  const i = slot(flags.in, "in", num(flags["in-ms"], 600));
  const o = slot(flags.out, "out", num(flags["out-ms"], 500));
  const l = slot(flags.loop, "loop", 0);
  if (i) recipe.in = i;
  if (o) recipe.out = o;
  if (l) recipe.loop = l;
  const commands = [];
  for (const id of ids) {
    const clip = doc.clips?.[id];
    if (!clip) die(`animate: no clip "${id}" in the project file (did the edit save? call get_state)`);
    const withDefaults = { ...clip, transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1, ...(clip.transform ?? {}) } };
    commands.push(...animationCommands(withDefaults, recipe));
  }
  out({ commands, notes: [`${ids.length} clip(s): ${Object.entries(recipe).map(([k, v]) => `${k}=${v.preset}`).join(", ") || "animation cleared"}`] });
}

async function presets() {
  const { ANIMATION_PRESETS } = await core();
  const by = { in: [], loop: [], out: [] };
  for (const p of ANIMATION_PRESETS) by[p.slot].push(p.id.split(":")[1]);
  out({ in: by.in, out: by.out, loop: by.loop, easings: ["smooth", "snappy", "linear"] });
}

function sheet(file, flags) {
  if (!file) die("sheet: give a video file (a draft export)");
  const every = num(flags.every, 1);
  const cols = num(flags.cols, 5);
  const width = num(flags.width, 320);
  const r = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  const dur = Number(r.stdout);
  if (!(dur > 0)) die("sheet: could not read duration");
  const n = Math.max(1, Math.floor(dur / every));
  const rows = Math.ceil(n / cols);
  const outFile = flags.out && flags.out !== true ? flags.out : "sheet.png";
  const f = run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", file, "-vf", `fps=1/${every},scale=${width}:-2,tile=${cols}x${rows}:padding=6:color=0x202020`, "-frames:v", "1", outFile]);
  if (f.status !== 0) die(`sheet: ffmpeg failed: ${f.stderr}`);
  out({ out: outFile, notes: [`${n} frames, one every ${every}s, read left→right, top→bottom (frame k = ${every}·k s + ${(every / 2).toFixed(2)}s)`] });
}

async function subtitles(flags) {
  const doc = readProject(flags.project);
  const { captionsToSrt, captionsToVtt, captionsToText, isCaptionClip } = await core();
  const caps = Object.values(doc.clips ?? {}).filter(isCaptionClip);
  if (caps.length === 0) die("subtitles: the project has no caption clips");
  const format = flags.format && flags.format !== true ? flags.format : "srt";
  const text = format === "vtt" ? captionsToVtt(caps) : format === "txt" ? captionsToText(caps) : captionsToSrt(caps);
  const file = flags.out && flags.out !== true ? flags.out : `captions.${format}`;
  fs.writeFileSync(file, text);
  out({ out: file, notes: [`${caps.length} caption clips → ${file}`] });
}

// ---------- main ----------
const [cmd, ...rest] = process.argv.slice(2);
const { pos, flags } = parse(rest);
switch (cmd) {
  case "probe":
    probe(pos, flags);
    break;
  case "transcribe":
    transcribe(pos[0], flags);
    break;
  case "cuts":
    cuts(pos[0], flags, flags.words && flags.words !== true ? await loadWords(flags.words) : undefined);
    break;
  case "recut":
    recut(flags);
    break;
  case "captions":
    await captions(pos[0], flags);
    break;
  case "animate":
    await animate(flags);
    break;
  case "presets":
    await presets();
    break;
  case "sheet":
    sheet(pos[0], flags);
    break;
  case "subtitles":
    await subtitles(flags);
    break;
  default:
    process.stderr.write(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0] + "*/\n");
    process.exit(cmd ? 1 : 0);
}
