// The Kiteline launch film: HTML, CSS 3D and the real app, no WebGL.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
//
// The app's own scripts (app/js/core.js, views.js, ui.js) and stylesheet are embedded unchanged; the film scripts in
// film/ are concatenated into one stage.build closure with the timeline (timeline.mjs) injected, so the actions the
// film performs and the sounds in audio.mjs come from the same list.
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";
import { T, ACTIONS, retypeAt } from "./timeline.mjs";

const W = 1920, H = 1080;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const appJs = ["app/js/core.js", "app/js/views.js", "app/js/ui.js"].map(read).join("\n");
const appCss = read("app/styles.css");
const dir = new URL("./film/", import.meta.url);
const film = [`var T = ${JSON.stringify(T)};`, `var ACTIONS = ${JSON.stringify(ACTIONS)};`, `var retypeAt = ${retypeAt.toString()};`]
  .concat(fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, dir), "utf8")))
  .join("\n");

const DISPLAY = "'Avenir Next','Helvetica Neue',Arial,sans-serif";
const css = `
.stage{background:radial-gradient(ellipse 60% 55% at 18% 12%,rgba(255,106,77,0.20),rgba(255,106,77,0) 70%),radial-gradient(ellipse 55% 55% at 88% 92%,rgba(124,108,242,0.20),rgba(124,108,242,0) 70%),linear-gradient(180deg,#171627,#100f1b);color:#f7f4ee}
#view{position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:1600px;perspective-origin:${W / 2}px ${H / 2}px}
#ground,#world{position:absolute;left:${W / 2}px;top:${H / 2}px;width:0;height:0;transform-style:preserve-3d}
#world>div:not(#win),.g3>div{position:absolute;left:0;top:0}
.g3{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d}
.floor{position:absolute;left:-3000px;top:-3000px;width:6000px;height:6000px;transform:translateY(560px) rotateX(90deg);background:radial-gradient(circle,rgba(255,255,255,0.13) 1.4px,transparent 1.6px) 0 0/48px 48px;-webkit-mask:radial-gradient(circle at 50% 50%,#000 0 18%,transparent 48%);mask:radial-gradient(circle at 50% 50%,#000 0 18%,transparent 48%)}
#winShadow{position:absolute;left:-800px;top:-260px;width:1600px;height:520px;transform:translateY(559px) rotateX(90deg);border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,0.6),rgba(0,0,0,0))}
#win{position:absolute;left:-720px;top:-450px;width:1440px;height:900px;border-radius:16px;overflow:hidden;background:#fbfaf7;box-shadow:0 0 0 1px rgba(255,255,255,0.10),0 50px 140px rgba(0,0,0,0.55),0 12px 40px rgba(0,0,0,0.35)}
#win *{transition:none!important;animation:none!important;caret-color:transparent}
.bar{position:absolute;left:0;top:0;width:1440px;height:40px;background:#ece9e3;border-bottom:1px solid #ddd8cf;display:flex;align-items:center;justify-content:center;font:600 13px -apple-system,'SF Pro Text',sans-serif;color:#7d7a8c}
.bar i{position:absolute;top:14px;width:12px;height:12px;border-radius:50%}
.bar span{padding:5px 16px;border-radius:7px;background:#f7f5f1}
#appslot{position:absolute;left:0;top:40px;width:1440px;height:860px}
.appwrap{width:100%;height:100%}
.kl-app .kl-focus{border-color:#ff6a4d;box-shadow:0 0 0 3px rgba(255,106,77,0.15)}
#cursor{position:absolute;left:0;top:0;width:28px;height:28px;transform-origin:0 0;filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35))}
#ripple{position:absolute;left:-24px;top:-24px;width:48px;height:48px;border-radius:50%;border:2.5px solid #ff6a4d;display:none}
#rmask{position:absolute;display:none;background:#fbfaff;border-top:2px solid #7c6cf2;box-shadow:0 -10px 24px rgba(124,108,242,0.35)}
#hl{position:absolute;display:none;height:3px;border-radius:2px;background:#ff6a4d;box-shadow:0 0 10px rgba(255,106,77,0.6)}
.idea{border-radius:14px;padding:14px 16px;background:rgba(255,255,255,0.95);color:#1d1b2c;font:500 18px/1.3 -apple-system,'SF Pro Text',sans-serif;box-shadow:0 18px 50px rgba(0,0,0,0.35);backface-visibility:hidden;overflow:hidden}
.idea .ih,.idea p{opacity:calc(1 - var(--m,0) * 1.6)}
.idea .ih{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;font-weight:600;color:#908da0;letter-spacing:0.04em;text-transform:uppercase}
.idea p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.idea .kl-pf{display:inline-grid;place-items:center;min-width:22px;height:19px;padding:0 4px;border-radius:5px;font:700 11px/1 -apple-system,sans-serif;font-style:normal;color:#fff}
.idea .p-linkedin{background:#2f6fd1}.idea .p-instagram{background:#d64f86}.idea .p-x{background:#26252f}
.idea.real{border-radius:calc(14px - 8px * var(--m,0))}
.idea.loose{background:rgba(255,248,232,0.9);color:#5d5a6e;font-style:italic}
.tile{border-radius:8px;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.05)}
.carry{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:12px;background:#fff;border:2px solid #ff6a4d;box-shadow:0 24px 60px rgba(0,0,0,0.35);color:#1d1b2c;font-family:-apple-system,'SF Pro Text',sans-serif}
.carry small{font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#e8492c}
.carry b{font-size:28px;font-weight:650;line-height:1}.carry span{font-size:12.5px;color:#5d5a6e}
.kl-app.kl-clone{display:block;width:auto;height:auto;background:none;overflow:visible;grid-template-columns:none;position:absolute;left:0;top:0}
.kl-clone>*{width:100%;height:100%}
.fly,.hero{filter:drop-shadow(0 30px 50px rgba(0,0,0,0.35))}
.hero{border-radius:14px}
.lchip>.kl-chip{box-shadow:0 10px 24px rgba(0,0,0,0.25)}
.lchip.launch>.kl-chip{border:1.5px solid #ff6a4d;background:#fff4f1;box-shadow:0 0 0 3px rgba(255,106,77,0.25),0 12px 28px rgba(255,106,77,0.35)}
.lshadow{border-radius:6px;background:rgba(29,27,44,0.45);filter:blur(5px)}
#kl{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
#ov{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;font-family:${DISPLAY};-webkit-font-smoothing:antialiased}
#scrim{position:absolute;inset:0;opacity:0;background:linear-gradient(90deg,rgba(16,15,27,0.92) 0%,rgba(16,15,27,0.78) 30%,rgba(16,15,27,0) 52%)}
.cap{position:absolute;left:120px;overflow:hidden;padding:6px 0 12px;font-weight:600;font-size:60px;line-height:1.08;letter-spacing:-0.02em;white-space:nowrap;color:#f7f4ee;text-shadow:0 2px 30px rgba(10,9,18,0.5)}
.cap>span{display:inline-block}
.cap .c{color:#ff8a6d}
#lock{position:absolute;left:0;width:${W}px;top:700px;display:flex;align-items:center;justify-content:center;gap:26px;font-weight:600;font-size:104px;letter-spacing:-0.035em;line-height:1}
#lockMark{position:relative;width:70px;height:70px;border-radius:10px 26px 10px 26px;background:linear-gradient(135deg,#ff9a7d,#ff6a4d 55%,#e8492c);box-shadow:0 10px 40px rgba(255,106,77,0.45)}
#tag{left:0;width:${W}px;top:832px;text-align:center;font-weight:500;font-size:38px;letter-spacing:-0.01em;color:rgba(247,244,238,0.86)}
#cta{position:absolute;left:0;width:${W}px;top:924px;text-align:center}
#cta span{display:inline-block;padding:14px 34px;border-radius:40px;background:#ff6a4d;color:#fff;font:650 22px/1 -apple-system,'SF Pro Text',sans-serif;box-shadow:0 10px 30px rgba(255,106,77,0.4)}
`;
const cap = (id, top, html, extra = "") => `<div class="cap" id="${id}" style="top:${top}px;opacity:0;${extra}"><span>${html}</span></div>`;
const cursorSvg = `<svg id="cursor" viewBox="0 0 28 28"><path d="M3 2l18 11.5-8.2 1.7L9 23z" fill="#1d1b2c" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const markup = `<div id="view"><div id="ground"><div class="floor"></div><div id="winShadow"></div></div><div id="world">
<div id="win"><div class="bar"><i style="left:16px;background:#ff5f57"></i><i style="left:36px;background:#febc2e"></i><i style="left:56px;background:#28c840"></i><span>Kiteline · Fieldnote workspace · local demo</span></div><div id="appslot"></div><div id="rmask"></div><div id="hl"></div><div id="ripple"></div>${cursorSvg}</div>
</div></div>
<svg id="kl" width="${W}" height="${H}"><path id="kline" d="" fill="none" stroke="#ff6a4d" stroke-width="3" stroke-linecap="round" style="opacity:0;filter:drop-shadow(0 0 6px rgba(255,106,77,0.7))"/></svg>
<div id="ov"><div id="scrim"></div>
${cap("h1a", 452, "Your ideas are everywhere.")}${cap("h1b", 452, 'Give them a <span class="c">line.</span>')}
${cap("h2a", 418, "Plan every channel")}${cap("h2b", 488, "in one calendar.")}
${cap("h3a", 418, "A rough idea becomes")}${cap("h3b", 488, 'a <span class="c">real brief.</span>')}
${cap("h4a", 452, 'Edit it. See it <span class="c">live.</span>')}
${cap("h5a", 96, "From idea to scheduled.")}${cap("h5b", 166, '<span class="c">In one flow.</span>')}
<div id="lock" style="opacity:0"><div id="lockMark"></div>Kiteline</div>
${cap("tag", 832, "Plan, write and schedule your social posts in one calm flow.")}
<div id="cta" style="opacity:0"><span>Start planning</span></div></div>`;

const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${appCss}\n${css}</style>${markup}</div>
<script>${appJs}</script>
<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "kiteline", width: W, height: H });
