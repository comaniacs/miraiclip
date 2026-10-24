// Shared kit for the example templates: the motion system, the scene wrapper,
// the 16:9 + 9:16 formats, and the build step that turns scenes + fields into
// a template file per format (into the studio's public/templates) and a plain
// project per format (next to the example's source).
//
// The rasterizer seeks every CSS animation through `animation-delay: var(--d)`,
// so --d is each element's start time inside its scene (it inherits, and one
// element's animations all share it). Each scene is wrapped twice:
//   .x   — the exit: everything lifts, blurs and fades out 0.5 s before the cut
//   .cam — a slow push-in for the whole scene, so nothing is ever fully still
// Movement uses a spring (slight overshoot), opacity and blur an expo-out.
import fs from "node:fs";
import path from "node:path";
import { applyCommands, createProject } from "@miraiclip/core";
import { defineTemplate, hydrate } from "@miraiclip/templates";

export const SPRING = "linear(0,.06 2.5%,.22 5.5%,.5 10.5%,.78 16.5%,.94 22%,1.03 28%,1.05 33%,1.04 39%,1.01 48%,.995 58%,1 70%,1)";
export const BOUNCE = "linear(0,.25 8%,.7 16%,1 22%,.86 30%,.83 33%,.86 36%,1 44%,.96 50%,.95 52%,.96 54%,1 60%,.99 65%,1 72%,1)";

// ── Themes ──────────────────────────────────────────────────────────────────
// A theme is a set of CSS variables plus a background and a motion direction.
// The `theme` field picks one (class t-<theme> on every scene and on the
// background), so the same template can look and move four different ways:
//   midnight — dark navy, soft brand glows, Inter, springs up from below
//   paper    — warm paper and ink, serif display (Instrument Serif), hard ink
//              shadows, ruled texture; things slide in from the left and the
//              camera pans sideways
//   terminal — black CRT, JetBrains Mono, scanlines, sharp corners; stepped,
//              flickering motion and hard cuts
//   pop      — pastel brand ground, chunky Bricolage Grotesque, 4 px outlines
//              and offset shadows, halftone dots; things bounce up from below
export const THEMES = ["midnight", "paper", "terminal", "pop"];
/** Default brand colours per theme for theme variants (a template can override per theme with opts.palettes). */
export const THEME_PALETTES = {
  midnight: { primary: "#8b7bff", secondary: "#22d3ee" },
  paper: { primary: "#e4572e", secondary: "#2e86ab" },
  terminal: { primary: "#3ddc84", secondary: "#b6ff3b" },
  pop: { primary: "#ff6b3d", secondary: "#1fa8e0" },
};
export const themeField = (def = "midnight") => ({ name: "theme", label: "Theme", type: "text", default: def, enum: THEMES,
  description: "midnight, paper, terminal or pop: changes palette, type, texture and motion." });

