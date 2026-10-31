// app-film kit · build: one call turns an app (its scripts and stylesheet), a timeline and a folder of film scripts
// into sequence.html and video.miraiclip.json. The kit's browser modules, base CSS and window markup come with it.
//
//   buildAppFilm(import.meta.url, {
//     id, T, ACTIONS,                       // T needs DUR and FPS; ACTIONS drive the app (see browser/replay.js)
//     app: { scripts: ["app/js/a.js", …], css: "app/styles.css" },
//     film: "film/",                        // *.js, concatenated in name order into one stage.build closure
//     css, overlay,                         // the film's own CSS and overlay markup (headlines, lockup)
//     world,                                // extra markup inside #world (optional)
//     win: { w: 1440, h: 900, title }, size: { w: 1920, h: 1080 }, persp: 1600, accent: "#ff6a4d",
//     inject: { name: value }               // more values or functions for the film scripts
//   })
//
// Lessons baked in, each of which cost a debugging round once:
// - the floor lives in its own 3D context (#ground), so it can never sort in front of the window or the product
// - #world's child rule excludes #win, so the window keeps its centring offset
// - transitions and animations inside the window are off (frames are pure functions of t) and carets are hidden
// - the focused-field look is a class (.is-focused), because a background tab never shows :focus
import fs from "node:fs";
import { writeExample } from "../write-example.mjs";

const KIT = new URL("./browser/", import.meta.url);
const KIT_FILES = ["film-core.js", "replay.js", "overlay.js"];

export function baseCss({ W, H, persp, win, accent }) {
  return `
.stage{color:#f7f4ee}
#view{position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:${persp}px;perspective-origin:${W / 2}px ${H / 2}px}
#ground,#world{position:absolute;left:${W / 2}px;top:${H / 2}px;width:0;height:0;transform-style:preserve-3d}
#world>div:not(#win),.g3>div{position:absolute;left:0;top:0}
.g3{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d}
#win{position:absolute;left:${-win.w / 2}px;top:${-win.h / 2}px;width:${win.w}px;height:${win.h}px;border-radius:16px;overflow:hidden;background:#fbfaf7;box-shadow:0 0 0 1px rgba(255,255,255,0.10),0 50px 140px rgba(0,0,0,0.55),0 12px 40px rgba(0,0,0,0.35)}
#win *{transition:none!important;animation:none!important;caret-color:transparent}
.bar{position:absolute;left:0;top:0;width:${win.w}px;height:${win.bar}px;background:#ece9e3;border-bottom:1px solid #ddd8cf;display:flex;align-items:center;justify-content:center;font:600 13px -apple-system,'SF Pro Text',sans-serif;color:#7d7a8c}
.bar i{position:absolute;top:${win.bar / 2 - 6}px;width:12px;height:12px;border-radius:50%}
.bar span{padding:5px 16px;border-radius:7px;background:#f7f5f1}
#appslot{position:absolute;left:0;top:${win.bar}px;width:${win.w}px;height:${win.h - win.bar}px}
.appwrap{width:100%;height:100%}
.appwrap .is-focused{border-color:${accent};box-shadow:0 0 0 3px ${accent}26}
#cursor{position:absolute;left:0;top:0;width:28px;height:28px;transform-origin:0 0;filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35))}
#ripple{position:absolute;left:-24px;top:-24px;width:48px;height:48px;border-radius:50%;border:2.5px solid ${accent};display:none}
#rmask{position:absolute;display:none;background:#fbfaff;border-top:2px solid #7c6cf2;box-shadow:0 -10px 24px rgba(124,108,242,0.35)}
#hl{position:absolute;display:none;height:3px;border-radius:2px;background:${accent};box-shadow:0 0 10px ${accent}99}
.clone{position:absolute;left:0;top:0}
.clone>*{width:100%;height:100%}
#kl{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
#ov{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;font-family:'Avenir Next','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased}
#scrim{position:absolute;inset:0;opacity:0;background:linear-gradient(90deg,rgba(16,15,27,0.92) 0%,rgba(16,15,27,0.78) 30%,rgba(16,15,27,0) 52%)}
.cap{position:absolute;left:120px;overflow:hidden;padding:6px 0 12px;font-weight:600;font-size:60px;line-height:1.08;letter-spacing:-0.02em;white-space:nowrap;color:#f7f4ee;text-shadow:0 2px 30px rgba(10,9,18,0.5)}
.cap>span{display:inline-block}
`;
}
/** a masked headline line; html may contain <span class="c"> for the accent colour */
export const cap = (id, top, html, extra = "") => `<div class="cap" id="${id}" style="top:${top}px;opacity:0;${extra}"><span>${html}</span></div>`;
const cursorSvg = `<svg id="cursor" viewBox="0 0 28 28"><path d="M3 2l18 11.5-8.2 1.7L9 23z" fill="#1d1b2c" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
function windowMarkup(win) {
  return `<div id="win"><div class="bar"><i style="left:16px;background:#ff5f57"></i><i style="left:36px;background:#febc2e"></i><i style="left:56px;background:#28c840"></i><span>${win.title}</span></div><div id="appslot"></div><div id="rmask"></div><div id="hl"></div><div id="ripple"></div>${cursorSvg}</div>`;
}

export function buildAppFilm(buildUrl, o) {
  const size = o.size || { w: 1920, h: 1080 }, persp = o.persp || 1600, accent = o.accent || "#ff6a4d";
  const win = Object.assign({ w: 1440, h: 900, bar: 40, title: "" }, o.win || {});
  const read = (p) => fs.readFileSync(new URL(p, buildUrl), "utf8");
  const appJs = o.app.scripts.map(read).join("\n");
  const appCss = o.app.css ? read(o.app.css) : "";
  const filmDir = new URL(o.film || "film/", buildUrl);
  const filmFiles = fs.readdirSync(filmDir).filter((f) => f.endsWith(".js")).sort();
  const inject = Object.assign({ W: size.w, H: size.h, PERSP: persp, WIN_W: win.w, WIN_H: win.h, BAR: win.bar, T: o.T, ACTIONS: o.ACTIONS }, o.inject || {});
  const prelude = Object.entries(inject).map(([k, v]) => `var ${k} = ${typeof v === "function" ? v.toString() : JSON.stringify(v)};`);
  const film = prelude
    .concat(KIT_FILES.map((f) => `// ==== kit/${f}\n` + fs.readFileSync(new URL(f, KIT), "utf8")))
    .concat(filmFiles.map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, filmDir), "utf8")))
    .join("\n");
  const markup = `<div id="view"><div id="ground">${o.ground || ""}</div><div id="world">${windowMarkup(win)}${o.world || ""}</div></div>
<svg id="kl" width="${size.w}" height="${size.h}"><path id="kline" d="" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" style="opacity:0;filter:drop-shadow(0 0 6px ${accent}b3)"/></svg>
<div id="ov"><div id="scrim"></div>${o.overlay || ""}</div>`;
  const html = `<div class="stage" data-libs="stage" data-duration="${o.T.DUR}" data-fps="${o.T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${size.w}px;height:${size.h}px;overflow:hidden"><style>${appCss}\n${baseCss({ W: size.w, H: size.h, persp, win, accent })}\n${o.css || ""}</style>${markup}</div>
<script>${appJs}</script>
<script>stage.build((tl, S) => {${film}});</script>`;
  writeExample(buildUrl, { html, duration: o.T.DUR, id: o.id, width: size.w, height: size.h });
}
