// Starter for a new template: copy to <templates-root>/<id>/build.mjs, next to ../_kit.mjs.
// Three scenes (hook, one body scene, end card) in four themes × 16:9 and 9:16.
// Replace the body scene with your beats; keep the hook and end card shapes.
//
//   node <templates-root>/<id>/build.mjs            # OUT_DIR=… to choose where templates go
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTemplates, color, paths, text, themeField, themeFonts } from "../_kit.mjs";

const ID = "my-template";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asset, outDir } = paths(here, ID);
const C = ["primary", "secondary"];

// Fields: the form, in reading order. Every visible word is one; label them "Scene · role".
const fields = [
  themeField("midnight"),
  color("primary", "Brand colour", "#8b7bff"),
  color("secondary", "Second colour", "#22d3ee"),
  text("brand", "Product name", "Acme", { maxLength: 20 }),
  text("hook1", "Hook · line 1", "Say the one thing,", { maxLength: 26 }),
  text("hook2", "Hook · line 2 (accent)", "in two lines.", { maxLength: 26 }),
  text("title", "Body · headline", "One idea per scene.", { maxLength: 30 }),
  text("p1", "Body · point 1", "Enter in reading order", { maxLength: 30 }),
  text("p2", "Body · point 2", "Settle, then hold", { maxLength: 30 }),
  text("p3", "Body · point 3", "Keep moving a little", { maxLength: 30 }),
  text("tagline", "End card · tagline", "Make the video. Skip the editor.", { maxLength: 48 }),
  text("cta", "End card · button", "Start free", { maxLength: 24 }),
];

const scenes = [
  // 1 · Hook — eyebrow tracks in, line 1 lands, line 2 wipes on.
  {
    seconds: 2.8, uses: [...C, "brand", "hook1", "hook2"],
    css: `.wrap{position:absolute;left:160px;top:360px}
.h1{font-size:calc(128px * var(--ds));line-height:1.04}
@keyframes track{from{letter-spacing:.9em;opacity:0;filter:blur(6px)}}
.eyebrow{animation:track 1.1s var(--out) both}
.l2{display:inline-block;animation:reveal .9s cubic-bezier(.65,0,.35,1) both,shimmer 3.2s linear infinite}`,
    body: `<div class="wrap"><div class="eyebrow" style="--d:.05s">{{brand}}</div><div style="height:26px"></div>
<div class="h1 disp r" style="--d:.15s">{{hook1}}</div><div class="h1 disp grad l2" style="--d:.6s">{{hook2}}</div></div>`,
    vertical: `.wrap{left:80px;top:720px;width:920px}.h1{font-size:calc(108px * var(--ds))}`,
  },
  // 2 · Body — headline, then three cards rise in a wave.
  {
    seconds: 3.6, uses: [...C, "title", "p1", "p2", "p3"],
    css: `.t{position:absolute;left:160px;top:200px;font-size:calc(84px * var(--ds))}
.row{position:absolute;left:160px;top:420px;width:1600px;display:grid;grid-template-columns:repeat(3,1fr);gap:36px}
.card{height:300px;padding:44px;border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:var(--shadow);font-size:40px;font-weight:700;color:var(--ink);animation:lift .9s var(--move) both,clear .5s var(--out) both}
.card b{display:block;margin-bottom:26px;font-size:28px;color:{{primary}}}`,
    body: `<div class="t disp r" style="--d:.05s">{{title}}</div>
<div class="row">${[1, 2, 3].map((i) => `<div class="card" style="--d:${(0.3 + (i - 1) * 0.14).toFixed(2)}s"><b class="mono">0${i}</b>{{p${i}}}</div>`).join("")}</div>`,
    vertical: `.t{left:80px;top:360px;width:920px;line-height:1.08}.row{left:80px;top:640px;width:920px;grid-template-columns:1fr}.card{height:240px}`,
  },
  // 3 · End card — glow blooms, wordmark focuses in, dot drops, button pings.
  {
    seconds: 2.8, last: true, uses: [...C, "brand", "tagline", "cta"],
    css: `.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
@keyframes bloom{from{transform:scale(.5);opacity:0}}
.glow{position:absolute;left:460px;top:140px;width:1000px;height:640px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,{{primary}} 30%,transparent),transparent);animation:bloom 1.4s var(--out) both}
@keyframes focusIn{from{transform:scale(.86);opacity:0;filter:blur(18px)}}
.wm{position:relative;font-size:calc(150px * var(--ds));animation:focusIn 1s var(--out) both;text-align:center}
@keyframes drop{from{transform:translateY(-170px)}}
.dot{display:inline-block;width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,{{primary}},{{secondary}});margin-left:10px;animation:drop .9s var(--bounce) both,fadein .2s linear both}
.tag{margin-top:18px;font-size:42px;color:var(--muted);font-weight:500;text-align:center}
.btn{position:relative;margin-top:70px}
.cta{padding:26px 54px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-weight:700;font-size:40px}
@keyframes pulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.35,1.8);opacity:0}}
.ping{position:absolute;inset:0;border-radius:999px;border:3px solid {{secondary}};animation:pulse 1.1s ease-out 3 both}`,
    body: `<div class="glow" style="--d:.05s"></div>
<div class="c"><div class="wm disp" style="--d:.1s">{{brand}}<span class="dot" style="--d:.55s"></span></div>
<div class="tag r" style="--d:.6s">{{tagline}}</div>
<div class="btn r" style="--d:.85s"><div class="ping" style="--d:1.45s"></div><div class="cta">{{cta}}</div></div></div>`,
    vertical: `.wm{font-size:calc(120px * var(--ds));width:960px}.glow{left:40px;top:560px}.tag{font-size:38px;width:900px}`,
  },
];

buildTemplates({
  id: ID,
  name: "My template",
  description: "One sentence: length, beats, and what is editable.",
  category: "launch",
  tags: ["launch", "saas"],
  fields,
  scenes,
  themes: ["midnight", "paper", "terminal", "pop"], // the first is this template's own look
  assets: themeFonts(asset),
  here,
  outDir,
});
