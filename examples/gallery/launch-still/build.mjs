// "STILL", an original 30 s product launch film for an invented focus dial, built from HTML and CSS 3D only: the
// product is stacked cylinders of shaded DOM strips, the camera is one CSS transform, and the type is DOM.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
//
// The film is plain scripts in film/, concatenated in name order into one stage.build closure. The timeline in
// timeline.mjs is injected as T (with its easing curves) so picture and sound share their numbers.
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";
import { T, turnEase, drawEase } from "./timeline.mjs";

const W = 1920, H = 1080;
const dir = new URL("./film/", import.meta.url);
const parts = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
const film = [`var T = ${JSON.stringify(T)};`, `var turnEase = ${turnEase.toString()};`, `var drawEase = ${drawEase.toString()};`]
  .concat(parts.map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, dir), "utf8")))
  .join("\n");

const FONT = "'Avenir Next','Helvetica Neue',Arial,sans-serif";
const css = `
*{box-sizing:border-box;margin:0}
.stage{background:radial-gradient(ellipse 80% 70% at 55% 45%,#16130f 0%,#0b0a09 60%,#070606 100%)}
#view{position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:1400px;perspective-origin:${W / 2}px ${H / 2}px}
#ground,#world{position:absolute;left:${W / 2}px;top:${H / 2}px;width:0;height:0;transform-style:preserve-3d}
.g3{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d}
.strip{position:absolute;backface-visibility:hidden}
.s-crown{background-image:repeating-linear-gradient(90deg,rgba(255,255,255,0.10) 0 1px,rgba(0,0,0,0.30) 1px 2.5px,transparent 2.5px 4.5px);box-shadow:inset 0 2px 0 rgba(255,255,255,0.28),inset 0 3px 3px rgba(255,255,255,0.08),inset 0 -2px 0 rgba(0,0,0,0.45)}
.s-base{background-image:repeating-linear-gradient(176deg,rgba(0,0,0,0.16) 0 1px,transparent 1px 6px),repeating-linear-gradient(183deg,rgba(255,220,180,0.05) 0 2px,transparent 2px 11px);box-shadow:inset 0 1px 0 rgba(255,220,190,0.18)}
.s-glass{box-shadow:inset 0 1px 0 rgba(255,255,255,0.35)}
.top{position:absolute;border-radius:50%;backface-visibility:hidden}
.t-crown{box-shadow:inset 0 0 0 2px rgba(255,255,255,0.10),inset 0 0 0 22px rgba(0,0,0,0.0)}
.t-glass{overflow:hidden;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.22),inset 0 0 18px rgba(0,0,0,0.6)}
.marker{position:absolute;left:206px;top:206px;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#e9e5df;box-shadow:0 0 4px rgba(255,255,255,0.5)}
.seg{position:absolute;left:185px;top:176px;width:6px;height:24px;margin-left:-3px;border-radius:3px;transform-origin:3px 12px}
.faceglow{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(255,150,60,0) 0 72%,rgba(255,150,60,0.20) 86%,rgba(255,150,60,0) 99%)}
.dot{position:absolute;left:182px;top:182px;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle,#2a2b2f,#141518);box-shadow:inset 0 1px 0 rgba(255,255,255,0.25)}
.floor{position:absolute;background:radial-gradient(circle,#1c1915 0%,#120f0d 18%,#0b0a09 42%,rgba(9,8,7,0) 62%)}
.floor>div{position:absolute;border-radius:50%}
.pool{background:radial-gradient(circle,rgba(255,226,190,0.10) 0%,rgba(255,210,170,0.05) 30%,rgba(0,0,0,0) 62%)}
.cool{background:radial-gradient(circle,rgba(90,140,255,0.16) 0%,rgba(70,110,230,0.07) 35%,rgba(0,0,0,0) 65%)}
.halo{background:radial-gradient(circle,rgba(255,160,70,0) 30%,rgba(255,150,60,0.42) 34%,rgba(255,130,40,0.12) 46%,rgba(0,0,0,0) 66%)}
.shadow{background:radial-gradient(circle,rgba(0,0,0,0.95) 0%,rgba(0,0,0,0.85) 36%,rgba(0,0,0,0.0) 70%);filter:blur(6px)}
.wave{border:3px solid rgba(255,190,110,0.95);box-shadow:0 0 18px rgba(255,150,50,0.8),inset 0 0 18px rgba(255,150,50,0.6)}
.wave.w2{border-color:rgba(255,170,90,0.6)}
.card{position:absolute;left:-270px;top:-66px;width:540px;height:132px;border-radius:30px;display:none;
  background:linear-gradient(180deg,rgba(40,46,60,0.92),rgba(24,28,38,0.92));
  box-shadow:inset 0 0 0 1.5px rgba(160,190,255,0.22),0 20px 50px rgba(0,0,0,0.5),0 0 40px rgba(80,130,255,0.18),inset 0 0 60px rgba(255,160,60,calc(var(--warm,0)*0.9));
  font-family:${FONT};color:#eef1f7;backface-visibility:hidden}
.card .ic{position:absolute;left:26px;top:30px;width:72px;height:72px;border-radius:18px;box-shadow:inset 0 2px 0 rgba(255,255,255,0.35)}
.card .ct{position:absolute;left:120px;top:24px;right:24px;display:flex;flex-direction:column;gap:4px}
.card b{font-weight:600;font-size:24px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(220,228,245,0.7)}
.card span{font-weight:500;font-size:33px;white-space:nowrap}
.card em{position:absolute;right:28px;top:26px;font-style:normal;font-size:22px;color:rgba(220,228,245,0.5)}
#ov{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;font-family:${FONT};color:#f6efe6;-webkit-font-smoothing:antialiased}
#vig{position:absolute;inset:0;background:radial-gradient(ellipse 75% 70% at 50% 50%,rgba(0,0,0,0) 55%,rgba(0,0,0,0.55) 100%)}
.cap{position:absolute;left:160px;overflow:hidden;padding:6px 0 12px;font-weight:600;font-size:66px;line-height:1.1;letter-spacing:-0.012em;white-space:nowrap}
.cap>span{display:inline-block;will-change:transform}
.k{font-weight:600;font-size:20px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(255,214,170,0.82)}
#eyebrow{position:absolute;left:166px;top:372px}
#word{position:absolute;left:156px;top:400px;font-weight:600;font-size:156px;line-height:1.1;letter-spacing:0.34em}
#sub{top:594px;font-weight:500;font-size:46px;color:rgba(246,239,230,0.86)}
.co{position:absolute;left:160px;width:${LABEL_W()}px;text-align:right}
.co .v{font-weight:500;font-size:30px;margin-top:6px;color:rgba(246,239,230,0.9)}
#timer{position:absolute;left:160px;top:430px}
#timerV{font-weight:600;font-size:168px;line-height:1;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;color:rgb(255,calc(230 - var(--hot,0)*40),calc(205 - var(--hot,0)*110))}
#timer .k{margin-top:16px}
#lock{position:absolute;left:0;width:${W}px;top:690px;text-align:center;font-weight:600;font-size:118px;line-height:1.1;letter-spacing:0.34em;padding-left:0.34em}
#tag{left:0;width:${W}px;top:838px;text-align:center;font-weight:500;font-size:44px;color:rgba(246,239,230,0.9)}
#cta{position:absolute;left:0;width:${W}px;top:938px;text-align:center}
#cta span{display:inline-block;padding:12px 30px;border-radius:40px;border:1.5px solid rgba(255,190,120,0.55);font-weight:600;font-size:21px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,214,170,0.95)}
#calm{left:0;width:${W}px;top:842px;text-align:center;font-size:70px}
`;
function LABEL_W() { return 540; }

