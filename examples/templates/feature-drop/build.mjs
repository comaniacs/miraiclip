// Feature drop (Launch → Feature drop, 16:9 + 9:16, 20 s, four themes)
//
// One new feature, announced in one continuous shot. A "New in" badge and the
// feature's name land; a before/after panel shows the old manual workflow until the
// cursor grabs the compare handle and drags it across, wiping it into one clean
// button; a click turns the button into a progress bar and then into results; the
// camera cuts to keycaps physically pressing the shortcut, a command palette drops
// and runs; then the camera pulls back to reveal the whole feature page with its
// three benefits and where it is rolling out. Built on the kit's choreography layer.
// Midnight is this template's own theme.
//
//   node examples/templates/feature-drop/build.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTemplates, camera, color, CURSOR_CSS, cursorHtml, FORMATS, paths, presses, text, themeField, themeFonts, travel } from "../_kit.mjs";

const ID = "feature-drop";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asset, outDir } = paths(here, ID);
const C = ["primary", "secondary"];
const T = 17;
const H16 = FORMATS[0], V916 = FORMATS[1];
const num = (name, label, def) => text(name, label, def, { pattern: "^[0-9]{1,3}$", description: "A whole number; it counts up from 0." });

const fields = [
  themeField("midnight"),
  color("primary", "Brand colour", "#8b7bff"),
  color("secondary", "Second colour", "#22d3ee"),
  text("product", "Product name", "Lumen", { maxLength: 14 }),
  text("newIn", "Badge", "New in", { maxLength: 10 }),
  text("feature", "Feature name", "Instant clips", { maxLength: 18 }),
  text("beforeTitle", "Before · title", "The old way", { maxLength: 20 }),
  ...["Export the full recording", "Scrub to the best moment", "Trim it by hand", "Reframe for each platform", "Write the captions", "Upload it, three times"].map((v, i) => text(`st${i + 1}`, `Before · step ${i + 1}`, v, { maxLength: 28 })),
  num("beforeTime", "Before · minutes", "47"),
  text("beforeUnit", "Before · unit", "min", { maxLength: 4 }),
  text("afterTitle", "After · title", "Now it's one click.", { maxLength: 24 }),
  num("afterTime", "After · seconds", "9"),
  text("afterUnit", "After · unit", "sec", { maxLength: 4 }),
  text("action", "After · button", "Make clips", { maxLength: 16 }),
  text("r1", "Result 1", "Clip 1 · The big reveal · 0:18", { maxLength: 34 }),
  text("r2", "Result 2", "Clip 2 · Live demo · 0:24", { maxLength: 34 }),
  text("r3", "Result 3", "Clip 3 · Customer Q&A · 0:15", { maxLength: 34 }),
  text("k1", "Shortcut · key 1", "⌘", { maxLength: 4 }),
  text("k2", "Shortcut · key 2", "K", { maxLength: 4 }),
  text("k3", "Shortcut · confirm key", "↵", { maxLength: 6 }),
  text("cmd", "Palette · typed command", "make clips", { maxLength: 20 }),
  text("cmdResult", "Palette · picked result", "Make clips from this recording", { maxLength: 34 }),
  text("cmdAlt1", "Palette · other result 1", "Make clips from all recordings", { maxLength: 34 }),
  text("cmdAlt2", "Palette · other result 2", "Clip settings", { maxLength: 34 }),
  text("done", "Toast", "3 clips ready", { maxLength: 22 }),
  ...[["Finds the moments", "Picks the parts people rewatch."], ["Fits every feed", "16:9, 9:16 and 1:1 in one go."], ["Ready to post", "Captions and titles included."]].flatMap(([b, d], i) => [
    text(`b${i + 1}`, `Benefit ${i + 1} · title`, b, { maxLength: 20 }),
    text(`d${i + 1}`, `Benefit ${i + 1} · line`, d, { maxLength: 36 }),
  ]),
  text("avail", "Availability", "Rolling out today on every plan", { maxLength: 36 }),
  text("tagline", "End card · tagline", "Long recordings in. Short clips out.", { maxLength: 44 }),
  text("cta", "End card · button", "Try Instant clips", { maxLength: 22 }),
];

