// One-take product tour (Show how it works → Walkthrough, 16:9 + 9:16, 22 s, four themes)
//
// A whole product walkthrough in one continuous shot, directed like a screen film:
// a headline builds phrase by phrase behind a spinning glyph and turns into the
// app's greeting; the camera pushes into the prompt box as the request is typed,
// follows the cursor into a menu and its toggles, pulls back as the prompt box
// grows into the full app, watches results stream and fill a canvas behind a scan
// line, dives into one result, then whips back out to the whole app.
// Built on the shared kit's choreography layer (camera / travel / presses / cursor):
// the UI is laid out once in world pixels and the camera moves over it, with a
// separate camera plan for 9:16. Pop is this template's own theme.
//
//   node examples/templates/one-take-tour/build.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTemplates, camera, color, CURSOR_CSS, cursorHtml, FORMATS, image, LICENSES, paths, presses, text, themeField, themeFonts, travel } from "../_kit.mjs";

const ID = "one-take-tour";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asset, outDir } = paths(here, ID);
const C = ["primary", "secondary"];
const T = 19; // the one-take scene
const H16 = FORMATS[0], V916 = FORMATS[1];

const shot = image("shot", "Result image", { src: asset("product.jpg", "miraiclip-launch"), width: 1600, height: 900,
  description: "Any 16:9 image: it fills the result tiles (in six crops) and the full preview.",
  license: LICENSES.ccBy("3.0"), attribution: "Miraiclip editor showing Big Buck Bunny © Blender Foundation, CC BY 3.0" });

const fields = [
  themeField("pop"),
  color("primary", "Brand colour", "#ff6b3d"),
  color("secondary", "Second colour", "#1fa8e0"),
  text("brand", "Product name", "Lumen", { maxLength: 16 }),
  text("h1", "Hook · phrase 1", "Turn one prompt", { maxLength: 16 }),
  text("h2", "Hook · phrase 2", "into a finished", { maxLength: 16 }),
  text("h3", "Hook · phrase 3", "launch film", { maxLength: 16 }),
  text("ask", "Greeting", "What are we making today?", { maxLength: 28 }),
  text("hint", "Prompt box · placeholder", "Describe the video you want…", { maxLength: 34 }),
  text("p1", "Prompt · line 1", "Cut a 30-second launch film from our", { maxLength: 40 }),
  text("p2", "Prompt · line 2", "changelog and the new screenshots.", { maxLength: 40 }),
  text("model", "Prompt box · model", "Studio 2", { maxLength: 12 }),
  text("m1", "Menu · item 1", "Add files", { maxLength: 14 }),
  text("m2", "Menu · item 2 (opens)", "Sources", { maxLength: 14 }),
  text("m3", "Menu · item 3", "Brand kit", { maxLength: 14 }),
  text("m4", "Menu · item 4", "Templates", { maxLength: 14 }),
  text("s1", "Sources · toggle 1 (turns on)", "Changelog", { maxLength: 14 }),
  text("s2", "Sources · toggle 2 (turns on)", "Screenshots", { maxLength: 14 }),
  text("s3", "Sources · toggle 3", "Recordings", { maxLength: 14 }),
  text("s4", "Sources · toggle 4", "Analytics", { maxLength: 14 }),
  text("reply", "Reply", "On it. Reading the changelog and lining up shots.", { maxLength: 56 }),
  text("step1", "Reply · step 1", "Read 14 changelog entries", { maxLength: 30 }),
  text("step2", "Reply · step 2", "Picked 6 screenshots", { maxLength: 30 }),
  text("step3", "Reply · step 3", "Cut to the beat", { maxLength: 30 }),
  text("canvas", "Canvas · title", "Shots", { maxLength: 18 }),
  ...["Hook", "Feature", "Speed", "Proof", "Team", "Outro"].map((v, i) => text(`t${i + 1}`, `Shot ${i + 1} · label`, v, { maxLength: 12 })),
  shot.field,
  text("cap", "Preview · caption", "Shot 2 · Feature · 0:04", { maxLength: 28 }),
  text("done", "Toast", "Launch film ready · 0:30", { maxLength: 28 }),
  text("credit", "Image credit", "Big Buck Bunny © Blender Foundation, CC BY 3.0", { maxLength: 70, description: "Credit for the image; leave empty if none is needed." }),
  text("tagline", "End card · tagline", "From prompt to film in one take.", { maxLength: 40 }),
  text("cta", "End card · button", "Try it free", { maxLength: 22 }),
];