const THEME_CSS = `
.t-midnight{--ink:#fff;--muted:#a8b2cc;--dim:#7d87a3;--surface:#0f1424;--surface2:#151b2e;--border:1px solid #ffffff1c;--r:24px;--rs:14px;--shadow:0 50px 140px #0009;--glow:0 0 120px color-mix(in srgb,{{primary}} 24%,transparent);
  --display:Inter,sans-serif;--body:Inter,sans-serif;--dw:800;--dt:-.025em;--ds:1;--in-x:0px;--in-y:56px;--move:var(--spring);--on-p:#fff;--solid:#fff;--on-solid:#0a0d18;--shade:#05070dcc}
.t-paper{--ink:#16130f;--muted:#5c554b;--dim:#8a8276;--surface:#fffdf8;--surface2:#f3ede2;--border:2px solid #16130f;--r:6px;--rs:4px;--shadow:10px 10px 0 #16130f;--glow:0 0 0 transparent;
  --display:'Instrument Serif',Georgia,serif;--body:Inter,sans-serif;--dw:400;--dt:-.01em;--ds:1.18;--in-x:-80px;--in-y:0px;--move:cubic-bezier(.16,1,.3,1);--on-p:#fff;--solid:#16130f;--on-solid:#fffdf8;--shade:#f3ede2d9}
.t-terminal{--ink:#d9ffd0;--muted:#86b47f;--dim:#55804f;--surface:#050805;--surface2:#0b130b;--border:1px solid #2c4d2c;--r:2px;--rs:2px;--shadow:0 0 0 1px #1d331d;--glow:0 0 80px color-mix(in srgb,{{secondary}} 16%,transparent);
  --display:'JetBrains Mono',monospace;--body:'JetBrains Mono',monospace;--dw:700;--dt:-.05em;--ds:.9;--in-x:0px;--in-y:24px;--move:steps(4,end);--on-p:#031003;--solid:{{secondary}};--on-solid:#031003;--shade:#000000d9}
.t-pop{--ink:#111;--muted:#2c2c2c;--dim:#555;--surface:#fff;--surface2:#fff5d9;--border:4px solid #111;--r:28px;--rs:18px;--shadow:12px 12px 0 #111;--glow:0 0 0 transparent;
  --display:'Bricolage Grotesque',sans-serif;--body:'Bricolage Grotesque',sans-serif;--dw:800;--dt:-.045em;--ds:1.05;--in-x:0px;--in-y:140px;--move:var(--bounce);--on-p:#fff;--solid:#111;--on-solid:#fff;--shade:#ffffffb3}
.root{color:var(--ink);font-family:var(--body)}
.disp{font-family:var(--display);font-weight:var(--dw);letter-spacing:var(--dt)}
.t-paper .disp{font-style:normal}
.t-paper .grad{background:none;-webkit-background-clip:border-box;background-clip:border-box;color:{{primary}};font-style:italic}
.t-terminal .grad{background:none;-webkit-background-clip:border-box;background-clip:border-box;color:{{secondary}};text-shadow:0 0 18px color-mix(in srgb,{{secondary}} 70%,transparent)}
.t-terminal .grad::before{content:'> '}
.t-pop .grad{background:{{secondary}};-webkit-background-clip:border-box;background-clip:border-box;color:#111;padding:0 .14em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.t-paper .eyebrow,.t-terminal .eyebrow,.t-pop .eyebrow{color:var(--muted)}
/* exits and camera, per theme */
@keyframes leaveL{to{opacity:0;transform:translateX(-70px)}}
@keyframes leaveCut{0%,99%{opacity:1}100%{opacity:0}}
@keyframes leaveDrop{to{opacity:0;transform:translateY(80px) scale(.96)}}
@keyframes pan{from{transform:translateX(0)}to{transform:translateX(-36px)}}
@keyframes flick{0%{opacity:0}20%{opacity:1}35%{opacity:.25}55%{opacity:1}70%{opacity:.6}100%{opacity:1}}
.t-paper .x{animation-name:leaveL}
.t-terminal .x{animation-name:leaveCut}
.t-pop .x{animation-name:leaveDrop}
.t-paper .cam{animation-name:pan}
.t-terminal .cam{animation-name:none}
.t-terminal .r,.t-terminal .p,.t-terminal .ty,.t-terminal .tx,.t-terminal .r3{animation:lift .4s steps(4,end) both,flick .5s steps(5,end) both}
.t-paper .ty,.t-paper .tx,.t-paper .r3{animation:lift .9s var(--move) both,clear .5s var(--out) both}
`;

