// "Foldwork", a 30 s launch film: a pop-up book whose city folds up from a flat page. HTML and CSS 3D only.
//   node build.mjs   writes sequence.html and video.miraiclip.json
// The film scripts in film/ run after the app-film kit's film-core (camera maths) and overlay (lines, type) modules.
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";
import { cap } from "../_lib/app-film/build.mjs";
import { T, CITY, popTimes } from "./timeline.mjs";

const W = 1920, H = 1080, PERSP = 1400;
const kit = ["film-core.js", "overlay.js"].map((f) => fs.readFileSync(new URL(`../_lib/app-film/browser/${f}`, import.meta.url), "utf8"));
const dir = new URL("./film/", import.meta.url);
const film = [`var W = ${W}, H = ${H}, PERSP = ${PERSP}, WIN_W = 0, WIN_H = 0;`, `var T = ${JSON.stringify(T)};`, `var CITY = ${JSON.stringify(CITY)};`, `var popTimes = ${popTimes.toString()};`]
  .concat(kit).concat(fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, dir), "utf8")))
  .join("\n");

const FONT = "'Avenir Next','Helvetica Neue',Arial,sans-serif";
const css = `
*{box-sizing:border-box;margin:0}
.stage{background:radial-gradient(ellipse 70% 60% at 50% 42%,#1d2130 0%,#11131b 55%,#0b0c11 100%);color:#f5f1e8}
#view{position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:${PERSP}px;perspective-origin:${W / 2}px ${H / 2}px}
#ground,#world{position:absolute;left:${W / 2}px;top:${H / 2}px;width:0;height:0;transform-style:preserve-3d}
.g3{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d}
#world>div,.g3>div{position:absolute}
.table{position:absolute;left:-5000px;top:-5000px;width:10000px;height:10000px;transform:translateY(${32}px) rotateX(90deg);background:radial-gradient(circle at 50% 50%,rgba(70,78,104,0.55) 0%,rgba(30,34,48,0.5) 14%,rgba(14,16,22,0) 34%)}
.bookshadow{position:absolute;left:-1750px;top:-680px;width:3500px;height:1360px;transform:translateY(31px) rotateX(90deg);border-radius:40px;background:rgba(0,0,0,0.55);filter:blur(30px)}
.page{background:linear-gradient(90deg,rgba(0,0,0,0.10),rgba(0,0,0,0) 6%),repeating-linear-gradient(17deg,rgba(120,100,70,0.025) 0 2px,transparent 2px 7px),#f2ede3;backface-visibility:hidden;overflow:hidden}
.page.left{background:linear-gradient(270deg,rgba(0,0,0,0.12),rgba(0,0,0,0) 6%),repeating-linear-gradient(-17deg,rgba(120,100,70,0.025) 0 2px,transparent 2px 7px),#f0ebe0}
.page svg{position:absolute;left:0;top:0;overflow:visible}
.pool{position:absolute;inset:0;background:radial-gradient(ellipse 60% 70% at 45% 45%,rgba(255,250,235,0.35),rgba(255,250,235,0) 70%)}
.dim{position:absolute;inset:0;background:#0f1424;opacity:0}
.creases path,.creases line{fill:none;stroke:rgba(80,70,55,0.35);stroke-width:2;stroke-dasharray:6 6}
.creases .st{stroke:rgba(80,70,55,0.22);stroke-width:2}
.creases .first{stroke:#ff5b3a;stroke-width:4;stroke-linecap:round;filter:drop-shadow(0 0 8px rgba(255,91,58,0.9))}
.plan line{stroke:rgba(40,70,140,0.22);stroke-width:2}
.plan rect{fill:rgba(40,70,140,0.05);stroke:#2c4a8c;stroke-width:3}
.plan rect.hot{stroke:#ff5b3a;fill:rgba(255,91,58,0.12)}
.plan .mark{fill:#ff5b3a;fill-opacity:0;stroke:#ff5b3a;stroke-width:6;stroke-linejoin:round}
.plan .mark.fold{fill:#c43d24}
.plan-label{font:600 22px ${FONT};letter-spacing:0.24em;fill:rgba(44,74,140,0.6)}
.edge{background:repeating-linear-gradient(180deg,#e9e3d6 0 2px,#d6cfbf 2px 3px);backface-visibility:hidden}
.cover{background:radial-gradient(ellipse at 40% 35%,#26315a,#1b2440 60%,#151c33),#1b2440;backface-visibility:hidden;box-shadow:inset 0 0 0 10px #172039,inset 0 0 0 12px rgba(255,91,58,0.35)}
.cover-in{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;font-family:${FONT}}
.cover-in svg path{fill:#ff5b3a}.cover-in svg path.fold{fill:#b8371f}
.cover-in b{font-weight:600;font-size:150px;letter-spacing:0.18em;color:#f2d9c4;text-shadow:0 2px 0 rgba(0,0,0,0.35)}
.cover-in span{font-weight:500;font-size:46px;color:rgba(242,217,196,0.75)}
.face{backface-visibility:hidden;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(90,80,60,0.18)}
.face .wins{position:absolute;left:14%;right:14%;top:12%;bottom:10%;background-image:linear-gradient(rgba(60,56,48,0.28) 0 16px,transparent 16px),linear-gradient(90deg,rgba(242,237,227,1) 0 8px,transparent 8px);background-blend-mode:normal;opacity:0.85}
.face .glow{position:absolute;left:14%;right:14%;top:12%;bottom:10%;opacity:var(--glow,0);background-image:linear-gradient(rgba(255,180,92,1) 0 16px,transparent 16px),linear-gradient(90deg,rgba(0,0,0,0) 0 8px,transparent 8px);background-size:inherit;filter:drop-shadow(0 0 6px rgba(255,170,80,0.9))}
.face.roof{box-shadow:inset 0 0 0 2px rgba(90,80,60,0.2)}
.shadow{position:absolute;border-radius:10px;background:rgba(40,30,20,0.55);filter:blur(10px);opacity:0}
.wing{left:-70px;top:0;width:140px;height:64px;transform-origin:50% 0;background:linear-gradient(180deg,#fbf8f1,#e7e1d4);clip-path:polygon(0 0,100% 0,18% 100%)}
#kl{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
#ov{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;font-family:${FONT};-webkit-font-smoothing:antialiased}
.cap{position:absolute;left:120px;overflow:hidden;padding:6px 0 12px;font-weight:600;font-size:64px;line-height:1.08;letter-spacing:-0.02em;white-space:nowrap;color:#f5f1e8;text-shadow:0 2px 30px rgba(8,9,14,0.6)}
.cap>span{display:inline-block}.cap .c{color:#ff7a5c}
#h1a,#h1b{color:#1c2030;text-shadow:none}#h1b .c{color:#e8492c}
#arclab{position:absolute;left:0;top:0;opacity:0;font-family:${FONT};text-shadow:0 2px 16px rgba(8,9,14,0.8)}
#arclab small{display:block;font-weight:600;font-size:18px;letter-spacing:0.26em;color:#ffb39f}
#arclab b{font-weight:600;font-size:52px;color:#fff;font-variant-numeric:tabular-nums}
#tag{left:0;width:${W}px;top:900px;text-align:center;font-size:44px;font-weight:500;color:rgba(245,241,232,0.9)}
#cta{position:absolute;left:0;width:${W}px;top:982px;text-align:center}
#cta span{display:inline-block;padding:13px 34px;border-radius:40px;background:#ff5b3a;color:#fff;font-weight:600;font-size:22px;letter-spacing:0.04em;box-shadow:0 10px 30px rgba(255,91,58,0.4)}
`;
const overlay = `
${cap("h1a", 430, "Every world")}${cap("h1b", 500, 'starts <span class="c">flat.</span>')}
${cap("h2a", 120, "Fold by fold,")}${cap("h2b", 190, "it takes shape.")}
${cap("h3a", 120, "Every crease,")}${cap("h3b", 190, 'a <span class="c">plan.</span>')}
${cap("h4a", 120, "Every plan,")}${cap("h4b", 190, 'a <span class="c">place.</span>')}
${cap("h5a", 120, "From flat plans")}${cap("h5b", 190, 'to <span class="c">living worlds.</span>')}
<div id="arclab"><small>FOLD</small><b id="arcv">0°</b></div>
${cap("tag", 900, "Foldwork turns flat plans into worlds you can walk through.")}
<div id="cta" style="opacity:0"><span>Unfold yours</span></div>`;

const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>
<div id="view"><div id="ground"><div class="table"></div><div class="bookshadow"></div></div><div id="world"></div></div>
<svg id="kl" width="${W}" height="${H}"><path id="arc" d="" fill="none" stroke="#ffb39f" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round" style="opacity:0"/><path id="kline" d="" fill="none" stroke="#ff5b3a" stroke-width="3.5" stroke-linecap="round" style="opacity:0;filter:drop-shadow(0 0 7px rgba(255,91,58,0.8))"/></svg>
<div id="ov">${overlay}</div></div>
<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "foldwork", width: W, height: H });
