// TILDE: a 30 s ad for an invented sparkling water. HTML and CSS 3D only.   node build.mjs
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

const FONT = "'Avenir Next','Helvetica Neue',Arial,sans-serif";
const css = `
*{box-sizing:border-box;margin:0}
.stage{background:radial-gradient(ellipse 60% 70% at 55% 40%,#0d3a44 0%,#072a32 45%,#041a20 100%);color:#fff6e4}
#view{position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:${PERSP}px;perspective-origin:${W / 2}px ${H / 2}px}
#ground,#world{position:absolute;left:${W / 2}px;top:${H / 2}px;width:0;height:0;transform-style:preserve-3d}
.g3{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d}
#world>div,.g3>div{position:absolute}
.floor{position:absolute;left:-2500px;top:-2500px;width:5000px;height:5000px;transform:translateY(1px) rotateX(90deg);background:radial-gradient(circle,rgba(0,0,0,0.75) 0 4.5%,rgba(0,0,0,0) 9%)}
#floorglow{position:absolute;left:-2500px;top:-2500px;width:5000px;height:5000px;transform:translateY(2px) rotateX(90deg);background:radial-gradient(circle,rgba(120,220,220,0.18) 0%,rgba(40,140,150,0.08) 12%,rgba(0,0,0,0) 26%)}
.strip{backface-visibility:hidden}
.al{background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.05) 0 1px,rgba(0,0,0,0.04) 1px 3px)}
.rim{box-shadow:inset 0 2px 0 rgba(255,255,255,0.4)}
.lid{border-radius:50%;background:repeating-radial-gradient(circle,rgba(255,255,255,0.06) 0 1px,rgba(0,0,0,0.06) 1px 3px),conic-gradient(from 30deg,#c9ced3,#7f878e 25%,#d9dde0 50%,#80888f 75%,#c9ced3);box-shadow:inset 0 0 0 10px #9aa2a8,inset 0 0 0 13px #c9ced3}
.lid .tab{position:absolute;left:88px;top:46px;width:80px;height:118px;border-radius:40px;background:linear-gradient(160deg,#e3e6e8,#8d959b);box-shadow:inset 0 0 0 14px rgba(0,0,0,0.0),0 2px 4px rgba(0,0,0,0.4)}
.lid .tab::after{content:"";position:absolute;left:24px;top:18px;width:32px;height:40px;border-radius:16px;background:#5b6268}
.lid .hole{position:absolute;left:96px;top:150px;width:64px;height:44px;border-radius:22px 22px 30px 30px;background:linear-gradient(#6b7378,#9aa2a8)}
.lstrip{overflow:hidden;backface-visibility:hidden;clip-path:inset(0)}
.lstrip .shade{position:absolute;inset:0;background:#02161b}
.label{position:absolute;top:0;background:linear-gradient(180deg,#ffd23f 0%,#ffc72a 100%);font-family:${FONT};color:#173d43}
.label .sun{position:absolute;left:${(2 * Math.PI * 151) / 2 - 120}px;top:-60px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,#ff8a5c 0 55%,#ff6b4a 56% 100%);opacity:0.9}
.label .wave{position:absolute;left:0;right:0;height:60px;background:radial-gradient(40px 26px at 40px 0,transparent 98%,#ff6b4a 100%) 0 0/80px 60px repeat-x}
.label .w1{bottom:44px}.label .w2{bottom:0;background-color:#173d43;background-image:none;height:44px}
.label b,.label span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.label .lw{top:150px;font-weight:700;font-size:96px;letter-spacing:0.14em;color:#173d43}
.label .ls{top:258px;font-weight:600;font-size:22px;letter-spacing:0.32em}
.label .lm{top:110px;font-weight:600;font-size:18px;letter-spacing:0.08em;color:#fff6e4}
.label .lb{top:290px;font-weight:700;font-size:16px;letter-spacing:0.2em;color:#fff6e4}
.bubble{border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,0.95) 0 8%,rgba(255,255,255,0) 14%),radial-gradient(circle,rgba(170,240,240,0.05) 0 58%,rgba(200,250,250,0.55) 70%,rgba(255,255,255,0.15) 74%,rgba(255,255,255,0) 76%);backface-visibility:hidden}
.bubble.hero{box-shadow:0 0 40px rgba(150,240,240,0.35)}
.popring{border-radius:50%;border:3px solid rgba(220,255,255,0.9);box-shadow:0 0 30px rgba(180,255,255,0.8)}
.slice{border-radius:50%;backface-visibility:visible;opacity:0}
.slice::before{content:"";position:absolute;inset:7%;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,0.85) 0 2.5deg,transparent 2.5deg 36deg),radial-gradient(circle,#fffbe5 0 9%,transparent 10%)}
.slice.lemon{background:radial-gradient(circle,#fff3a6 0 52%,#ffe259 70%,#fff8d0 80% 86%,#f5c400 88% 100%)}
.slice.lime{background:radial-gradient(circle,#e8ffb0 0 52%,#b8e84a 70%,#f2ffd8 80% 86%,#4e9a1e 88% 100%)}
#kl{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
#ov{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;font-family:${FONT};-webkit-font-smoothing:antialiased}
.cap{position:absolute;left:130px;overflow:hidden;padding:6px 0 12px;font-weight:600;font-size:64px;line-height:1.08;letter-spacing:-0.02em;white-space:nowrap;color:#fff6e4;text-shadow:0 2px 30px rgba(2,20,24,0.6)}
.cap>span{display:inline-block}.cap .c{color:#ffd23f}
.fact{position:absolute;left:1420px;font-weight:600;color:#fff6e4;opacity:0}
.fact small{display:block;font-size:18px;letter-spacing:0.3em;color:#ffd23f}
#f1{top:300px;font-size:120px;line-height:1}#f1 em{font-style:normal;font-size:40px;margin-left:14px}
#f2{top:450px;font-size:40px}#f3{top:510px;font-size:40px}#f4{top:600px;font-size:28px;color:#ffd23f;letter-spacing:0.04em}
#lock{position:absolute;left:130px;top:350px;font-weight:700;font-size:150px;letter-spacing:0.16em;color:#ffd23f;opacity:0}
#lockw{position:absolute;left:136px;top:530px;overflow:visible}
#tag{top:600px;font-size:44px;font-weight:500;color:rgba(255,246,228,0.92)}
#cta{position:absolute;left:130px;top:700px;opacity:0}
#cta span{display:inline-block;padding:14px 34px;border-radius:40px;background:#ff6b4a;color:#fff;font-weight:600;font-size:24px;box-shadow:0 10px 30px rgba(255,107,74,0.4)}
`;
const overlay = `
${cap("i1", 380, "Sparkling citrus water.", "font-size:48px;color:rgba(255,246,228,0.85)")}
${cap("i2", 440, '<span class="c">Pure fizz.</span> Nothing else.')}
${cap("f0", 140, 'Nothing <span class="c">to hide.</span>', "left:1420px")}
<div class="fact" id="f1"><small>INGREDIENTS</small><span id="f1n">0</span><em>only</em></div>
<div class="fact" id="f2">Spring water</div><div class="fact" id="f3">Lemon · Lime</div><div class="fact" id="f4">0 g sugar · 0 sweeteners</div>
${cap("e1", 120, 'Bright. Crisp. <span class="c">Honest.</span>')}
<div id="lock">TILDE</div>
<svg id="lockw" width="560" height="60" viewBox="0 0 560 60"><path id="lockwave" pathLength="1" d="M4 30 C 74 -6, 144 66, 214 30 S 354 -6, 424 30 S 520 60, 556 26" fill="none" stroke="#ff6b4a" stroke-width="8" stroke-linecap="round" style="stroke-dasharray:1 1.02;stroke-dashoffset:1"/></svg>
${cap("tag", 600, 'Nothing to hide. <span class="c">Everything to taste.</span>')}
<div id="cta"><span>Find it chilled</span></div>`;

const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>
<div id="view"><div id="ground"><div class="floor"></div><div id="floorglow"></div></div><div id="world"></div></div>
<svg id="kl" width="${W}" height="${H}"><path id="kline" d="" fill="none" stroke="#ff6b4a" stroke-width="5" stroke-linecap="round" style="opacity:0;filter:drop-shadow(0 0 8px rgba(255,107,74,0.8))"/></svg>
<div id="ov">${overlay}</div></div>
<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "tilde", width: W, height: H });
