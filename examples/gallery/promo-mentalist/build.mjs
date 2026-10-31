// THE MENTALIST: a 30 s fan-made, unofficial promo. HTML and CSS 3D only.   node build.mjs
// The film scripts in film/ run after the app-film kit's film-core (camera maths) and overlay (lines, type) modules.
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";
import { cap } from "../_lib/app-film/build.mjs";
import { T } from "./timeline.mjs";

const W = 1920, H = 1080, PERSP = 1400;
const kit = ["film-core.js", "overlay.js"].map((f) => fs.readFileSync(new URL(`../_lib/app-film/browser/${f}`, import.meta.url), "utf8"));
const dir = new URL("./film/", import.meta.url);
const film = [`var W = ${W}, H = ${H}, PERSP = ${PERSP}, WIN_W = 0, WIN_H = 0;`, `var T = ${JSON.stringify(T)};`].concat(kit)
  .concat(fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, dir), "utf8"))).join("\n");

const FONT = "'Avenir Next','Helvetica Neue',Arial,sans-serif", HAND = "'Bradley Hand','Marker Felt','Noteworthy',cursive", SERIF = "'Didot','Bodoni 72','Iowan Old Style',Georgia,serif";
const css = `
*{box-sizing:border-box;margin:0}
.stage{background:radial-gradient(ellipse 60% 60% at 50% 45%,#141519 0%,#0a0b0e 55%,#050608 100%);color:#efe9dd}
#view{position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:${PERSP}px;perspective-origin:${W / 2}px ${H / 2}px}
#ground,#world{position:absolute;left:${W / 2}px;top:${H / 2}px;width:0;height:0;transform-style:preserve-3d}
#ground>div{position:absolute}
.g3{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d}
#world>div,.g3>div{position:absolute}
.table{background:radial-gradient(circle,rgba(255,207,138,0.28) 0%,rgba(120,80,40,0.25) 7%,rgba(30,20,12,0.9) 16%,#0b0806 30%),repeating-linear-gradient(90deg,rgba(255,255,255,0.02) 0 4px,transparent 4px 13px),#0b0806}
.cup{backface-visibility:hidden;box-shadow:inset 0 2px 0 rgba(255,255,255,0.6)}
.saucer{border-radius:50%;background:radial-gradient(circle,#efe9e0 0 52%,#d8d0c4 60%,#f4efe8 72%,#c9c1b4 74%,rgba(0,0,0,0.35) 76%,rgba(0,0,0,0) 86%)}
.handle{border-radius:50%;border:12px solid #ece6dc;box-shadow:inset 0 0 6px rgba(0,0,0,0.25)}
.tea{border-radius:50%;box-shadow:inset 0 0 12px rgba(0,0,0,0.6)}
.card{background:linear-gradient(180deg,#f3ede1,#e5ddce);border-radius:4px;box-shadow:0 18px 40px rgba(0,0,0,0.55);padding:22px 12px 0;display:flex;flex-direction:column;align-items:center;gap:8px;font-family:${HAND};color:#2a2420;backface-visibility:hidden}
.card b{display:grid;place-items:center;width:146px;height:120px;background:#d9d1c2;font-size:70px;font-weight:400;font-family:'Apple Color Emoji',sans-serif}
.card span{font-size:19px}
.card .pin{position:absolute;left:79px;top:6px;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ff6b6b,#9c0b1f);box-shadow:0 2px 3px rgba(0,0,0,0.5)}
#spot{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 45% 55% at 50% 50%,rgba(0,0,0,0) 40%,rgba(0,0,0,0.55) 100%)}
#teafill{position:absolute;inset:0;background:radial-gradient(circle,#5a2c10,#2a1206 70%,#0a0b0e);opacity:0}
#marks{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
#kline{stroke:#c8102e;filter:url(#paint) drop-shadow(0 0 6px rgba(200,16,46,0.6))}
#ring{fill:none;stroke:#c8102e;stroke-width:16;stroke-linecap:round;stroke-dasharray:1 1.02;filter:url(#paint)}
.eye{fill:#c8102e;filter:url(#paint)}
#lead{fill:none;stroke:rgba(239,233,221,0.85);stroke-width:1.6;stroke-dasharray:1 1.02}
#ded{position:absolute;left:1080px;max-width:760px;padding:18px 26px 20px;border-radius:10px;background:rgba(8,9,12,0.88);box-shadow:0 10px 40px rgba(0,0,0,0.6);opacity:0;font-family:${FONT}}
#ded small{display:block;font-weight:600;font-size:20px;letter-spacing:0.22em;text-transform:uppercase;color:#ffcf8a}
#ded b{display:block;font-family:${HAND};font-weight:400;font-size:44px;color:#efe9dd;margin-top:6px}
#ov{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;font-family:${FONT};-webkit-font-smoothing:antialiased}
.cap{position:absolute;left:130px;overflow:hidden;padding:6px 0 12px;font-weight:500;font-size:58px;line-height:1.08;letter-spacing:-0.01em;white-space:nowrap;color:#efe9dd;text-shadow:0 2px 30px rgba(0,0,0,0.8)}
.cap>span{display:inline-block}.cap .r{color:#e0293f}
#title{position:absolute;left:0;width:${W}px;top:430px;text-align:center;font-family:${SERIF};font-weight:400;font-size:132px;letter-spacing:0.22em;padding-left:0.22em;color:#f3ede1;opacity:0;text-shadow:0 4px 40px rgba(0,0,0,0.9)}
#tag{left:0;width:${W}px;top:600px;text-align:center;font-size:40px}
#cta{position:absolute;left:0;width:${W}px;top:700px;text-align:center;opacity:0}
#cta span{display:inline-block;padding:13px 34px;border:1.5px solid rgba(243,237,225,0.6);border-radius:40px;font-weight:600;font-size:22px;letter-spacing:0.12em;text-transform:uppercase}
#fan{position:absolute;left:0;width:${W}px;top:1010px;text-align:center;font-size:17px;color:rgba(239,233,221,0.55);opacity:0}
`;
const overlay = `
${cap("h1", 820, 'Look <span class="r">closer.</span>')}
${cap("h2", 820, "Every lie leaves a trace.")}
<div id="ded"><small id="dk"></small><b id="dv"></b></div>
${cap("h3", 820, 'Every detail <span class="r">matters.</span>')}
${cap("h4", 110, '<span class="r">Some patterns are a warning.</span>', "left:0;width:1920px;text-align:center")}
<div id="title">THE MENTALIST</div>
${cap("tag", 600, 'All seven seasons. Every detail <span class="r">matters.</span>', "left:0;width:1920px;text-align:center;font-size:40px")}
<div id="cta"><span>Stream the complete series</span></div>
<div id="fan">Fan-made promo. Not affiliated with or endorsed by CBS or Warner Bros. Television.</div>`;

const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>
<div id="view"><div id="ground"></div><div id="world"></div></div><div id="teafill"></div><div id="spot"></div>
<svg id="marks" width="${W}" height="${H}"><defs><filter id="paint" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter></defs>
<path id="lead" d="" pathLength="1" style="opacity:0"/><path id="kline" d="" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity:0"/>
<ellipse id="eyeL" class="eye" rx="0" ry="0"/><ellipse id="eyeR" class="eye" rx="0" ry="0"/><circle id="ring" r="0" pathLength="1" style="opacity:0"/></svg>
<div id="ov">${overlay}</div></div>
<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "mentalist", width: W, height: H });