// ── The world (3200 × 1800 px) ──────────────────────────────────────────────
// Composer 1000×250 at (1100, 620) → morphs into the app 2400×1320 at (400, 250).
// App: titlebar 64; chat column x 0–800; canvas x 840–2360 (world 1240–2760).
const APP = { x: 400, y: 250, w: 2400, h: 1320 };
const TILE = { w: 488, h: 300, gap: 28, x0: 1240, y0: 400, rowGap: 60 };
const tile = (i) => ({ x: TILE.x0 + (i % 3) * (TILE.w + TILE.gap), y: TILE.y0 + Math.floor(i / 3) * (TILE.h + TILE.rowGap) });
const PV = { x: 1240, y: 390, w: 1520, h: 900 }; // preview rect
const crops = ["20% 30%", "62% 40%", "85% 70%", "40% 80%", "10% 60%", "70% 15%"];
const tints = ["hue-rotate(40deg) saturate(1.2)", "", "grayscale(1) contrast(1.1)", "hue-rotate(-50deg)", "sepia(.4) saturate(1.3)", "hue-rotate(160deg)"];

// The cursor: where it goes and when it clicks (world px; seconds).
const CLICKS = [3.65, 6.25, 7.65, 8.05, 9.05, 13.65];
const CURSOR = [
  { t: 0, x: 1760, y: 1300 }, { t: 3.0, x: 1760, y: 1300, ease: "out" }, { t: 3.6, x: 1430, y: 792 },
  { t: 5.7, x: 1440, y: 800, ease: "snap" }, { t: 6.2, x: 1150, y: 818 },
  { t: 6.65, x: 1150, y: 818, ease: "snap" }, { t: 7.0, x: 1270, y: 986 },
  { t: 7.25, x: 1280, y: 990, ease: "snap" }, { t: 7.6, x: 1802, y: 970 },
  { t: 7.75, x: 1802, y: 972, ease: "snap" }, { t: 8.0, x: 1802, y: 1026 },
  { t: 8.35, x: 1802, y: 1026 }, { t: 9.0, x: 2044, y: 818 },
  { t: 9.15, x: 2044, y: 818, ease: "in" }, { t: 9.9, x: 2500, y: 1250 },
  { t: 12.8, x: 2500, y: 1250, ease: "out" }, { t: 13.6, x: 2000, y: 552 },
  { t: 14.0, x: 2000, y: 552, ease: "in" }, { t: 14.6, x: 2700, y: 1500 },
];
const CAM16 = [
  { t: 0, x: 1600, y: 520, z: 0.96, ease: "linear" }, { t: 2.2, x: 1600, y: 520, z: 1.06 },
  { t: 3.1, x: 1600, y: 700, z: 1.2 },
  { t: 3.4, x: 1600, y: 700, z: 1.22 }, { t: 4.4, x: 1500, y: 745, z: 1.55, ease: "linear" }, { t: 5.75, x: 1560, y: 745, z: 1.62 },
  { t: 6.5, x: 1380, y: 920, z: 1.5 },
  { t: 6.9, x: 1390, y: 925, z: 1.52 }, { t: 7.5, x: 1520, y: 1005, z: 1.72, ease: "linear" }, { t: 8.3, x: 1530, y: 1005, z: 1.75 },
  { t: 9.0, x: 1680, y: 780, z: 1.3 },
  { t: 9.2, x: 1690, y: 780, z: 1.31, ease: "in" }, { t: 9.7, x: 1620, y: 860, z: 0.98, blur: 5, ease: "out" }, { t: 10.3, x: 1600, y: 910, z: 0.76 },
  { t: 12.8, x: 1700, y: 900, z: 0.82 },
  { t: 13.6, x: 1900, y: 720, z: 1.0 },
  { t: 13.75, x: 1910, y: 730, z: 1.0 }, { t: 14.45, x: PV.x + PV.w / 2, y: PV.y + PV.h / 2, z: 1.05, ease: "linear" }, { t: 16.55, x: PV.x + PV.w / 2, y: PV.y + PV.h / 2, z: 1.13, ease: "in" },
  { t: 16.95, x: 1800, y: 900, z: 0.9, blur: 7, ease: "out" }, { t: 17.4, x: 1600, y: 910, z: 0.74, ease: "linear" }, { t: 19, x: 1600, y: 910, z: 0.77 },
];
const CAM916 = [
  { t: 0, x: 1600, y: 430, z: 0.98, ease: "linear" }, { t: 2.2, x: 1600, y: 430, z: 1.05 },
  { t: 3.1, x: 1600, y: 620, z: 1.0 },
  { t: 3.4, x: 1600, y: 640, z: 1.0 }, { t: 4.4, x: 1600, y: 745, z: 1.05, ease: "linear" }, { t: 5.75, x: 1600, y: 750, z: 1.06 },
  { t: 6.5, x: 1340, y: 960, z: 1.3 },
  { t: 6.9, x: 1350, y: 965, z: 1.3 }, { t: 7.5, x: 1480, y: 1010, z: 1.33, ease: "linear" }, { t: 8.3, x: 1485, y: 1010, z: 1.35 },
  { t: 9.0, x: 1600, y: 780, z: 1.0 },
  { t: 9.2, x: 1600, y: 780, z: 1.0, ease: "in" }, { t: 9.7, x: 1100, y: 840, z: 1.05, blur: 5, ease: "out" }, { t: 10.3, x: 810, y: 820, z: 1.25 },
  { t: 12.6, x: 810, y: 900, z: 1.27 },
  { t: 13.4, x: 2000, y: 820, z: 0.68 },
  { t: 13.75, x: 2000, y: 820, z: 0.68 }, { t: 14.45, x: PV.x + PV.w / 2, y: PV.y + PV.h / 2, z: 0.7, ease: "linear" }, { t: 16.55, x: PV.x + PV.w / 2, y: PV.y + PV.h / 2, z: 0.75, ease: "in" },
  { t: 16.95, x: 1700, y: 900, z: 0.55, blur: 7, ease: "out" }, { t: 17.4, x: 1600, y: 910, z: 0.42, ease: "linear" }, { t: 19, x: 1600, y: 910, z: 0.44 },
];

