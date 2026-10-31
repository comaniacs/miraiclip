// HALFTIDE: a 30 s ad for an invented fountain-pen ink. HTML, SVG and CSS 3D only.   node build.mjs
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
.stage{background:radial-gradient(ellipse 70% 65% at 50% 45%,#2a1d15 0%,#1a120d 55%,#0e0906 100%);color:#f3eee4}
#view{position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:${PERSP}px;perspective-origin:${W / 2}px ${H / 2}px}
#ground,#world{position:absolute;left:${W / 2}px;top:${H / 2}px;width:0;height:0;transform-style:preserve-3d}
.g3{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d}
#world>div,.g3>div{position:absolute}
.desk{position:absolute;left:-3000px;top:-3000px;width:6000px;height:6000px;transform:translateY(2px) rotateX(90deg);background:radial-gradient(circle,rgba(255,220,170,0.12) 0%,rgba(0,0,0,0) 30%),repeating-linear-gradient(88deg,rgba(255,255,255,0.015) 0 3px,transparent 3px 11px),#1a120d}
.paper{background:radial-gradient(ellipse at 45% 50%,#f6f1e7,#ece5d6 80%),#f3eee4;box-shadow:0 0 0 1px rgba(0,0,0,0.2);overflow:hidden}
.paper svg{position:absolute;left:0;top:0}
.drop{border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;background:radial-gradient(circle at 35% 30%,#8fb4ff 0 10%,#2c5fb8 30%,#132f66 85%);box-shadow:0 6px 18px rgba(10,30,80,0.5)}
.splash{border-radius:50%;border:4px solid rgba(31,79,158,0.6)}
.f{backface-visibility:hidden}
.glass{background:linear-gradient(150deg,rgba(255,255,255,0.22),rgba(255,255,255,0.05) 40%,rgba(255,255,255,0.12));box-shadow:inset 0 0 0 2px rgba(255,255,255,0.35),inset 6px 0 18px rgba(255,255,255,0.12)}
.glass.top{background:rgba(255,255,255,0.08)}
.inkf{background:linear-gradient(180deg,#2b63c4,#163a80 40%,#0e2552)}
.inkf.top{background:radial-gradient(circle at 40% 40%,#4b82e0,#1f4f9e 70%)}
.capf{background:linear-gradient(160deg,#2b2b2e,#0f0f11);box-shadow:inset 0 2px 0 rgba(255,255,255,0.18)}
.lbl{position:absolute;left:22px;right:22px;top:70px;height:150px;background:#f3eee4;border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-family:${FONT};color:#1a1a1e;box-shadow:0 2px 8px rgba(0,0,0,0.3)}
.lbl small{font-size:10px;letter-spacing:0.3em;color:#8a7f6c}.lbl b{font-weight:700;font-size:26px;letter-spacing:0.16em}
.lbl span{font-family:${SERIF};font-style:italic;font-size:17px;color:#1f4f9e}.lbl em{font-style:normal;font-size:9.5px;letter-spacing:0.12em;color:#6b6457}
#ov{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;font-family:${FONT};-webkit-font-smoothing:antialiased}
.cap{position:absolute;left:130px;overflow:hidden;padding:6px 0 12px;font-weight:600;font-size:64px;line-height:1.08;letter-spacing:-0.02em;white-space:nowrap;color:#f3eee4;text-shadow:0 2px 30px rgba(10,6,4,0.7)}
.cap>span{display:inline-block}.cap .c{color:#7fa8f0;font-family:${SERIF};font-style:italic;font-weight:500}
#i3,#d1,#d2{color:#16161a;text-shadow:0 1px 18px rgba(243,238,228,0.9)} #d1 .c,#d2 .c{color:#1f4f9e} /* these sit over the paper: ink on paper, not white on cream */
#lock{position:absolute;left:130px;top:360px;font-weight:700;font-size:130px;letter-spacing:0.16em;color:#f3eee4;opacity:0}
#tag{top:540px;font-size:46px;font-weight:500}
#cta{position:absolute;left:130px;top:660px;opacity:0}
#cta span{display:inline-block;padding:14px 34px;border-radius:40px;background:#1f4f9e;color:#fff;font-weight:600;font-size:24px;box-shadow:0 10px 30px rgba(31,79,158,0.5)}
`;
const overlay = `
${cap("i1", 400, "Every drop,", "font-size:52px")}${cap("i2", 466, 'a <span class="c">tide.</span>', "font-size:52px")}${cap("i3", 560, "HALFTIDE", "font-size:100px;letter-spacing:0.14em;font-weight:700")}
${cap("d1", 110, 'Write <span class="c">like water.</span>')}${cap("d2", 110, 'Shades <span class="c">as it dries.</span>')}
${cap("e1", 110, "Twelve colours.")}${cap("e2", 180, '<span class="c">One flow.</span>')}
<div id="lock">HALFTIDE</div>
${cap("tag", 540, 'Colour that moves <span class="c">like water.</span>')}
<div id="cta"><span>Explore the 12 tides</span></div>`;

const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>
<div id="view"><div id="ground"><div class="desk"></div></div><div id="world"></div></div>
<div id="ov">${overlay}</div></div>
<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "halftide", width: W, height: H });