export const BASE = `*{box-sizing:border-box;margin:0}
.root{position:relative;font-family:Inter,sans-serif;color:#fff;overflow:hidden;--spring:${SPRING};--bounce:${BOUNCE};--out:cubic-bezier(.16,1,.3,1)}
.x,.cam{position:absolute;inset:0}
.cam{transform-origin:50% 50%}
@keyframes leave{to{opacity:0;transform:translateY(-28px) scale(1.015);filter:blur(8px)}}
@keyframes push{from{transform:scale(1)}to{transform:scale(1.04)}}
@keyframes lift{from{transform:translate(var(--in-x,0px),var(--in-y,56px))}}
@keyframes clear{from{opacity:0;filter:blur(12px)}}
@keyframes fadein{from{opacity:0}}
@keyframes fadeout{to{opacity:0}}
@keyframes grow{from{transform:scaleX(0)}}
@keyframes growY{from{transform:scaleY(0)}}
@keyframes reveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes shimmer{from{background-position:0% 0}to{background-position:-200% 0}}
@keyframes tiltY{from{transform:perspective(1600px) translateX(90px) rotateY(-18deg)}}
@keyframes tiltX{from{transform:perspective(1800px) translateY(90px) rotateX(24deg)}}
@keyframes rise3d{from{transform:perspective(2200px) translateY(300px) rotateX(46deg) scale(.82)}}
@keyframes popIn{from{transform:scale(.7)}}
@keyframes slideIn{from{transform:translateX(90px)}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes gone{to{opacity:0;transform:scale(.6)}}
@keyframes type{from{max-width:0}}
@keyframes dots{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-8px);opacity:1}}
.r{animation:lift .9s var(--move,var(--spring)) both,clear .6s var(--out) both}
.f{animation:fadein .7s var(--out) both}
.p{animation:popIn .8s var(--spring) both,clear .4s var(--out) both}
.ty{animation:tiltY 1.1s var(--spring) both,clear .6s var(--out) both}
.tx{animation:tiltX 1.1s var(--spring) both,clear .6s var(--out) both}
.r3{transform-origin:50% 100%;animation:rise3d 1.4s var(--spring) both,clear .7s var(--out) both}
.w{animation:reveal .7s cubic-bezier(.65,0,.35,1) both}
.typed{display:inline-block;white-space:nowrap;overflow:hidden;vertical-align:bottom;max-width:1500px;animation:type 1.4s steps(36,end) both}
.caret{display:inline-block;width:4px;height:1.05em;margin-left:4px;vertical-align:-3px;background:{{secondary}};animation:blink 1s steps(1) infinite}
.grad{background:linear-gradient(90deg,{{primary}},{{secondary}},{{primary}});background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}
.eyebrow{font-weight:600;font-size:26px;letter-spacing:.32em;color:#9aa4c0}
.mono{font-family:'JetBrains Mono','DejaVu Sans Mono',Consolas,monospace}
${THEME_CSS}`;

export const FORMATS = [
  { suffix: "", aspect: "16:9", W: 1920, H: 1080, vertical: false },
  { suffix: "-vertical", aspect: "9:16", W: 1080, H: 1920, vertical: true },
];

export const us = (s) => Math.round(s * 1e6);

/** One scene's HTML for a format: BASE + its CSS (+ vertical overrides), wrapped in .x/.cam. */
export function sceneHtml(fmt, s) {
  const exit = s.last ? "" : `.x{animation:leave .45s cubic-bezier(.4,0,1,1) both}`;
  const css = s.css + (fmt.vertical ? `\n${s.vertical ?? ""}` : "");
  return `<div class="root t-{{theme}}"><style>${BASE}
.root{width:${fmt.W}px;height:${fmt.H}px}
.cam{animation:push ${s.seconds}s linear both}${exit}
${css}</style><div class="x" style="--d:${(s.seconds - 0.5).toFixed(2)}s"><div class="cam" style="--d:0s">${s.body}</div></div></div>`;
}


