// LEAF: a 30 s ad for an invented e-reader. HTML and CSS 3D only.   node build.mjs
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

const FONT = "'Avenir Next','Helvetica Neue',Arial,sans-serif", SERIF = "'Iowan Old Style','Palatino',Georgia,serif";
const css = `
*{box-sizing:border-box;margin:0}
.stage{background:radial-gradient(ellipse 60% 65% at 55% 45%,#1a2340 0%,#0e1428 50%,#070a14 100%);color:#f4efe4}
#view{position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:${PERSP}px;perspective-origin:${W / 2}px ${H / 2}px}
#ground,#world{position:absolute;left:${W / 2}px;top:${H / 2}px;width:0;height:0;transform-style:preserve-3d}
.g3{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d}
#world>div,.g3>div{position:absolute}
#pool{position:absolute;left:-1500px;top:-1500px;width:3000px;height:3000px;transform:translateY(300px) rotateX(90deg);background:radial-gradient(circle,rgba(255,200,130,0.22) 0%,rgba(255,180,110,0.08) 18%,rgba(0,0,0,0) 36%);opacity:0}
.face{backface-visibility:hidden;background:linear-gradient(160deg,#3a3f4a,#22262e 60%,#1a1d23)}
.face.front{border-radius:18px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.12),inset 0 2px 0 rgba(255,255,255,0.18)}
.face.back{border-radius:18px;background:linear-gradient(160deg,#2c3038,#1b1e24)}
.face.side{background:linear-gradient(90deg,#4a505c,#2a2e36)}
.screen{position:absolute;left:20px;top:22px;width:260px;height:360px;overflow:hidden;border-radius:3px;background:#efeae0;clip-path:inset(0)}
.screen .warm{position:absolute;inset:0;background:#ffb867;opacity:calc(var(--warm,0) * 0.32)} /* no mix-blend-mode: it flattens the 3D group */
.screen .flash{position:absolute;inset:0;background:#fff;opacity:0}
.screen .cover{position:absolute;inset:0;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:radial-gradient(circle at 50% 40%,#1f6b46,#0f3a26);font-family:${FONT};color:#e9f7ee}
.cover b{font-weight:600;font-size:52px;letter-spacing:0.22em;padding-left:0.22em}.cover span{font-size:14px;letter-spacing:0.3em;text-transform:uppercase;opacity:0.75}
.leafmark{display:block;width:56px;height:56px;border-radius:0 60% 0 60%;background:linear-gradient(135deg,#9be3b2,#4fb07a);transform:rotate(0deg)}
.leafmark.big{position:absolute;left:110px;top:170px;width:80px;height:80px;opacity:0.5}
.slider{position:absolute;left:40px;right:40px;bottom:-34px;height:6px;border-radius:3px;background:rgba(255,255,255,0.15);opacity:0}
.slider i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#d8e6ff,#ffb867)}
.page{background:linear-gradient(180deg,#f7f2e8,#ebe4d6);box-shadow:0 20px 50px rgba(0,0,0,0.35),inset 0 0 0 1px rgba(120,100,70,0.15);backface-visibility:visible;overflow:hidden;clip-path:inset(0)}
.pg{position:absolute;inset:0;padding:26px 24px;font-family:${SERIF};color:#2a2a2e}
.pg small{display:block;font:600 10px ${FONT};letter-spacing:0.3em;color:#8a7f6c;margin-bottom:10px}
.pg b{display:block;font-weight:600;font-size:21px;line-height:1.15;margin-bottom:12px}
.pg p{font-size:12.2px;line-height:1.55;margin-bottom:8px;text-align:justify;hyphens:auto}
.pg .lines{position:absolute;left:24px;right:24px;top:58px;bottom:30px;background:repeating-linear-gradient(180deg,rgba(60,55,50,0.35) 0 2px,transparent 2px 13px)}
#ov{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;font-family:${FONT};-webkit-font-smoothing:antialiased}
.cap{position:absolute;left:130px;overflow:hidden;padding:6px 0 12px;font-weight:600;font-size:64px;line-height:1.08;letter-spacing:-0.02em;white-space:nowrap;color:#f4efe4;text-shadow:0 2px 30px rgba(5,8,18,0.6)}
.cap>span{display:inline-block}.cap .c{color:#7fd49b}.cap .w{color:#ffb867}
#lock{position:absolute;left:130px;top:360px;font-weight:600;font-size:150px;letter-spacing:0.2em;color:#f4efe4;opacity:0}
#tag{top:560px;font-size:44px;font-weight:500;color:rgba(244,239,228,0.9)}
#cta{position:absolute;left:130px;top:680px;opacity:0}
#cta span{display:inline-block;padding:14px 34px;border-radius:40px;background:#7fd49b;color:#0b1a12;font-weight:600;font-size:24px;box-shadow:0 10px 30px rgba(127,212,155,0.35)}
`;
const overlay = `
${cap("h1", 820, "Every story you love…")}
${cap("h2", 440, "…in one page.", "font-size:52px;color:rgba(244,239,228,0.85)")}${cap("h3", 510, '<span class="c">LEAF</span>', "font-size:110px;letter-spacing:0.2em")}
${cap("d1", 440, "Reads like paper.")}${cap("d2", 440, 'Warm light for <span class="w">late chapters.</span>')}
${cap("e1", 110, "Every book you own.")}${cap("e2", 180, '<span class="c">Everywhere you go.</span>')}
<div id="lock">LEAF</div>
${cap("tag", 560, 'Your whole library, <span class="c">one page thin.</span>')}
<div id="cta"><span>Pre-order now</span></div>`;

const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>
<div id="view"><div id="ground"><div id="pool"></div></div><div id="world"></div></div>
<div id="ov">${overlay}</div></div>
<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "leaf", width: W, height: H });