const sparkHtml = (cls, d) => `<span class="${cls}" style="--d:${d}"><span class="sk" style="--d:0s">${[0, 45, 90, 135].map((a) => `<i style="transform:rotate(${a}deg)"></i>`).join("")}</span></span>`;
const phrase = (f, d) => `<span class="ph" style="--d:2.3s"><span class="pw" style="--d:${d}s"><span class="pt2" style="--d:${d}s">{{${f}}}</span></span></span>`;

const scenes = [
  {
    seconds: T,
    uses: [...C, "brand", "h1", "h2", "h3", "ask", "hint", "p1", "p2", "model", "m1", "m2", "m3", "m4", "s1", "s2", "s3", "s4", "reply", "step1", "step2", "step3", "canvas", "t1", "t2", "t3", "t4", "t5", "t6", "cap", "done", "credit"],
    css: `.root .cam{animation:none!important}
.world{position:absolute;left:0;top:0;width:3200px;height:1800px;transform-origin:0 0;animation:cam ${T}s linear both}
${camera("cam", T, H16, CAM16)}
${travel("cur", T, CURSOR)}
${presses("press", T, CLICKS)}
${CURSOR_CSS}
/* headline: phrases widen in (pushing the glyph along), then collapse as the greeting widens out of the glyph */
.hl{position:absolute;left:0;width:3200px;top:455px;text-align:center;font-size:calc(64px * var(--ds));line-height:1.2;white-space:nowrap}
@keyframes widen{from{max-width:0}to{max-width:1400px}}
@keyframes collapse{from{max-width:1400px}to{max-width:0;opacity:0}}
@keyframes wordIn{from{opacity:0;filter:blur(10px);transform:translateY(.35em)}}
.ph,.pw,.ak{display:inline-block;vertical-align:bottom;overflow:hidden;white-space:nowrap}
.ph{animation:collapse .55s cubic-bezier(.65,0,.35,1) both}
.pw{animation:widen .75s cubic-bezier(.16,1,.3,1) both}
.pt2{display:inline-block;padding-right:.28em;animation:wordIn .7s cubic-bezier(.16,1,.3,1) both}
.ak{animation:widen .8s cubic-bezier(.16,1,.3,1) both}.ak>span{display:inline-block;padding-left:.32em;animation:wordIn .7s cubic-bezier(.16,1,.3,1) both}
.sp{display:inline-block;vertical-align:-.06em;animation:popIn .7s var(--bounce) both}
.sk{position:relative;display:block;width:.78em;height:.78em;animation:spin 7s linear infinite}
.sk i{position:absolute;left:50%;top:0;width:.15em;height:100%;margin-left:-.075em;border-radius:.08em;background:{{primary}}}
.t-terminal .sk i{border-radius:0;background:{{secondary}}}
.hlx{animation:fadeout .4s ease-in both}
/* the composer → app window */
.cw{position:absolute;inset:0;animation:lift .9s var(--move) both,clear .5s var(--out) both}
.box{position:absolute;left:1100px;top:620px;width:1000px;height:250px;border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:var(--shadow),var(--glow);overflow:hidden;animation:morph .95s cubic-bezier(.65,0,.35,1) both}
@keyframes morph{to{left:${APP.x}px;top:${APP.y}px;width:${APP.w}px;height:${APP.h}px}}
.comp{position:absolute;left:0;top:0;width:1000px;height:250px;padding:30px 34px;animation:fadeout .25s ease-in both}
.hint{position:absolute;left:34px;top:30px;font-size:28px;color:var(--dim);animation:fadeout .15s linear both}
.ln{font-size:28px;line-height:42px;color:var(--ink)}
.ln .typed{animation-timing-function:steps(40,end)}
.cr{display:inline-block;animation:fadein .01s step-end both}
.row{position:absolute;left:30px;right:30px;bottom:26px;display:flex;align-items:center;gap:14px}
.plus{width:48px;height:48px;border-radius:50%;border:var(--border);display:flex;align-items:center;justify-content:center;font-size:30px;color:var(--muted);line-height:1}
.mdl{margin-left:auto;font-size:22px;color:var(--dim)}
.send{width:48px;height:48px;border-radius:14px;background:{{primary}};color:var(--on-p);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800}
@keyframes hot{0%,100%{box-shadow:0 0 0 0 transparent}30%{box-shadow:0 0 0 10px color-mix(in srgb,{{primary}} 35%,transparent)}}
.send{animation:hot .6s ease-out both}.plus{animation:hot .6s ease-out both}
/* menu + submenu with toggles */
.mn{position:absolute;left:1110px;top:890px;width:340px;transform-origin:20px 0;animation:popIn .5s var(--spring) both,clear .2s var(--out) both}
.mn>div,.sb>div{padding:12px;border-radius:var(--rs);background:var(--surface);border:var(--border);box-shadow:var(--shadow);animation:fadeout .2s ease-in both}
.mi{display:flex;align-items:center;gap:16px;height:56px;white-space:nowrap;padding:0 14px;border-radius:calc(var(--rs) - 4px);font-size:24px;font-weight:600;color:var(--ink)}
.mi i{width:24px;height:24px;border-radius:7px;background:color-mix(in srgb,var(--ink) 16%,transparent)}
.mi .ch{margin-left:auto;color:var(--dim)}
@keyframes hov{to{background:color-mix(in srgb,{{primary}} 16%,transparent)}}
.mi.h{animation:hov .2s ease-out both}
.sb{position:absolute;left:1460px;top:930px;width:400px;transform-origin:0 20px;animation:popIn .45s var(--spring) both,clear .2s var(--out) both}
.si{display:flex;align-items:center;height:56px;white-space:nowrap;padding:0 14px;font-size:24px;font-weight:600;color:var(--ink)}
.tg{position:relative;margin-left:auto;width:52px;height:30px;border-radius:15px;background:color-mix(in srgb,var(--ink) 20%,transparent)}
.tg b{position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:50%;background:var(--surface);box-shadow:0 2px 4px #0004}
@keyframes tgOn{to{background:{{primary}}}}@keyframes knob{to{transform:translateX(22px)}}
.tg.on{animation:tgOn .3s ease-out both}.tg.on b{animation:knob .35s cubic-bezier(.2,1.4,.35,1) both}
/* the app inside the morphed window */
.app{position:absolute;left:0;top:0;width:${APP.w}px;height:${APP.h}px;animation:fadein .4s ease-out both}
.tb{height:64px;display:flex;align-items:center;gap:12px;padding:0 26px;background:var(--surface2);border-bottom:var(--border)}
.tb i{width:15px;height:15px;border-radius:50%;background:color-mix(in srgb,var(--ink) 22%,transparent)}
.tb span{margin-left:auto;margin-right:auto;font-size:22px;font-weight:700;color:var(--muted);transform:translateX(-40px)}
.chat{position:absolute;left:0;top:64px;width:800px;bottom:0;border-right:var(--border);padding:40px}
.bub{margin-left:120px;padding:22px 26px;border-radius:var(--rs);background:var(--surface2);border:var(--border);font-size:24px;line-height:1.45;color:var(--ink);animation:lift .6s var(--move) both,clear .4s var(--out) both}
.who{display:flex;align-items:center;gap:14px;margin-top:44px;font-size:22px;font-weight:700;color:var(--muted);animation:fadein .4s ease-out both}
.who .sk{width:30px;height:30px;font-size:30px}
.rep{margin-top:14px;font-size:27px;line-height:1.45;color:var(--ink);animation:reveal 1s steps(28,end) both}
.st{display:flex;align-items:center;gap:18px;margin-top:20px;padding:18px 22px;border-radius:var(--rs);background:var(--surface2);border:var(--border);font-size:24px;color:var(--ink);animation:slideIn .6s var(--spring) both,clear .4s var(--out) both}
.st .ic{position:relative;width:34px;height:34px;flex:none}
.st .sw{position:absolute;inset:0;animation:gone .18s ease-in both}
.st .ring{position:absolute;inset:3px;border-radius:50%;border:4px solid color-mix(in srgb,var(--ink) 18%,transparent);border-top-color:{{secondary}};animation:spin .7s linear infinite}
.st .ok{position:absolute;inset:0;border-radius:50%;background:{{secondary}};color:#111;font-weight:900;font-size:19px;display:flex;align-items:center;justify-content:center;animation:popIn .6s var(--bounce) both,clear .25s var(--out) both}
.mini{position:absolute;left:40px;right:40px;bottom:36px;height:72px;border-radius:var(--rs);border:var(--border);background:var(--surface2);display:flex;align-items:center;padding:0 24px;font-size:22px;color:var(--dim)}
.cv{position:absolute;left:840px;top:64px;right:40px;bottom:0}
.ch2{position:absolute;left:0;top:26px;display:flex;align-items:center;gap:14px;font-size:26px;font-weight:800;color:var(--ink);animation:fadein .4s ease-out both}
.ch2 em{font-style:normal;font-size:20px;font-weight:700;padding:5px 12px;border-radius:999px;background:color-mix(in srgb,{{primary}} 20%,transparent);color:var(--ink)}
.tl{position:absolute;width:${TILE.w}px}
.tl .im{position:relative;width:${TILE.w}px;height:${TILE.h}px;border-radius:var(--rs);overflow:hidden;border:var(--border);background:var(--surface2);animation:wipeDown .9s cubic-bezier(.65,0,.35,1) both}
@keyframes wipeDown{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}
.tl img{display:block;width:100%;height:100%;object-fit:cover;transform:scale(1.25)}
.tl .scan{position:absolute;left:0;right:0;height:4px;background:{{secondary}};box-shadow:0 0 22px 4px {{secondary}};animation:scan .9s cubic-bezier(.65,0,.35,1) both}
@keyframes scan{0%{top:0;opacity:1}85%{opacity:1}100%{top:100%;opacity:0}}
.tl .lb{margin-top:10px;font-size:20px;font-weight:700;color:var(--muted);animation:fadein .3s ease-out both}
/* preview: tile 2 grows into the canvas */
.pv{position:absolute;left:${tile(1).x}px;top:${tile(1).y}px;width:${TILE.w}px;height:${TILE.h}px;z-index:20;border-radius:var(--rs);overflow:hidden;border:var(--border);box-shadow:var(--shadow);background:#000;animation:grow2 .7s cubic-bezier(.65,0,.35,1) both,fadein .01s step-end both}
@keyframes grow2{to{left:${PV.x}px;top:${PV.y}px;width:${PV.w}px;height:${PV.h}px}}
.pv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${crops[1]};filter:${tints[1] || "none"};animation:kb 2.6s linear both}
@keyframes kb{from{transform:scale(1.08)}to{transform:scale(1.2) translate(-2%,-1%)}}
.bar{position:absolute;left:30px;right:30px;bottom:26px;height:56px;border-radius:14px;background:#000a;display:flex;align-items:center;gap:16px;padding:0 18px;color:#fff;font-size:20px;font-weight:700;animation:lift .5s var(--out) both,fadein .3s ease-out both}
.trk{position:relative;flex:1;height:8px;border-radius:4px;background:#ffffff33}
.trk b{position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:4px;background:{{primary}};transform-origin:left;animation:grow 2.1s linear both}
.cap{position:absolute;left:30px;top:26px;padding:10px 18px;border-radius:999px;background:#000a;color:#fff;font-size:22px;font-weight:700;animation:popIn .5s var(--spring) both,clear .3s var(--out) both}
.toast{position:absolute;left:2330px;top:290px;z-index:30;display:flex;align-items:center;gap:16px;padding:20px 28px;border-radius:var(--rs);background:var(--solid);color:var(--on-solid);font-size:26px;font-weight:800;box-shadow:var(--shadow);animation:popIn .55s var(--bounce) both,clear .3s var(--out) both}
.toast b{width:34px;height:34px;border-radius:50%;background:{{secondary}};color:#111;display:flex;align-items:center;justify-content:center;font-size:18px}
.credit{position:absolute;left:${APP.x}px;top:${APP.y + APP.h + 16}px;font-size:18px;color:var(--dim);animation:fadein .4s ease-out both}`,
    body: `<div class="world" style="--d:0s">
<div class="hl disp"><span class="hlx" style="--d:9.15s">${phrase("h1", 0.15)}<wbr/>${phrase("h2", 0.7)}<wbr/>${phrase("h3", 1.25)}${sparkHtml("sp", ".05s")}<span class="ak" style="--d:2.55s"><span style="--d:2.6s">{{ask}}</span></span></span></div>
<div class="cw" style="--d:2.45s"><div class="box" style="--d:9.3s">
 <div class="comp" style="--d:9.3s"><div class="hint" style="--d:3.75s">{{hint}}</div>
  <div class="ln"><span class="typed" style="--d:3.8s;animation-duration:.95s">{{p1}}</span></div>
  <div class="ln"><span class="typed" style="--d:4.8s;animation-duration:.9s">{{p2}}</span><span class="cr" style="--d:4.8s"><span class="caret" style="--d:0s"></span></span></div>
  <div class="row"><div class="plus" style="--d:6.2s">+</div><div class="mdl">{{model}}</div><div class="send" style="--d:9.0s">↑</div></div></div>
 <div class="app" style="--d:9.75s"><div class="tb"><i></i><i></i><i></i><span>{{brand}}</span></div>
  <div class="chat"><div class="bub" style="--d:10.0s">{{p1}} {{p2}}</div>
   <div class="who" style="--d:10.4s">${sparkHtml("sp", "10.4s")}{{brand}}</div><div class="rep" style="--d:10.55s">{{reply}}</div>
   ${[1, 2, 3].map((n) => { const d = 11.0 + (n - 1) * 0.6; return `<div class="st" style="--d:${d.toFixed(2)}s"><div class="ic"><div class="sw" style="--d:${(d + 0.55).toFixed(2)}s"><div class="ring" style="--d:0s"></div></div><div class="ok" style="--d:${(d + 0.55).toFixed(2)}s">✓</div></div>{{step${n}}}</div>`; }).join("")}
   <div class="mini">{{hint}}</div></div>
  <div class="cv"><div class="ch2" style="--d:10.9s">{{canvas}} <em>6</em></div></div></div>
</div></div>
<div class="mn" style="--d:6.3s"><div style="--d:8.4s">${[1, 2, 3, 4].map((n) => `<div class="mi${n === 2 ? " h" : ""}" style="--d:${n === 2 ? "7.0s" : "0s"}"><i></i>{{m${n}}}${n === 2 ? '<span class="ch">›</span>' : ""}</div>`).join("")}</div></div>
<div class="sb" style="--d:7.15s"><div style="--d:8.45s">${[1, 2, 3, 4].map((n) => `<div class="si">{{s${n}}}<div class="tg${n <= 2 ? " on" : ""}" style="--d:${n === 1 ? "7.7s" : n === 2 ? "8.1s" : "0s"}"><b style="--d:${n === 1 ? "7.7s" : n === 2 ? "8.1s" : "0s"}"></b></div></div>`).join("")}</div></div>
${[0, 1, 2, 3, 4, 5].map((i) => { const p = tile(i), d = 11.3 + i * 0.22; return `<div class="tl" style="left:${p.x}px;top:${p.y}px"><div class="im" style="--d:${d.toFixed(2)}s"><img src="asset:shot" alt="" style="object-position:${crops[i]};filter:${tints[i] || "none"}"/><div class="scan" style="--d:${d.toFixed(2)}s"></div></div><div class="lb" style="--d:${(d + 0.5).toFixed(2)}s">{{t${i + 1}}}</div></div>`; }).join("\n")}
<div class="pv" style="--d:13.72s"><img src="asset:shot" alt="" style="--d:14.0s"/><div class="cap" style="--d:14.6s">{{cap}}</div><div class="bar" style="--d:14.3s">▶<div class="trk"><b style="--d:14.4s"></b></div>0:04</div></div>
<div class="toast" style="--d:17.15s"><b>✓</b>{{done}}</div>
<div class="credit" style="--d:10.4s">{{credit}}</div>
${cursorHtml(T, CLICKS)}
</div>`,
    vertical: `${camera("cam", T, V916, CAM916)}
.hl{left:1100px;width:1000px;top:300px;white-space:normal;line-height:1.25}`,
  },
  // End card
  {
    seconds: 3.0, last: true, uses: [...C, "brand", "tagline", "cta"],
    css: `.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
@keyframes bloom{from{transform:scale(.5);opacity:0}}
.glow{position:absolute;left:460px;top:140px;width:1000px;height:640px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,{{primary}} 30%,transparent),transparent);animation:bloom 1.4s var(--out) both}
@keyframes focusIn{from{transform:scale(.86);opacity:0;filter:blur(18px)}}
.wm{position:relative;display:flex;align-items:center;gap:.25em;max-width:1500px;font-size:calc(140px * var(--ds));line-height:1.02;animation:focusIn 1s var(--out) both}
.sk{position:relative;display:block;width:.7em;height:.7em;animation:spin 7s linear infinite}
.sk i{position:absolute;left:50%;top:0;width:.15em;height:100%;margin-left:-.075em;border-radius:.08em;background:{{primary}}}
.t-terminal .sk i{border-radius:0;background:{{secondary}}}
.tag{margin-top:18px;font-size:42px;color:var(--muted);font-weight:500;text-align:center}
.btn{position:relative;margin-top:70px}
.cta{padding:26px 54px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-weight:700;font-size:40px}
@keyframes pulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.35,1.8);opacity:0}}
.ping{position:absolute;inset:0;border-radius:999px;border:3px solid {{secondary}};animation:pulse 1.1s ease-out 3 both}
/* pop: its corner circles cover the top right (x over 1100, y under 700) and the bottom left (x under 450, y over 720), so the end card sits top-left there */
.t-pop .c{align-items:flex-start;justify-content:flex-start;padding:150px 0 0 160px}.t-pop .tag{text-align:left;max-width:920px}.t-pop .wm{max-width:920px;font-size:calc(116px * var(--ds))}.t-pop .glow{left:0}`,
    body: `<div class="glow" style="--d:.05s"></div>
<div class="c"><div class="wm disp" style="--d:.1s"><span class="sk" style="--d:0s">${[0, 45, 90, 135].map((a) => `<i style="transform:rotate(${a}deg)"></i>`).join("")}</span>{{brand}}</div>
<div class="tag r" style="--d:.6s">{{tagline}}</div>
<div class="btn r" style="--d:.85s"><div class="ping" style="--d:1.45s"></div><div class="cta">{{cta}}</div></div></div>`,
    vertical: `.wm{font-size:calc(116px * var(--ds));max-width:960px}.glow{left:40px;top:560px}.tag{font-size:38px;width:900px}
.t-pop .c{align-items:center;justify-content:center;padding:0}.t-pop .tag{text-align:center;max-width:960px}.t-pop .wm{max-width:960px}.t-pop .glow{left:40px}`,
  },
];

buildTemplates({
  id: ID,
  name: "One-take product tour",
  description: "A 22-second product walkthrough in one continuous shot: a headline builds around a spinning glyph, the camera pushes into the prompt as it is typed, follows the cursor through a menu and toggles, pulls back as the prompt box becomes the app, watches results stream in, dives into one, and whips back out. Every word, the image, both colours and the theme are fields.",
  category: "product-demos",
  tags: ["show-how-it-works", "walkthrough", "one-take", "ui-mockup", "saas"],
  fields,
  scenes,
  themes: ["pop", "midnight", "paper", "terminal"],
  assets: [...themeFonts(asset), shot.asset],
  here,
  outDir,
});
