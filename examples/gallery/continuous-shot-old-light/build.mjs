// "Old Light", an original 30 s one-take explainer drawn in three.js: one photon's random walk out of the Sun's
// core, the moment it breaks free, and the 8 minutes it takes to reach Earth.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
//
// The film is plain scripts in film/, concatenated in name order into one stage.build closure. The timeline in
// timeline.mjs is injected as T (and the micro collisions as T_COLL) so picture and sound share their numbers.
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";
import { T, collisionTimes } from "./timeline.mjs";

const W = 1920, H = 1080;
const dir = new URL("./film/", import.meta.url);
const parts = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
const film = [`var T = ${JSON.stringify(T)};`, `var T_COLL = ${JSON.stringify(collisionTimes())};`]
  .concat(parts.map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, dir), "utf8")))
  .join("\n");

const css = `
#ov{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;font-family:'Avenir Next','Helvetica Neue',Arial,sans-serif;color:#fff6ea;-webkit-font-smoothing:antialiased}
#ov .cap{position:absolute;left:120px;overflow:hidden;padding:4px 0 10px;font-weight:600;font-size:56px;line-height:1.12;letter-spacing:-0.01em;white-space:nowrap;text-shadow:0 2px 28px rgba(7,6,10,0.65)}
#ov .cap>span{display:inline-block;will-change:transform}
#ov .k{font-weight:500;font-size:19px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,236,214,0.78)}
#ov .num{font-weight:600;font-size:64px;letter-spacing:-0.01em;font-variant-numeric:tabular-nums;line-height:1.05;margin-top:6px}
#ov .foot{font-weight:500;font-size:19px;color:rgba(255,236,214,0.6);margin-top:8px;font-variant-numeric:tabular-nums}
#ov .box{position:absolute;left:120px;top:150px;text-shadow:0 2px 24px rgba(7,6,10,0.7)}
#shade{position:absolute;left:0;top:0;width:1100px;height:${H}px;background:linear-gradient(90deg,rgba(7,6,10,0.62),rgba(7,6,10,0.35) 45%,rgba(7,6,10,0))}
#lab{position:absolute;white-space:nowrap;text-shadow:0 2px 18px rgba(7,6,10,0.8)}
#lab .lv{font-weight:500;font-size:22px;color:rgba(255,246,234,0.86);margin-top:4px}
#bar{position:absolute;left:120px;top:842px;width:1040px}
#bar .row{display:flex;justify-content:space-between;align-items:baseline}
#barTrack{position:relative;height:8px;margin-top:14px;background:rgba(255,236,214,0.12);border-radius:4px}
#barFill{position:absolute;left:0;top:0;bottom:0;right:3px;border-radius:4px;transform-origin:0 50%;background:linear-gradient(90deg,#ff7a1e,#ffb347 70%,#ffd27a)}
#barTick{position:absolute;right:0;top:-14px;width:3px;height:36px;border-radius:2px;background:#5aa9ff;box-shadow:0 0 14px #4f9dff;transform-origin:50% 50%}
#barYou{color:#8cc4ff}
#barNote{text-align:right;margin-top:14px;font-weight:500;font-size:19px;color:rgba(255,236,214,0.9)}
#c_t1{font-size:88px;letter-spacing:-0.02em}
#c_t2{font-weight:500;font-size:30px;letter-spacing:0;color:rgba(255,246,234,0.82)}
`;

const cap = (id, top, text) => `<div class="cap" id="${id}" style="top:${top}px;opacity:0"><span>${text}</span></div>`;
const overlay = `<div id="ov">
<div id="shade"></div>
<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible"><polyline id="ld" points="" fill="none" stroke="rgba(255,240,220,0.9)" stroke-width="1.6" style="opacity:0"/><circle id="ldot" cx="0" cy="0" r="4.5" fill="#fff6ea" style="opacity:0"/></svg>
<div id="lab" style="opacity:0"><div class="k" id="labK"></div><div class="lv" id="labV"></div></div>
${cap("c_h1", 420, "Every ray of sunlight")}${cap("c_h2", 490, "begins as a prisoner.")}
${cap("c_set", 452, "Absorbed. Re-emitted. Over and over.")}
${cap("c_m1", 452, "Each bounce sends it somewhere random.")}
${cap("c_m2", 452, "Then rising plasma carries it up.")}
${cap("c_free", 452, "Then it breaks free.")}
${cap("c_rev", 452, "You only see the last eight minutes.")}
${cap("c_t1", 780, "Sunlight is old light.")}${cap("c_t2", 892, "It left the Sun’s core before the first cities were built.")}
<div class="box" id="yrs" style="opacity:0"><div class="k">Years to escape</div><div class="num" id="yrsV">0</div><div class="foot">estimates range 10,000 – 170,000 years</div></div>
<div class="box" id="clk" style="opacity:0"><div class="k">Time to Earth</div><div class="num" id="clkV">0:00</div><div class="foot" id="clkKm">0 km</div></div>
<div id="bar" style="opacity:0"><div class="row"><div class="k">Inside the Sun · ~100,000 years</div><div class="k" id="barYou" style="opacity:0">To you · 8 minutes</div></div>
<div id="barTrack"><div id="barFill"></div><div id="barTick" style="opacity:0"></div></div><div id="barNote" style="opacity:0">the last 8 minutes are too thin to draw at this scale</div></div>
</div>`;

const html = `<div class="stage" data-libs="stage three three-kit" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;background:#07060a;overflow:hidden"><style>${css}</style><canvas id="c" width="${W}" height="${H}" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px"></canvas>${overlay}</div>\n<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "old-light", width: W, height: H });
