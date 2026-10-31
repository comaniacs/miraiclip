// "The flower doing math": a 30 s explainer on the golden angle. ~1,000 seeds on a canvas, placed by Vogel's model
// (r = c·√n, angle = n·θ), redrawn every frame as θ sweeps; type, a dial and a Fibonacci row in the DOM above.
//   node build.mjs
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";
import { T, GOLDEN } from "./timeline.mjs";

const W = 1920, H = 1080;
const kit = ["film-core.js", "overlay.js"].map((f) => fs.readFileSync(new URL(`../_lib/app-film/browser/${f}`, import.meta.url), "utf8"));
const dir = new URL("./film/", import.meta.url);
const film = [`var W = ${W}, H = ${H}, PERSP = 1600, WIN_W = 0, WIN_H = 0, GOLDEN = ${GOLDEN};`, `var T = ${JSON.stringify(T)};`].concat(kit)
  .concat(fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, dir), "utf8"))).join("\n");

const SERIF = "'Iowan Old Style','Palatino',Georgia,serif", SANS = "'Avenir Next','Helvetica Neue',Arial,sans-serif", MONO = "'SF Mono',Menlo,monospace";
const CREAM = "#f3e9d2", GOLD = "#f2b33d";
const css = `
*{box-sizing:border-box;margin:0}
.stage{background:radial-gradient(ellipse 70% 80% at 65% 50%,#221a10 0%,#120e09 55%,#0a0806 100%);color:${CREAM};font-family:${SANS};-webkit-font-smoothing:antialiased}
#cv{position:absolute;left:0;top:0}
#grain{position:absolute;inset:0;background:repeating-radial-gradient(circle at 30% 40%,rgba(255,255,255,0.012) 0 1px,transparent 1px 3px);pointer-events:none}
.cap{position:absolute;left:110px;overflow:hidden;padding:6px 0 16px;white-space:nowrap;font-family:${SERIF};font-style:italic;font-size:76px;line-height:1.05;color:${CREAM};opacity:0}
.cap>span{display:inline-block}
.cap b{font-style:normal;color:${GOLD};font-weight:600}
.cap.s{font-family:${SANS};font-style:normal;font-size:36px;font-weight:500;color:rgba(243,233,210,0.82);white-space:normal;width:720px;line-height:1.3}
.cap.s b{font-weight:700}
#dial{position:absolute;left:110px;top:590px;width:300px;height:300px;opacity:0}
#dnum{position:absolute;left:440px;top:668px;font:600 84px ${MONO};transform-origin:0 50%;letter-spacing:-0.02em;opacity:0}
#dfrac{position:absolute;left:446px;top:778px;font:500 32px ${SANS};color:rgba(243,233,210,0.7);opacity:0}
#fibrow{position:absolute;left:110px;top:900px;display:flex;gap:14px;font:600 40px ${MONO};opacity:0}
#fibrow span{padding:6px 12px;border-radius:12px;color:rgba(243,233,210,0.45)}
#fibrow span.on{color:#120e09;background:${GOLD}}
#cnt{position:absolute;left:110px;top:560px;font:700 220px ${MONO};letter-spacing:-0.05em;line-height:1;color:${GOLD};opacity:0}
#cntl{position:absolute;left:120px;top:790px;font:500 34px ${SANS};color:rgba(243,233,210,0.8);opacity:0}
#flash{position:absolute;inset:0;background:radial-gradient(circle at 1240px 540px,rgba(255,220,140,0.55),transparent 55%);opacity:0}
#big{position:absolute;left:110px;top:520px;font:700 190px ${MONO};letter-spacing:-0.05em;color:${GOLD};opacity:0}
#note{position:absolute;right:46px;bottom:28px;font:500 17px ${MONO};color:rgba(243,233,210,0.45)}
`;
const cap = (id, top, html, cls = "") => `<div class="cap ${cls}" id="${id}" style="top:${top}px"><span>${html}</span></div>`;
const ticks = Array.from({ length: 36 }, (_, k) => { const a = (k * 10 - 90) * Math.PI / 180, r0 = k % 9 === 0 ? 150 : 162; return `<line x1="${(190 + r0 * Math.cos(a)).toFixed(1)}" y1="${(190 + r0 * Math.sin(a)).toFixed(1)}" x2="${(190 + 176 * Math.cos(a)).toFixed(1)}" y2="${(190 + 176 * Math.sin(a)).toFixed(1)}" stroke="rgba(243,233,210,${k % 9 === 0 ? 0.8 : 0.35})" stroke-width="${k % 9 === 0 ? 3 : 2}"/>`; }).join("");
const body = `<canvas id="cv" width="${W}" height="${H}"></canvas><div id="grain"></div><div id="flash"></div>
<svg id="dial" viewBox="0 0 380 380"><circle cx="190" cy="190" r="176" fill="rgba(18,14,9,0.6)" stroke="rgba(243,233,210,0.3)" stroke-width="2"/>${ticks}
<path id="darc" fill="none" stroke="${GOLD}" stroke-width="10" stroke-linecap="round"/><line x1="190" y1="190" x2="190" y2="40" stroke="rgba(243,233,210,0.5)" stroke-width="3"/>
<line id="dneedle" x1="190" y1="190" x2="190" y2="30" stroke="${GOLD}" stroke-width="5" stroke-linecap="round"/><circle cx="190" cy="190" r="9" fill="${GOLD}"/></svg>
<div id="dnum">137.5°</div><div id="dfrac"></div>
${cap("h1", 150, "This flower is <b>doing math.</b>")}${cap("h2", 260, "Every new seed turns by the <b>same angle</b>, again and again.", "s")}
${cap("r1", 150, "One rule.")}${cap("r2", 250, "Turn by <b>θ</b>. Nudge outward. Repeat a thousand times.", "s")}
${cap("a0", 150, "But which angle?")}
${cap("a1", 250, "<b>¼ turn</b> → 4 spokes. Wasted gaps.", "s")}${cap("a2", 250, "<b>⅓ turn</b> → 3 spokes.", "s")}${cap("a3", 250, "<b>⅖ turn</b> → 5 spokes.", "s")}${cap("a4", 250, "Any neat fraction eventually <b>lines up</b> into spokes. Even 137° leaves gaps.", "s")}
${cap("g1", 150, "The <b>golden angle.</b>")}${cap("g2", 258, "360° × (1 − 1/φ) ≈ <b>137.5°</b>", "s")}${cap("g3", 320, "φ ≈ 1.618 is the number fractions approximate <b>worst</b>, so no two seeds ever line up. Perfect packing.", "s")}
${cap("f1", 150, "Now count the <b>spirals.</b>")}
<div id="cnt">0</div><div id="cntl"></div>
<div id="fibrow">${[1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89].map((n) => `<span>${n}</span>`).join("")}</div>
${cap("p1", 150, "No math class.<br>Just the <b>best way</b><br><b>to pack seeds.</b>")}<div id="big">137.5°</div>
<div id="note">Model: Vogel (1979), r = c·√n, angle = n·θ</div>`;

const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>${body}</div>
<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "golden", width: W, height: H });
