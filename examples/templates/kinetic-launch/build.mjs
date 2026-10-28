// Kinetic launch (Launch → Product launch, 16:9 + 9:16, 22 s, four themes)
//
// A keynote-style reveal in one continuous shot. The headline slams in word by
// word; the camera tilts down to the product name as its version number rolls in
// like an odometer; it drops into the dashboard as the UI assembles itself, every
// piece flying in from its own side and flashing as it locks; it visits three
// features with drawn callouts; then it pulls back to reveal the UI inside a laptop
// while a phone slides up beside it, and lands on where to get it. In 9:16 the
// ending settles on the phone. Built on the kit's choreography layer.
// Paper is this template's own theme.
//
//   node examples/templates/kinetic-launch/build.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTemplates, camera, color, FORMATS, paths, text, themeField, themeFonts } from "../_kit.mjs";

const ID = "kinetic-launch";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asset, outDir } = paths(here, ID);
const C = ["primary", "secondary"];
const T = 19;
const H16 = FORMATS[0], V916 = FORMATS[1];
const digit = (name, label, def) => text(name, label, def, { pattern: "^[0-9]$", description: "One digit, 0–9. It rolls into place like an odometer." });
const num = (name, label, def) => text(name, label, def, { pattern: "^[0-9]{1,4}$", description: "A whole number; it counts up from 0." });

const fields = [
  themeField("paper"),
  color("primary", "Brand colour", "#e4572e"),
  color("secondary", "Second colour", "#2e86ab"),
  text("eyebrow", "Hook · eyebrow", "Introducing", { maxLength: 18 }),
  text("w1", "Hook · word 1", "Ship", { maxLength: 7 }),
  text("w2", "Hook · word 2 (accent)", "faster.", { maxLength: 8 }),
  text("product", "Product name", "Lumen", { maxLength: 12 }),
  digit("vMajor", "Version · major", "4"),
  digit("vMinor", "Version · minor", "0"),
  ...["Overview", "Projects", "Reports", "Settings"].map((v, i) => text(`nav${i + 1}`, `Sidebar · item ${i + 1}`, v, { maxLength: 12 })),
  text("k1", "KPI 1 · label", "Active users", { maxLength: 16 }), num("k1n", "KPI 1 · number", "128"), text("k1u", "KPI 1 · unit", "K", { maxLength: 2 }),
  text("k2", "KPI 2 · label", "Goals hit", { maxLength: 16 }), num("k2n", "KPI 2 · number", "94"), text("k2u", "KPI 2 · unit", "%", { maxLength: 2 }),
  text("k3", "KPI 3 · label", "Hours saved", { maxLength: 16 }), num("k3n", "KPI 3 · number", "312"), text("k3u", "KPI 3 · unit", "h", { maxLength: 2 }),
  text("chartTitle", "Chart · title", "Weekly growth", { maxLength: 20 }),
  text("act", "Activity · title", "Team activity", { maxLength: 18 }),
  text("n1", "Activity 1", "Maya shipped onboarding v2", { maxLength: 30 }),
  text("n2", "Activity 2", "Daniel closed 14 tickets", { maxLength: 30 }),
  text("n3", "Activity 3", "Priya hit the Q4 goal", { maxLength: 30 }),
  text("f1", "Callout 1 (chart)", "Live analytics", { maxLength: 24 }),
  text("f2", "Callout 2 (numbers)", "Goals that track themselves", { maxLength: 30 }),
  text("f3", "Callout 3 (activity)", "Your team, in sync", { maxLength: 24 }),
  text("avail", "Availability · line", "Available today on", { maxLength: 26 }),
  text("p1", "Platform 1", "Web", { maxLength: 10 }), text("p2", "Platform 2", "iOS", { maxLength: 10 }), text("p3", "Platform 3", "Android", { maxLength: 10 }),
  text("tagline", "End card · tagline", "Everything your team ships, in one place.", { maxLength: 44 }),
  text("cta", "End card · button", "Get early access", { maxLength: 22 }),
];