/** The full-frame background clip for a format; follows the theme field. */
export function backgroundHtml(fmt) {
  const { W, H, vertical: v } = fmt;
  return `<div class="bg t-{{theme}}" style="width:${W}px;height:${H}px"><style>
.bg{position:relative;overflow:hidden}
.bg.t-midnight{background:radial-gradient(${v ? "700px 900px at 20% 15%" : "900px 600px at 15% 20%"},color-mix(in srgb,{{primary}} 38%,#0a0d18) 0%,transparent 70%),radial-gradient(${v ? "700px 800px at 85% 90%" : "800px 600px at 90% 85%"},color-mix(in srgb,{{secondary}} 30%,#0a0d18) 0%,transparent 70%),#0a0d18}
.bg.t-paper{background:repeating-linear-gradient(0deg,transparent 0 47px,#16130f0f 47px 48px),radial-gradient(#16130f12 1px,transparent 1.2px) 0 0/7px 7px,radial-gradient(${v ? "900px 1200px" : "1400px 900px"} at 50% 40%,#fbf7ef 0%,#efe7d8 100%)}
.bg.t-paper::after{content:'';position:absolute;left:${v ? 64 : 120}px;top:0;bottom:0;width:2px;background:color-mix(in srgb,{{primary}} 45%,transparent)}
.bg.t-terminal{background:repeating-linear-gradient(0deg,#00000000 0 2px,#00000066 2px 4px),linear-gradient(color-mix(in srgb,{{secondary}} 7%,transparent) 1px,transparent 1px) 0 0/64px 64px,linear-gradient(90deg,color-mix(in srgb,{{secondary}} 7%,transparent) 1px,transparent 1px) 0 0/64px 64px,radial-gradient(${v ? "900px 1300px" : "1400px 900px"} at 50% 45%,#07120a 0%,#010301 100%)}
.bg.t-pop{background:radial-gradient(color-mix(in srgb,{{primary}} 35%,transparent) 2.5px,transparent 3px) 0 0/26px 26px,color-mix(in srgb,{{primary}} 28%,#fff8ec)}
.bg.t-pop::before{content:'';position:absolute;width:${v ? 640 : 1100}px;height:${v ? 640 : 1100}px;border-radius:50%;right:-${v ? 330 : 300}px;top:-${v ? 360 : 420}px;background:{{secondary}};border:6px solid #111}
.bg.t-pop::after{content:'';position:absolute;width:${v ? 460 : 620}px;height:${v ? 460 : 620}px;border-radius:50%;left:-${v ? 220 : 180}px;bottom:-${v ? 240 : 260}px;background:{{primary}};border:6px solid #111}
</style></div>`;
}

/** Field helpers: the template form, in reading order. */
export const text = (name, label, def, extra = {}) => ({ name, label, type: "text", default: def, ...extra });
export const color = (name, label, def) => ({ name, label, type: "color", default: def });

const bind = (names) => Object.fromEntries(names.map((n) => [n, `{{${n}}}`]));

/**
 * Build every format of a template.
 * opts: { id, name, description, category, tags, fields, scenes, assets, here, outDir, background? }
 *   scenes: [{ seconds, uses, css, body, vertical?, last? }]
 *   assets: asset/add payloads (the font, images…)
 */