// ── World 3200 × 2400 ───────────────────────────────────────────────────────
const P = { x: 900, y: 560, w: 1400, h: 820 }; // the before/after panel
const HX0 = 70, HX1 = P.w - 70; // compare handle travel inside the panel
const BTN = { x: P.x + 700, y: P.y + 470 }; // centre of the action button
const KEYS = { x: 2400, y: 820 }; // keycaps (16:9); 9:16 moves them under the panel
const PAL = { x: 1050, y: 640, w: 1100 };
const CLICKS = [4.3, 6.4];
const CURSOR = [
  { t: 0, x: 2150, y: 1600 }, { t: 3.6, x: 2150, y: 1600, ease: "out" }, { t: 4.25, x: P.x + HX0 + 4, y: P.y + 412 },
  { t: 4.4, x: P.x + HX0 + 4, y: P.y + 412 }, { t: 5.3, x: P.x + HX1 + 4, y: P.y + 412 },
  { t: 5.7, x: P.x + HX1 + 4, y: P.y + 412, ease: "snap" }, { t: 6.3, x: BTN.x + 30, y: BTN.y + 10 },
  { t: 6.6, x: BTN.x + 30, y: BTN.y + 10 }, { t: 7.2, x: P.x + 1150, y: P.y + 760 },
  { t: 8.2, x: P.x + 1150, y: P.y + 760, ease: "in" }, { t: 8.7, x: 2300, y: 1900 },
];
const CAM16 = [
  { t: 0, x: 1600, y: 340, z: 1.5, ease: "linear" }, { t: 1.8, x: 1600, y: 345, z: 1.4 },
  { t: 2.3, x: 1600, y: 350, z: 1.38 }, { t: 3.0, x: 1600, y: 960, z: 1.15, ease: "linear" }, { t: 4.2, x: 1600, y: 965, z: 1.2 },
  { t: 5.5, x: 1600, y: 965, z: 1.22 },
  { t: 5.7, x: 1600, y: 965, z: 1.22 }, { t: 6.3, x: 1600, y: 1000, z: 1.55, ease: "linear" }, { t: 7.4, x: 1600, y: 1000, z: 1.62 },
  { t: 7.6, x: 1600, y: 990, z: 1.6 }, { t: 8.3, x: 1950, y: 920, z: 0.95 },
  { t: 8.4, x: 1950, y: 920, z: 0.95 }, { t: 9.0, x: 2645, y: 900, z: 1.6 },
  { t: 9.2, x: 2645, y: 900, z: 1.6 }, { t: 9.9, x: 1650, y: 840, z: 1.25, ease: "linear" }, { t: 10.5, x: 1650, y: 840, z: 1.32 },
  { t: 10.55, x: 1650, y: 840, z: 1.32 }, { t: 10.85, x: 1980, y: 860, z: 1.0 },
  { t: 11.2, x: 1980, y: 860, z: 1.0 }, { t: 11.6, x: 1700, y: 820, z: 1.05 },
  { t: 11.8, x: 1700, y: 820, z: 1.05, ease: "in" }, { t: 12.3, x: 1620, y: 1000, z: 0.85, blur: 6, ease: "out" }, { t: 12.9, x: 1600, y: 1080, z: 0.61, ease: "linear" },
  { t: 17, x: 1600, y: 1085, z: 0.64 },
];
const KEYS_V = { x: 1365, y: 1450 };
const CAM916 = [
  { t: 0, x: 1600, y: 330, z: 1.25, ease: "linear" }, { t: 1.8, x: 1600, y: 335, z: 1.15 },
  { t: 2.3, x: 1600, y: 340, z: 1.13 }, { t: 3.0, x: 1600, y: 970, z: 0.72, ease: "linear" }, { t: 4.2, x: 1600, y: 970, z: 0.74 },
  { t: 5.5, x: 1600, y: 970, z: 0.75 },
  { t: 5.7, x: 1600, y: 970, z: 0.75 }, { t: 6.3, x: 1600, y: 1000, z: 1.35, ease: "linear" }, { t: 7.4, x: 1600, y: 1000, z: 1.4 },
  { t: 7.6, x: 1600, y: 1000, z: 1.38 }, { t: 8.3, x: 1600, y: 1250, z: 0.7 },
  { t: 8.4, x: 1600, y: 1250, z: 0.7 }, { t: 9.0, x: KEYS_V.x + 245, y: KEYS_V.y + 75, z: 1.6 },
  { t: 9.2, x: KEYS_V.x + 245, y: KEYS_V.y + 75, z: 1.6 }, { t: 9.9, x: 1600, y: 840, z: 0.95, ease: "linear" }, { t: 10.45, x: 1600, y: 840, z: 0.97, ease: "in" },
  { t: 10.8, x: KEYS_V.x + 245, y: KEYS_V.y + 75, z: 1.3 },
  { t: 11.15, x: KEYS_V.x + 245, y: KEYS_V.y + 75, z: 1.3 }, { t: 11.6, x: 1600, y: 760, z: 0.9 },
  { t: 11.8, x: 1600, y: 760, z: 0.9, ease: "in" }, { t: 12.3, x: 1600, y: 1100, z: 0.6, blur: 6, ease: "out" }, { t: 12.9, x: 1600, y: 1350, z: 0.45 },
  { t: 13.8, x: 1600, y: 1350, z: 0.45 }, { t: 14.8, x: 1600, y: 1880, z: 0.7, ease: "linear" }, { t: 17, x: 1600, y: 1890, z: 0.72 },
];