// ── World 3200 × 2400 ───────────────────────────────────────────────────────
// Type at y 200–800; dashboard 1800×1100 at (700, 900); laptop around it; phone right.
const D = { x: 700, y: 900, w: 1800, h: 1100 };
const KPI = (i) => ({ x: 1000 + i * 510, y: 1020, w: 480, h: 200 });
const CH = { x: 1000, y: 1250, w: 960, h: 720 };
const AC = { x: 1990, y: 1250, w: 490, h: 720 };
const PH = { x: 2700, y: 1150, w: 380, h: 800 };
const CALL = [ // pill position, anchor point, start time
  { f: "f1", px: 1250, py: 1390, ax: 1640, ay: 1560, d: 9.45 },
  { f: "f2", px: 1520, py: 950, ax: 1760, ay: 1110, d: 10.85 },
  { f: "f3", px: 2560, py: 1280, ax: 2420, ay: 1395, d: 12.15 },
];
const CAM16 = [
  { t: 0, x: 1600, y: 420, z: 1.18, ease: "linear" }, { t: 1.9, x: 1600, y: 425, z: 1.06 }, { t: 2.4, x: 1600, y: 430, z: 1.04 },
  { t: 3.2, x: 1600, y: 720, z: 1.2, ease: "linear" }, { t: 4.3, x: 1600, y: 725, z: 1.28 },
  { t: 5.1, x: 1000, y: 1250, z: 1.35, ease: "linear" }, { t: 7.6, x: 1600, y: 1300, z: 1.2 },
  { t: 8.6, x: 1600, y: 1450, z: 0.98 },
  { t: 9.0, x: 1600, y: 1450, z: 0.98 }, { t: 9.6, x: 1450, y: 1520, z: 1.45, ease: "linear" }, { t: 10.4, x: 1460, y: 1520, z: 1.5 },
  { t: 11.0, x: 1680, y: 1090, z: 1.5, ease: "linear" }, { t: 11.7, x: 1690, y: 1090, z: 1.55 },
  { t: 12.3, x: 2300, y: 1420, z: 1.5, ease: "linear" }, { t: 12.9, x: 2310, y: 1420, z: 1.54, ease: "in" },
  { t: 13.5, x: 1900, y: 1550, z: 0.95, blur: 6, ease: "out" }, { t: 14.3, x: 1750, y: 1560, z: 0.66, ease: "linear" },
  { t: 16.5, x: 1750, y: 1640, z: 0.64, ease: "linear" }, { t: 19, x: 1750, y: 1660, z: 0.66 },
];
const CAM916 = [
  { t: 0, x: 1600, y: 470, z: 1.0, ease: "linear" }, { t: 2.3, x: 1600, y: 470, z: 0.95 },
  { t: 3.1, x: 1600, y: 960, z: 0.95, ease: "linear" }, { t: 4.3, x: 1600, y: 970, z: 1.0 },
  { t: 5.1, x: 840, y: 1300, z: 1.0, ease: "linear" }, { t: 7.6, x: 1350, y: 1450, z: 0.88 },
  { t: 8.6, x: 1600, y: 1450, z: 0.58 },
  { t: 9.0, x: 1600, y: 1450, z: 0.58 }, { t: 9.6, x: 1450, y: 1560, z: 1.0, ease: "linear" }, { t: 10.4, x: 1455, y: 1560, z: 1.04 },
  { t: 11.0, x: 1700, y: 1110, z: 1.05, ease: "linear" }, { t: 11.7, x: 1700, y: 1110, z: 1.08 },
  { t: 12.3, x: 2380, y: 1450, z: 1.0, ease: "linear" }, { t: 12.9, x: 2385, y: 1450, z: 1.03, ease: "in" },
  { t: 13.5, x: 2500, y: 1550, z: 0.75, blur: 6, ease: "out" }, { t: 14.3, x: 2890, y: 1640, z: 1.08, ease: "linear" },
  { t: 16.5, x: 2890, y: 1690, z: 1.1, ease: "linear" }, { t: 19, x: 2890, y: 1700, z: 1.13 },
];