export function buildTemplates(opts) {
  const { id, name, description, category, tags, scenes, assets, here, outDir } = opts;
  // One file per theme: the first theme is the template's own (no suffix), the
  // others get -<theme>; each variant's Theme field defaults to its theme.
  const themes = opts.themes ?? [opts.fields.find((f) => f.name === "theme")?.default ?? "midnight"];
  const Title = (t) => t[0].toUpperCase() + t.slice(1);
  const total = scenes.reduce((a, s) => a + us(s.seconds), 0);
  for (const theme of themes) for (const fmt of FORMATS) {
    const pal = { ...THEME_PALETTES[theme], ...(opts.palettes?.[theme] ?? {}) };
    const fields = opts.fields.map((f) => (f.name === "theme" ? { ...f, default: theme } : f.type === "color" && pal[f.name] ? { ...f, default: pal[f.name] } : f));
    const fid = `${id}${theme === themes[0] ? "" : `-${theme}`}${fmt.suffix}`;
    const fname = `${name}${theme === themes[0] ? "" : ` · ${Title(theme)}`}${fmt.vertical ? " (vertical)" : ""}`;
    const bgTemplate = opts.background ?? backgroundHtml(fmt);
    const commands = [
      { type: "project/set-settings", payload: { width: fmt.W, height: fmt.H, fps: 30, name: fname } },
      ...assets.map((payload) => ({ type: "asset/add", payload })),
      { type: "track/add", payload: { id: "bg", kind: "video", name: "Background" } },
      { type: "track/add", payload: { id: "scene", kind: "video", name: "Scenes" } },
      { type: "clip/add", payload: { kind: "html", id: "bg", trackId: "bg", startUs: 0, durationUs: total, template: bgTemplate, params: bind(["primary", "secondary", "theme"]) } },
      { type: "effect/add", payload: { clipId: "bg", kind: "grain", params: { intensity: 0.12 } } },
      // Slow drift on the background (clip/set-property silently drops unknown keys: keyframes go through keyframe/set).
      { type: "keyframe/set", payload: { clipId: "bg", property: "scale", timeUs: 0, value: 1, easing: "linear" } },
      { type: "keyframe/set", payload: { clipId: "bg", property: "scale", timeUs: total, value: 1.15, easing: "linear" } },
      { type: "keyframe/set", payload: { clipId: "bg", property: "x", timeUs: 0, value: 0.5, easing: "linear" } },
      { type: "keyframe/set", payload: { clipId: "bg", property: "x", timeUs: total, value: 0.53, easing: "linear" } },
    ];
    let t = 0;
    scenes.forEach((s, i) => {
      const html = sceneHtml(fmt, s);
      const uses = [...new Set(["theme", ...s.uses])];
      const inTpl = new Set([...html.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]));
      for (const n of inTpl) if (!uses.includes(n)) throw new Error(`scene ${i + 1} uses {{${n}}} but does not bind it`);
      commands.push({ type: "clip/add", payload: { kind: "html", id: `s${i + 1}`, trackId: "scene", startUs: t, durationUs: us(s.seconds), animated: true, template: html, params: bind(uses) } });
      t += us(s.seconds);
    });
    for (let i = 1; i < scenes.length; i++) commands.push({ type: "transition/add", payload: { kind: "crossDissolve", fromClipId: `s${i}`, toClipId: `s${i + 1}`, durationUs: 300000 } });

    const project = createProject({ width: fmt.W, height: fmt.H, fps: 30 });
    const result = applyCommands(project, commands);
    if (!result.ok) throw new Error(`command ${result.failedIndex} failed: ${result.error?.message ?? JSON.stringify(result)}`);
    const used = new Set(["theme", ...scenes.flatMap((s) => s.uses)]);
    for (const f of fields) if (f.type !== "asset" && !used.has(f.name)) throw new Error(`field ${f.name} is not used`);

    const template = defineTemplate({ name: fname, description, category, tags: [...tags, fmt.aspect, theme], doc: project.toJSON(), fields });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${fid}.miraiclip-template.json`), JSON.stringify(template));
    const doc = hydrate(template, {});
    doc.settings.name = fname;
    fs.writeFileSync(path.join(here, `${fid}.miraiclip.json`), JSON.stringify(doc));
    console.log(`${theme.padEnd(8)} ${fmt.aspect} · ${fid} · ${total / 1e6}s · ${fields.length} fields · ${scenes.length} scenes`);
  }
}

/** Where things go, shared by every example's build.mjs. */
export function paths(here, id) {
  const ASSET_BASE = (process.env.ASSET_BASE ?? "https://assets.miraiclip.com").replace(/\/$/, "");
  return {
    asset: (file, from = id) => `${ASSET_BASE}/templates/${from}/${file}`,
    outDir: process.env.OUT_DIR ?? path.resolve(here, "../../../../miraiclip-react-template/public/templates"),
  };
}

/** Every theme's fonts (all OFL), shared by every template under templates/_shared/ in R2. */
export const themeFonts = (asset) => {
  const ofl = { id: "OFL-1.1", url: "https://openfontlicense.org", commercial: true, attributionRequired: false };
  const f = (id, file, family, extra) => ({ id, kind: "font", src: asset(file, "_shared"), family, license: ofl, ...extra });
  return [
    f("inter", "InterVariable.woff2", "Inter", { weightRange: [100, 900] }),
    f("instrument-serif", "InstrumentSerif-Regular.woff2", "Instrument Serif", { weight: 400 }),
    f("instrument-serif-italic", "InstrumentSerif-Italic.woff2", "Instrument Serif", { weight: 400, style: "italic" }),
    f("jetbrains-mono", "JetBrainsMono-Variable.woff2", "JetBrains Mono", { weightRange: [100, 800] }),
    f("bricolage", "BricolageGrotesque-Variable.woff2", "Bricolage Grotesque", { weightRange: [200, 800] }),
  ];
};

/** The Inter font asset alone (example 1, uploaded under miraiclip-launch). */
export const interFont = (asset) => ({ id: "inter", kind: "font", src: asset("InterVariable.woff2", "miraiclip-launch"), family: "Inter", weightRange: [100, 900],
  license: { id: "OFL-1.1", url: "https://openfontlicense.org", commercial: true, attributionRequired: false } });