// A keycap rises in at `d` and is pressed at `press`.
const key = (f, d, press) => `<div class="key" style="--d:${d}s"><div class="kc dn" style="--d:${press}s">{{${f}}}</div></div>`;

const scenes = [
  {
    seconds: T,
    uses: [...C, "product", "newIn", "feature", "beforeTitle", "st1", "st2", "st3", "st4", "st5", "st6", "beforeTime", "beforeUnit", "afterTitle", "afterTime", "afterUnit", "action", "r1", "r2", "r3", "k1", "k2", "k3", "cmd", "cmdResult", "cmdAlt1", "cmdAlt2", "done", "b1", "b2", "b3", "d1", "d2", "d3", "avail"],
    css: `.root .cam{animation:none!important}
.world{position:absolute;left:0;top:0;width:3200px;height:2400px;transform-origin:0 0;animation:cam ${T}s linear both}
${camera("cam", T, H16, CAM16)}
${travel("cur", T, CURSOR)}
${presses("press", T, CLICKS)}
${CURSOR_CSS}
@property --n{syntax:'&lt;integer&gt;';inherits:false;initial-value:0}
@keyframes count{from{--n:0}to{--n:var(--to)}}
.num{counter-reset:n var(--n);animation:count 1.4s var(--out) both}.num::after{content:counter(n)}
/* hook */
.hk{position:absolute;left:0;width:3200px;top:200px;text-align:center}
.badge{display:inline-flex;align-items:center;gap:12px;padding:12px 26px;border-radius:999px;background:color-mix(in srgb,{{primary}} 20%,var(--surface));border:var(--border);font-size:28px;font-weight:700;color:var(--ink);animation:dropIn .7s var(--spring) both,fadein .3s ease-out both}
@keyframes dropIn{from{transform:translateY(-120px)}}
.badge i{width:12px;height:12px;border-radius:50%;background:{{secondary}};box-shadow:0 0 0 0 {{secondary}};animation:beat 1.2s ease-out infinite}
@keyframes beat{0%{box-shadow:0 0 0 0 color-mix(in srgb,{{secondary}} 70%,transparent)}100%{box-shadow:0 0 0 16px transparent}}
.ft{margin-top:26px;font-size:calc(124px * var(--ds));line-height:1.04;position:relative;display:inline-block;overflow:hidden;animation:focusIn .9s var(--out) both}
@keyframes focusIn{from{transform:scale(.88);opacity:0;filter:blur(16px)}}
.sheen{position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,color-mix(in srgb,#fff 55%,transparent) 50%,transparent 65%);mix-blend-mode:overlay;animation:sweep 1.1s ease-in-out both}
@keyframes sweep{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
/* before / after panel */
.pn{position:absolute;left:${P.x}px;top:${P.y}px;width:${P.w}px;height:${P.h}px;border-radius:var(--r);overflow:hidden;border:var(--border);box-shadow:var(--shadow),var(--glow);animation:lift .9s var(--move) both,clear .5s var(--out) both}
.bf,.af{position:absolute;inset:0}
.bf{background:var(--surface2);padding:56px 64px}
.bt{font-size:26px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.sl{margin-top:24px;width:720px}
.s{display:flex;align-items:center;gap:18px;height:74px;padding:0 22px;margin-bottom:12px;border-radius:var(--rs);background:var(--surface);border:var(--border);font-size:26px;color:var(--muted);animation:slideIn .55s var(--spring) both,clear .35s var(--out) both}
.s b{width:28px;height:28px;border-radius:8px;border:3px solid color-mix(in srgb,var(--ink) 25%,transparent);flex:none}
.tm{position:absolute;right:80px;top:260px;text-align:right}
.tm .v{font-family:var(--display);font-weight:var(--dw);font-size:calc(170px * var(--ds));line-height:1;color:var(--muted);display:flex;align-items:baseline;justify-content:flex-end}
.tm .v u{text-decoration:none;font-size:.32em;margin-left:10px}
.tm .l{margin-top:8px;font-size:26px;color:var(--dim)}
@keyframes tick{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
.clock{display:inline-block;width:56px;height:56px;border-radius:50%;border:5px solid var(--dim);position:relative;margin-bottom:18px;animation:tick .5s steps(2) infinite}
.clock::after{content:'';position:absolute;left:50%;top:8px;width:5px;height:18px;margin-left:-2.5px;background:var(--dim);border-radius:3px}
.af{background:var(--surface);animation:wipe 1.2s linear both}
@keyframes wipe{0%{clip-path:inset(0 ${P.w - HX0}px 0 0);animation-timing-function:cubic-bezier(.65,0,.35,1)}75%{clip-path:inset(0 ${P.w - HX1}px 0 0);animation-timing-function:cubic-bezier(.16,1,.3,1)}100%{clip-path:inset(0 0 0 0)}}
.at{position:absolute;left:0;right:0;top:110px;text-align:center;font-size:calc(70px * var(--ds));color:var(--ink)}
.chip{position:absolute;left:50%;top:225px;transform:translateX(-50%);display:flex;align-items:baseline;gap:8px;padding:10px 24px;border-radius:999px;background:color-mix(in srgb,{{secondary}} 22%,transparent);font-size:28px;font-weight:800;color:var(--ink)}
.chip u{text-decoration:none;font-weight:600}
.btn{position:absolute;left:${BTN.x - P.x - 260}px;top:${BTN.y - P.y - 55}px;width:520px;height:110px;border-radius:999px;background:{{primary}};color:var(--on-p);display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:800;box-shadow:0 20px 50px color-mix(in srgb,{{primary}} 45%,transparent);overflow:hidden;animation:fadeout .25s ease-in both}
@keyframes hover{to{transform:scale(1.04)}}
.btn .lb{animation:fadeout .15s linear both}
.btn .pg{position:absolute;left:0;top:0;bottom:0;width:100%;background:color-mix(in srgb,#fff 30%,transparent);transform-origin:left;animation:grow .9s cubic-bezier(.45,0,.55,1) both,fadein .01s step-end both}
.res{position:absolute;left:330px;right:330px;top:360px}
.rw{display:flex;align-items:center;gap:18px;height:74px;padding:0 22px;margin-bottom:14px;border-radius:var(--rs);background:var(--surface2);border:var(--border);font-size:26px;font-weight:600;color:var(--ink);animation:popIn .55s var(--bounce) both,clear .3s var(--out) both}
.rw b{width:34px;height:34px;border-radius:50%;background:{{secondary}};color:#111;display:flex;align-items:center;justify-content:center;font-size:18px;flex:none}
.rw i{margin-left:auto;width:90px;height:52px;border-radius:10px;background:linear-gradient(135deg,{{primary}},{{secondary}})}
.hdl{position:absolute;top:0;bottom:0;left:0;width:0;animation:hand 1.2s linear both}
@keyframes hand{0%{transform:translateX(${HX0}px);opacity:1;animation-timing-function:cubic-bezier(.65,0,.35,1)}75%{transform:translateX(${HX1}px);opacity:1}100%{transform:translateX(${HX1}px);opacity:0}}
.hdl::before{content:'';position:absolute;left:-2px;top:0;bottom:0;width:4px;background:{{secondary}};box-shadow:0 0 20px {{secondary}}}
.hdl b{position:absolute;left:-36px;top:376px;width:72px;height:72px;border-radius:50%;background:var(--surface);border:4px solid {{secondary}};display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:var(--ink);box-shadow:var(--shadow)}
/* keycaps */
.keys{position:absolute;left:${KEYS.x}px;top:${KEYS.y}px;display:flex;gap:20px}
.key{width:150px;height:150px;border-radius:30px;background:color-mix(in srgb,var(--ink) 30%,#000);padding:0 0 12px;animation:lift .7s var(--spring) both,clear .4s var(--out) both}
.kc{width:150px;height:138px;border-radius:30px;background:var(--surface);border:var(--border);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:var(--dw);font-size:62px;color:var(--ink);box-shadow:inset 0 -6px 0 color-mix(in srgb,var(--ink) 12%,transparent)}
@keyframes keyDown{0%{transform:translateY(0)}20%,70%{transform:translateY(10px);background:color-mix(in srgb,{{primary}} 25%,var(--surface))}100%{transform:translateY(0)}}
.kc.dn{animation:keyDown .55s ease-out both}
/* command palette */
.pal{position:absolute;left:${PAL.x}px;top:${PAL.y}px;width:${PAL.w}px;z-index:20;animation:drop .5s var(--spring) both,fadein .2s ease-out both}
@keyframes drop{from{transform:translateY(-60px) scale(.96)}}
.pal>div{border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:0 60px 140px #0008,var(--shadow);overflow:hidden;animation:fadeout .25s ease-in both}
.q{display:flex;align-items:center;gap:16px;height:96px;padding:0 34px;border-bottom:var(--border);font-size:34px;color:var(--ink)}
.q .k{font-size:22px;padding:6px 12px;border-radius:8px;border:var(--border);color:var(--dim)}
.q .typed{animation-duration:.7s}
.pr{display:flex;align-items:center;gap:16px;height:76px;margin:10px 14px;padding:0 22px;border-radius:var(--rs);font-size:28px;color:var(--muted)}
.pr i{width:26px;height:26px;border-radius:8px;background:color-mix(in srgb,var(--ink) 18%,transparent)}
@keyframes pick{0%{background:transparent;color:var(--muted)}100%{background:color-mix(in srgb,{{primary}} 22%,transparent);color:var(--ink)}}
.pr.p{animation:pick .25s ease-out both}.pr.p i{background:{{primary}}}
.toast{position:absolute;left:${P.x + P.w - 440}px;top:${P.y - 110}px;z-index:30;display:flex;align-items:center;gap:16px;padding:20px 30px;border-radius:var(--rs);background:var(--solid);color:var(--on-solid);font-size:30px;font-weight:800;box-shadow:var(--shadow);animation:popIn .55s var(--bounce) both,clear .3s var(--out) both}
.toast b{width:36px;height:36px;border-radius:50%;background:{{secondary}};color:#111;display:flex;align-items:center;justify-content:center;font-size:18px}
/* the feature page: benefits + availability */
.bn{position:absolute;left:${P.x}px;top:1480px;width:${P.w}px;display:grid;grid-template-columns:repeat(3,1fr);gap:40px}
.bx{padding:34px;border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:var(--shadow);animation:lift .7s var(--move) both,clear .4s var(--out) both}
.bx i{display:block;width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,{{primary}},{{secondary}});margin-bottom:22px}
.bx .h{font-family:var(--display);font-weight:var(--dw);font-size:calc(36px * var(--ds));color:var(--ink)}
.bx .d{margin-top:10px;font-size:24px;line-height:1.4;color:var(--muted)}
.avl{position:absolute;left:0;width:3200px;top:1840px;text-align:center}
.avl span{display:inline-flex;align-items:center;gap:14px;padding:18px 34px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-size:34px;font-weight:800;animation:popIn .6s var(--bounce) both,clear .3s var(--out) both}
.avl span i{width:14px;height:14px;border-radius:50%;background:{{secondary}};animation:beat 1.2s ease-out infinite}`,
    body: `<div class="world" style="--d:0s">
<div class="hk"><div class="badge" style="--d:.1s"><i style="--d:0s"></i>{{newIn}} {{product}}</div><br/><div class="ft disp" style="--d:.45s">{{feature}}<div class="sheen" style="--d:1.2s"></div></div></div>
<div class="pn" style="--d:2.55s">
 <div class="bf"><div class="bt">{{beforeTitle}}</div><div class="sl">${[1, 2, 3, 4, 5, 6].map((n) => `<div class="s" style="--d:${(2.9 + (n - 1) * 0.12).toFixed(2)}s"><b></b>{{st${n}}}</div>`).join("")}</div>
  <div class="tm"><div class="clock" style="--d:0s"></div><div class="v"><span class="num" style="--to:{{beforeTime}};--d:3.0s;animation-duration:2.2s"></span><u>{{beforeUnit}}</u></div><div class="l">{{beforeTitle}}</div></div></div>
 <div class="af" style="--d:4.4s"><div class="at disp">{{afterTitle}}</div><div class="chip"><span class="num" style="--to:{{afterTime}};--d:5.3s;animation-duration:.6s"></span><u>{{afterUnit}}</u></div>
  <div class="btn" style="--d:7.45s"><span class="lb" style="--d:6.45s">{{action}}</span><div class="pg" style="--d:6.5s"></div></div>
  <div class="res">${[1, 2, 3].map((n) => `<div class="rw" style="--d:${(7.55 + (n - 1) * 0.18).toFixed(2)}s"><b>✓</b>{{r${n}}}<i></i></div>`).join("")}</div></div>
 <div class="hdl" style="--d:4.4s"><b>‹›</b></div>
</div>
<div class="keys">${key("k1", 8.35, 9.0)}${key("k2", 8.45, 9.12)}${key("k3", 8.55, 10.85)}</div>
<div class="pal" style="--d:9.3s"><div style="--d:11.05s"><div class="q"><span class="k">{{k1}}{{k2}}</span><span class="typed" style="--d:9.6s">{{cmd}}</span><span class="caret"></span></div>
 <div class="pr p" style="--d:10.4s"><i></i>{{cmdResult}}</div><div class="pr"><i></i>{{cmdAlt1}}</div><div class="pr"><i></i>{{cmdAlt2}}</div></div></div>
<div class="toast" style="--d:11.2s"><b>✓</b>{{done}}</div>
<div class="bn">${[1, 2, 3].map((n) => `<div class="bx" style="--d:${(12.5 + (n - 1) * 0.2).toFixed(2)}s"><i></i><div class="h">{{b${n}}}</div><div class="d">{{d${n}}}</div></div>`).join("")}</div>
<div class="avl"><span style="--d:13.6s"><i style="--d:0s"></i>{{avail}}</span></div>
${cursorHtml(T, CLICKS)}
</div>`,
    vertical: `${camera("cam", T, V916, CAM916)}
.hk{left:1050px;width:1100px}.ft{font-size:calc(112px * var(--ds))}
.keys{left:${KEYS_V.x}px;top:${KEYS_V.y}px}
.toast{left:${P.x + P.w / 2 - 220}px;top:${P.y - 120}px}
.bn{top:1700px;grid-template-columns:1fr;width:1000px;left:1100px;gap:24px}
.avl{top:2380px}`,
  },
  // End card: the feature name under the product, the tagline and the button.
  {
    seconds: 3.0, last: true, uses: [...C, "product", "newIn", "feature", "tagline", "cta"],
    css: `.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
@keyframes bloom{from{transform:scale(.5);opacity:0}}
.glow{position:absolute;left:460px;top:140px;width:1000px;height:640px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,{{primary}} 30%,transparent),transparent);animation:bloom 1.4s var(--out) both}
.badge{display:inline-flex;align-items:center;gap:12px;padding:10px 24px;border-radius:999px;border:var(--border);background:color-mix(in srgb,{{primary}} 18%,var(--surface));font-size:28px;font-weight:700;color:var(--ink);animation:popIn .6s var(--bounce) both,clear .3s var(--out) both}
@keyframes focusIn{from{transform:scale(.86);opacity:0;filter:blur(18px)}}
.wm{position:relative;margin-top:26px;font-size:calc(130px * var(--ds));line-height:1.02;text-align:center;max-width:1500px;animation:focusIn 1s var(--out) both}
.tag{margin-top:20px;font-size:42px;color:var(--muted);font-weight:500;text-align:center;max-width:1400px}
.btn{position:relative;margin-top:60px}
.cta{padding:26px 54px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-weight:700;font-size:40px}
@keyframes pulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.35,1.8);opacity:0}}
.ping{position:absolute;inset:0;border-radius:999px;border:3px solid {{secondary}};animation:pulse 1.1s ease-out 3 both}
/* pop: its corner circles cover the top right (x over 1100, y under 700) and the bottom left (x under 450, y over 720), so the end card sits top-left there */
.t-pop .c{align-items:flex-start;justify-content:flex-start;padding:130px 0 0 160px}.t-pop .tag,.t-pop .wm{text-align:left;max-width:920px}.t-pop .wm{font-size:calc(112px * var(--ds))}.t-pop .glow{left:0}`,
    body: `<div class="glow" style="--d:.05s"></div>
<div class="c"><div class="badge" style="--d:.1s">{{newIn}} {{product}}</div><div class="wm disp" style="--d:.2s">{{feature}}</div>
<div class="tag r" style="--d:.6s">{{tagline}}</div>
<div class="btn r" style="--d:.85s"><div class="ping" style="--d:1.45s"></div><div class="cta">{{cta}}</div></div></div>`,
    vertical: `.wm{font-size:calc(110px * var(--ds));max-width:960px}.glow{left:40px;top:560px}.tag{font-size:38px;width:900px}
.t-pop .c{align-items:center;justify-content:center;padding:0}.t-pop .tag,.t-pop .wm{text-align:center;max-width:960px}.t-pop .glow{left:40px}`,
  },
];

buildTemplates({
  id: ID,
  name: "Feature drop",
  description: "A 20-second feature announcement in one continuous shot: the feature's name lands with a New badge, the cursor drags a before/after handle to wipe a manual workflow into one button, the click turns into results, keycaps press the shortcut and a command palette runs it, and the camera pulls back to the feature page. Every word, number, both colours and the theme are fields.",
  category: "launch",
  tags: ["launch", "feature-drop", "one-take", "before-after", "ui-mockup", "saas"],
  fields,
  scenes,
  themes: ["midnight", "paper", "terminal", "pop"],
  assets: themeFonts(asset),
  here,
  outDir,
});