// An odometer digit: three runs of 0–9 roll past and stop on the field's digit.
const odo = (f, d) => `<span class="dg"><span class="col" style="--n:{{${f}}};--d:${d}s">${Array.from({ length: 30 }, (_, i) => `<i>${i % 10}</i>`).join("")}</span></span>`;
// A callout: a ring pulses at the anchor, a leader line draws to the pill, the pill pops.
const callout = ({ f, px, py, ax, ay, d }) => {
  const sx = px + 20, sy = py + 34, dx = ax - sx, dy = ay - sy, len = Math.hypot(dx, dy), ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return `<div class="co" style="--d:${d}s"><div style="--d:14.0s">
<div class="ld" style="left:${sx}px;top:${sy}px;width:${len.toFixed(0)}px;transform:rotate(${ang.toFixed(1)}deg);--d:${(d + 0.15).toFixed(2)}s"></div>
<div class="an" style="left:${ax}px;top:${ay}px;--d:${d}s"></div>
<div class="pill" style="left:${px}px;top:${py}px;--d:${(d + 0.45).toFixed(2)}s">{{${f}}}</div></div></div>`;
};
const lock = (d) => `<div class="lk" style="--d:${(d + 0.55).toFixed(2)}s"></div>`;

const scenes = [
  {
    seconds: T,
    uses: [...C, "eyebrow", "w1", "w2", "product", "vMajor", "vMinor", "nav1", "nav2", "nav3", "nav4", "k1", "k1n", "k1u", "k2", "k2n", "k2u", "k3", "k3n", "k3u", "chartTitle", "act", "n1", "n2", "n3", "f1", "f2", "f3", "avail", "p1", "p2", "p3"],
    css: `.root .cam{animation:none!important}
.world{position:absolute;left:0;top:0;width:3200px;height:2400px;transform-origin:0 0;animation:cam ${T}s linear both}
${camera("cam", T, H16, CAM16)}
/* hook: word 1 slams, word 2 widens in beside it and pushes it over */
.typo{position:absolute;inset:0;animation:fadeout .5s ease-in both}
.ey{position:absolute;left:0;width:3200px;top:205px;text-align:center;font-size:34px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:var(--muted);animation:track 1s var(--out) both}
@keyframes track{from{letter-spacing:1em;opacity:0}}
.kt{position:absolute;left:0;width:3200px;top:280px;text-align:center;font-size:calc(180px * var(--ds));line-height:1.02;white-space:nowrap}
@keyframes slam{from{transform:scale(2.4);opacity:0;filter:blur(14px)}}
.w1{display:inline-block;animation:slam .55s cubic-bezier(.3,0,.2,1) both}
@keyframes widen{from{max-width:0}to{max-width:1600px}}
@keyframes drop{from{transform:translateY(-.6em);opacity:0}}
.w2o{display:inline-block;overflow:hidden;vertical-align:bottom;white-space:nowrap;animation:widen .6s cubic-bezier(.16,1,.3,1) both}
.w2{display:inline-block;padding-left:.22em;animation:drop .6s var(--bounce) both}
.t-terminal .w2::before{content:none}
/* product + odometer */
.od{position:absolute;left:0;width:3200px;top:640px;text-align:center;font-size:calc(150px * var(--ds));line-height:1}
.pn{display:inline-block;animation:lift .8s var(--move) both,clear .5s var(--out) both}
.vn{display:inline-block;margin-left:.35em;padding:.06em .2em;border-radius:var(--rs);background:{{primary}};color:var(--on-p);animation:popIn .6s var(--bounce) both,fadein .2s ease-out both}
.dg{display:inline-block;height:1em;overflow:hidden;vertical-align:top;line-height:1}
.col{display:block;animation:roll 1.5s cubic-bezier(.2,.9,.25,1) both}
.col i{display:block;height:1em;font-style:normal}
@keyframes roll{from{transform:translateY(0)}to{transform:translateY(calc((20 + var(--n)) * -1em))}}
/* the dashboard assembles */
.pc{position:absolute;border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:var(--shadow);overflow:hidden}
@keyframes fromL{from{transform:translateX(-700px) rotate(-4deg);opacity:0}}
@keyframes fromT{from{transform:translateY(-420px);opacity:0}}
@keyframes fromB{from{transform:translateY(620px) rotate(5deg);opacity:0}}
@keyframes fromR{from{transform:translateX(800px) rotate(4deg);opacity:0}}
.L{animation:fromL .9s var(--spring) both}.T{animation:fromT .8s var(--spring) both}.B{animation:fromB .95s var(--spring) both}.R{animation:fromR .95s var(--spring) both}
.t-terminal .L,.t-terminal .T,.t-terminal .B,.t-terminal .R{animation-timing-function:steps(6,end)}
@keyframes flash{0%{opacity:0;transform:scale(1)}20%{opacity:1}100%{opacity:0;transform:scale(1.04)}}
.lk{position:absolute;inset:0;border-radius:var(--r);border:4px solid {{secondary}};box-shadow:0 0 30px {{secondary}};animation:flash .6s ease-out both}
.sbar{left:${D.x}px;top:${D.y}px;width:260px;height:${D.h}px;padding:36px 22px;background:var(--surface2)}
.logo{display:flex;align-items:center;gap:14px;font-family:var(--display);font-weight:var(--dw);font-size:calc(34px * var(--ds));color:var(--ink);margin-bottom:40px}
.logo i{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,{{primary}},{{secondary}})}
.nv{display:flex;align-items:center;gap:14px;height:56px;padding:0 14px;border-radius:var(--rs);font-size:23px;font-weight:600;color:var(--muted);white-space:nowrap}
.nv i{width:20px;height:20px;border-radius:6px;background:color-mix(in srgb,var(--ink) 18%,transparent)}
.nv.on{background:color-mix(in srgb,{{primary}} 16%,transparent);color:var(--ink)}.nv.on i{background:{{primary}}}
.tbar{left:${D.x + 280}px;top:${D.y}px;width:${D.w - 280}px;height:90px;display:flex;align-items:center;gap:16px;padding:0 26px}
.srch{flex:1;height:48px;border-radius:999px;background:var(--surface2);border:var(--border)}
.av{width:48px;height:48px;border-radius:50%;overflow:hidden;font-size:0;line-height:48px;text-align:center;white-space:nowrap;color:#fff;background:linear-gradient(135deg,{{primary}},{{secondary}});font-family:var(--display);font-weight:var(--dw);border:3px solid var(--surface)}
.av::first-letter{font-size:22px}.av+.av{margin-left:-18px}
.kc{padding:30px 32px}
.kc .k{font-size:22px;font-weight:700;letter-spacing:.06em;color:var(--muted)}
.kc .v{margin-top:14px;font-size:calc(84px * var(--ds));line-height:1;color:var(--ink);display:flex;align-items:baseline}
.kc .v u{text-decoration:none;font-size:.45em;margin-left:6px;color:{{primary}}}
@property --n{syntax:'&lt;integer&gt;';inherits:false;initial-value:0}
@keyframes count{from{--n:0}to{--n:var(--to)}}
.num{counter-reset:n var(--n);animation:count 1.4s var(--out) both}.num::after{content:counter(n)}
.chart{left:${CH.x}px;top:${CH.y}px;width:${CH.w}px;height:${CH.h}px;padding:34px 36px}
.ph{font-size:26px;font-weight:800;color:var(--ink)}
.plot{position:absolute;left:36px;right:36px;top:110px;bottom:40px;background:repeating-linear-gradient(0deg,color-mix(in srgb,var(--ink) 9%,transparent) 0 2px,transparent 2px 110px)}
.plot .dr{position:absolute;inset:0;animation:reveal 1.5s cubic-bezier(.45,0,.55,1) both}
.plot svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.actv{left:${AC.x}px;top:${AC.y}px;width:${AC.w}px;height:${AC.h}px;padding:34px 30px}
.ar{display:flex;align-items:center;gap:16px;margin-top:26px;padding:18px;border-radius:var(--rs);background:var(--surface2);font-size:22px;line-height:1.3;color:var(--ink);animation:slideIn .6s var(--spring) both,clear .4s var(--out) both}
.ar .av{flex:none;width:44px;height:44px;line-height:44px}
/* callouts */
.co{position:absolute;inset:0;animation:fadein .01s step-end both}.co>div{position:absolute;inset:0;animation:fadeout .3s ease-in both}
.ld{position:absolute;height:4px;margin-top:-2px;transform-origin:0 50%;background:var(--ink);animation:lineIn .45s cubic-bezier(.65,0,.35,1) both}
@keyframes lineIn{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.an{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:{{primary}};border:4px solid var(--surface);box-shadow:0 0 0 0 {{primary}};animation:popIn .5s var(--bounce) both,ring 1.2s ease-out infinite}
@keyframes ring{0%{box-shadow:0 0 0 0 color-mix(in srgb,{{primary}} 60%,transparent)}100%{box-shadow:0 0 0 30px transparent}}
.pill{position:absolute;padding:16px 28px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-size:30px;font-weight:800;white-space:nowrap;box-shadow:var(--shadow);animation:popIn .55s var(--bounce) both,clear .3s var(--out) both}
/* devices */
.bez{position:absolute;left:${D.x - 50}px;top:${D.y - 50}px;width:${D.w + 100}px;height:${D.h + 100}px;border-radius:44px;background:#121214;box-shadow:0 60px 140px #0006;animation:bz .8s var(--out) both}
@keyframes bz{from{opacity:0;transform:scale(1.06)}}
.base{position:absolute;left:${D.x - 250}px;top:${D.y + D.h + 50}px;width:${D.w + 500}px;height:56px;border-radius:0 0 44px 44px;background:linear-gradient(#d9d9de,#9a9aa2);box-shadow:0 30px 60px #0005;animation:bz .8s var(--out) both}
.base::after{content:'';position:absolute;left:50%;top:0;width:300px;margin-left:-150px;height:18px;border-radius:0 0 18px 18px;background:#7c7c84}
.phone{position:absolute;left:${PH.x}px;top:${PH.y}px;width:${PH.w}px;height:${PH.h}px;border-radius:58px;background:#121214;padding:14px;box-shadow:0 50px 120px #0006;animation:phUp 1s var(--spring) both,fadein .2s ease-out both}
@keyframes phUp{from{transform:translateY(700px) rotate(8deg)}}
.scr{position:relative;width:100%;height:100%;border-radius:46px;overflow:hidden;background:var(--surface);padding:70px 22px 22px}
.scr .nt{position:absolute;left:50%;top:12px;width:110px;height:30px;margin-left:-55px;border-radius:16px;background:#121214}
.scr .hd{display:flex;align-items:center;gap:10px;font-family:var(--display);font-weight:var(--dw);font-size:calc(30px * var(--ds));color:var(--ink);margin-bottom:22px}
.scr .hd i{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,{{primary}},{{secondary}})}
.mc{margin-bottom:14px;padding:18px 20px;border-radius:var(--rs);background:var(--surface2);border:var(--border);animation:lift .6s var(--move) both,clear .4s var(--out) both}
.mc .k{font-size:17px;font-weight:700;color:var(--muted)}.mc .v{margin-top:6px;font-size:calc(40px * var(--ds));font-family:var(--display);font-weight:var(--dw);color:var(--ink)}.mc .v u{text-decoration:none;font-size:.55em;color:{{primary}}}
.mbar{position:absolute;left:22px;right:22px;bottom:22px;height:64px;border-radius:var(--rs);background:var(--surface2);border:var(--border);display:flex;justify-content:space-around;align-items:center}
.mbar i{width:24px;height:24px;border-radius:7px;background:color-mix(in srgb,var(--ink) 20%,transparent)}.mbar i:first-child{background:{{primary}}}
.avl{position:absolute;left:0;width:3200px;top:2210px;text-align:center}
.avl .t{font-size:calc(56px * var(--ds));color:var(--ink);animation:lift .7s var(--move) both,clear .5s var(--out) both}
.chips{display:flex;justify-content:center;gap:18px;margin-top:22px}
.chip{padding:14px 30px;border-radius:999px;border:var(--border);background:var(--surface);font-size:30px;font-weight:700;color:var(--ink);animation:popIn .55s var(--bounce) both,clear .3s var(--out) both}`,
    body: `<div class="world" style="--d:0s">
<div class="typo" style="--d:5.3s"><div class="ey" style="--d:1.35s">{{eyebrow}}</div>
<div class="kt disp"><span class="w1" style="--d:.1s">{{w1}}</span><wbr/><span class="w2o" style="--d:.75s"><span class="w2 grad" style="--d:.75s">{{w2}}</span></span></div>
<div class="od disp"><span class="pn" style="--d:2.7s">{{product}}</span><wbr/><span class="vn" style="--d:3.0s">${odo("vMajor", 3.05)}.${odo("vMinor", 3.25)}</span></div></div>
<div class="bez" style="--d:13.3s"></div><div class="base" style="--d:13.45s"></div>
<div class="pc sbar L" style="--d:5.0s"><div class="logo"><i></i>{{product}}</div>${[1, 2, 3, 4].map((n) => `<div class="nv${n === 1 ? " on" : ""}"><i></i>{{nav${n}}}</div>`).join("")}${lock(5.0)}</div>
<div class="pc tbar T" style="--d:5.35s"><div class="srch"></div><span class="av">{{n1}}</span><span class="av">{{n2}}</span><span class="av">{{n3}}</span>${lock(5.35)}</div>
${[1, 2, 3].map((n) => { const k = KPI(n - 1), d = 5.65 + (n - 1) * 0.15; return `<div class="pc kc B" style="left:${k.x}px;top:${k.y}px;width:${k.w}px;height:${k.h}px;--d:${d.toFixed(2)}s"><div class="k">{{k${n}}}</div><div class="v disp"><span class="num" style="--to:{{k${n}n}};--d:${(d + 0.45).toFixed(2)}s"></span><u>{{k${n}u}}</u></div>${lock(d)}</div>`; }).join("\n")}
<div class="pc chart R" style="--d:6.3s"><div class="ph">{{chartTitle}}</div><div class="plot"><div class="dr" style="--d:6.95s"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 92 C10 88 16 80 24 78 S38 70 46 62 S60 58 68 44 S84 30 100 10 L100 100 L0 100 Z" style="fill:color-mix(in srgb,{{primary}} 18%,transparent)"/><path d="M0 92 C10 88 16 80 24 78 S38 70 46 62 S60 58 68 44 S84 30 100 10" fill="none" stroke="{{primary}}" stroke-width="6" vector-effect="non-scaling-stroke"/></svg></div></div>${lock(6.3)}</div>
<div class="pc actv R" style="--d:6.65s"><div class="ph">{{act}}</div>${[1, 2, 3].map((n) => `<div class="ar" style="--d:${(7.2 + (n - 1) * 0.18).toFixed(2)}s"><span class="av">{{n${n}}}</span>{{n${n}}}</div>`).join("")}${lock(6.65)}</div>
${CALL.map(callout).join("\n")}
<div class="phone" style="--d:13.75s"><div class="scr"><div class="nt"></div><div class="hd"><i></i>{{product}}</div>${[1, 2, 3].map((n) => `<div class="mc" style="--d:${(14.35 + (n - 1) * 0.12).toFixed(2)}s"><div class="k">{{k${n}}}</div><div class="v">{{k${n}n}}<u>{{k${n}u}}</u></div></div>`).join("")}<div class="mbar"><i></i><i></i><i></i><i></i></div></div></div>
<div class="avl"><div class="t disp" style="--d:15.1s">{{avail}}</div><div class="chips">${[1, 2, 3].map((n) => `<div class="chip" style="--d:${(15.55 + (n - 1) * 0.14).toFixed(2)}s">{{p${n}}}</div>`).join("")}</div></div>
</div>`,
    vertical: `${camera("cam", T, V916, CAM916)}
.kt{left:1100px;width:1000px;white-space:normal;top:250px;font-size:calc(190px * var(--ds))}.ey{top:190px}
.od{left:1050px;width:1100px;top:820px;font-size:calc(140px * var(--ds));line-height:1.15}
.avl{left:${PH.x - 160}px;width:${PH.w + 320}px;top:2010px}.avl .t{font-size:calc(46px * var(--ds))}.chips{flex-wrap:wrap}`,
  },
  // End card: the product name with its version, the tagline and the button.
  {
    seconds: 3.0, last: true, uses: [...C, "product", "vMajor", "vMinor", "tagline", "cta"],
    css: `.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
@keyframes bloom{from{transform:scale(.5);opacity:0}}
.glow{position:absolute;left:460px;top:140px;width:1000px;height:640px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,{{primary}} 30%,transparent),transparent);animation:bloom 1.4s var(--out) both}
@keyframes focusIn{from{transform:scale(.86);opacity:0;filter:blur(18px)}}
.wm{position:relative;display:flex;align-items:center;gap:.3em;font-size:calc(140px * var(--ds));line-height:1.02;animation:focusIn 1s var(--out) both}
.vn{font-size:.5em;padding:.08em .3em;border-radius:var(--rs);background:{{primary}};color:var(--on-p);animation:popIn .6s var(--bounce) both}
.tag{margin-top:22px;font-size:42px;color:var(--muted);font-weight:500;text-align:center;max-width:1400px}
.btn{position:relative;margin-top:64px}
.cta{padding:26px 54px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-weight:700;font-size:40px}
@keyframes pulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.35,1.8);opacity:0}}
.ping{position:absolute;inset:0;border-radius:999px;border:3px solid {{secondary}};animation:pulse 1.1s ease-out 3 both}
/* pop: its corner circles cover the top right (x over 1100, y under 700) and the bottom left (x under 450, y over 720), so the end card sits top-left there */
.t-pop .c{align-items:flex-start;justify-content:flex-start;padding:150px 0 0 160px}.t-pop .tag{text-align:left;max-width:920px}.t-pop .glow{left:0}`,
    body: `<div class="glow" style="--d:.05s"></div>
<div class="c"><div class="wm disp" style="--d:.1s">{{product}}<span class="vn" style="--d:.55s">{{vMajor}}.{{vMinor}}</span></div>
<div class="tag r" style="--d:.6s">{{tagline}}</div>
<div class="btn r" style="--d:.85s"><div class="ping" style="--d:1.45s"></div><div class="cta">{{cta}}</div></div></div>`,
    vertical: `.wm{font-size:calc(116px * var(--ds))}.glow{left:40px;top:560px}.tag{font-size:38px;width:900px}
.t-pop .c{align-items:center;justify-content:center;padding:0}.t-pop .tag{text-align:center;max-width:960px}.t-pop .glow{left:40px}`,
  },
];

buildTemplates({
  id: ID,
  name: "Kinetic launch",
  description: "A 22-second keynote-style launch in one continuous shot: the headline slams in, the version number rolls like an odometer, the dashboard assembles itself piece by piece, three features get drawn callouts, and the camera pulls back to the UI on a laptop with a phone beside it. Every word, number, both colours and the theme are fields.",
  category: "launch",
  tags: ["launch", "product-launch", "one-take", "kinetic-type", "ui-mockup", "saas"],
  fields,
  scenes,
  themes: ["paper", "midnight", "terminal", "pop"],
  assets: themeFonts(asset),
  here,
  outDir,
});