const cap = (id, top, text, extra = "") => `<div class="cap" id="${id}" style="top:${top}px;opacity:0;${extra}"><span>${text}</span></div>`;
const callout = (id, k, v) => `<div class="co" id="${id}" style="opacity:0"><div class="k">${k}</div><div class="v">${v}</div></div>`;
const overlay = `<div id="ov">
<div id="vig"></div>
<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible">${["co1", "co2", "co3"].map((id) => `<polyline id="${id}l" points="" fill="none" stroke="rgba(255,226,196,0.85)" stroke-width="1.6" style="opacity:0"/><circle id="${id}d" cx="0" cy="0" r="5" fill="#ffd9b0" style="opacity:0"/>`).join("")}</svg>
${cap("h1", 414, "Some minutes")}${cap("h2", 490, "deserve all of you.")}
<div class="k" id="eyebrow" style="opacity:0">Introducing</div>
<div id="word" style="opacity:0">STILL</div>
${cap("sub", 594, "The focus dial.")}
${callout("co1", "Frosted glass", "Soft light, no glare")}
${callout("co2", "Knurled aluminium", "Turns in 60 firm clicks")}
${callout("co3", "Solid walnut", "Weighted to stay put")}
${cap("set", 330, "Turn to set.")}
<div id="timer" style="opacity:0"><div id="timerV">00:00</div><div class="k">one segment, one minute</div></div>
${cap("keep", 690, "The light keeps time.", "font-size:52px;color:rgba(246,239,230,0.88)")}
${cap("calm", 842, "Everything else can wait.")}
<div id="lock" style="opacity:0">STILL</div>
${cap("tag", 838, "One turn to deep work.")}
<div id="cta" style="opacity:0"><span>Reserve yours · Coming soon</span></div>
</div>`;

const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style><div id="view"><div id="ground"></div><div id="world"></div></div>${overlay}</div>\n<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "still", width: W, height: H });
