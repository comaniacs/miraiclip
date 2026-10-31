// Aperture: a 30 s Miraiclip launch film. Editorial poster type, real product screenshots, and the hexagon mark as an
// aperture that opens on the product and closes into the logo. HTML and CSS 3D only.   node build.mjs
// Screenshots and fonts are inlined as data: URIs; the film sets each <img> src only while it is on screen, so every
// frame's snapshot carries just the pictures it shows.
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";
import { cap } from "../_lib/app-film/build.mjs";
import { T, BEAT } from "./timeline.mjs";

const W = 1920, H = 1080;
const read = (f) => fs.readFileSync(new URL(f, import.meta.url));
const IMG = Object.fromEntries(["ed0", "ed1", "ed2", "ed3", "ed4", "land-hero", "land-effects", "land-cases", "land-grid"]
  .map((n) => [n, "data:image/jpeg;base64," + read(`./shots/${n}.jpg`).toString("base64")]));
const font = (f) => "data:font/woff2;base64," + read(`./shots/${f}`).toString("base64");
const kit = ["film-core.js", "overlay.js"].map((f) => fs.readFileSync(new URL(`../_lib/app-film/browser/${f}`, import.meta.url), "utf8"));
const dir = new URL("./film/", import.meta.url);
const film = [`var W = ${W}, H = ${H}, PERSP = 1600, WIN_W = 0, WIN_H = 0, BEAT = ${BEAT};`, `var T = ${JSON.stringify(T)};`, `var IMG = ${JSON.stringify(IMG)};`].concat(kit)
  .concat(fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, dir), "utf8"))).join("\n");

// the hexagon mark from docs/public/images/logo.svg
const MARK = `<svg viewBox="0 0 180 180"><path fill="currentColor" fill-rule="evenodd" d="m 105.50024,22.224647 c -9.59169,-5.537563 -21.40871,-5.537563 -31.000093,0 L 39.054693,42.689119 C 29.463353,48.226675 23.55484,58.460531 23.55484,69.535642 v 40.928918 c 0,11.07542 5.908513,21.3092 15.499853,26.84652 l 35.445453,20.46446 c 9.591313,5.53732 21.408404,5.53732 31.000094,0 l 35.44507,-20.46446 c 9.59131,-5.53732 15.49985,-15.7711 15.49985,-26.84652 V 69.535642 c 0,-11.075111 -5.90854,-21.308967 -15.49985,-26.846523 z M 34.112797,85.737639 c -1.384445,2.397827 -1.384445,5.352099 0,7.749927 l 24.781554,42.922974 c 1.38437,2.39783 3.942853,3.87496 6.711592,3.87496 h 49.563107 c 2.76905,0 5.3273,-1.47713 6.71144,-3.87496 l 24.78194,-42.922974 c 1.38414,-2.397828 1.38414,-5.3521 0,-7.749927 L 121.88049,42.814746 c -1.38414,-2.397828 -3.94239,-3.874964 -6.71144,-3.874964 H 65.605944 c -2.768739,0 -5.327223,1.477059 -6.711592,3.874964 z"/></svg>`;

const SANS = "Geist,'Helvetica Neue',Arial,sans-serif", MONO = "'Geist Mono',Menlo,monospace";
const css = `
@font-face{font-family:Geist;src:url(${font("Geist-Variable.woff2")}) format("woff2");font-weight:100 900}
@font-face{font-family:'Geist Mono';src:url(${font("GeistMono-Variable.woff2")}) format("woff2");font-weight:100 900}
*{box-sizing:border-box;margin:0}
.stage{background:#0d0d0d;color:#0d0d0d;font-family:${SANS};-webkit-font-smoothing:antialiased}
.full{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden}
img{display:block}
#hook .word{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:420px;letter-spacing:-0.065em;line-height:1;white-space:nowrap}
.meta{position:absolute;font:600 22px ${MONO};letter-spacing:0.14em;text-transform:uppercase}
#hmeta{left:80px;top:64px}#hcount{right:80px;top:64px}#hfoot{left:80px;bottom:60px}
#ap{background:#0d0d0d}
#apcard,#tcards>div,.win{position:absolute;border-radius:18px;overflow:hidden;box-shadow:0 50px 120px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.08)}
#apcard img,#tcards img{width:100%;height:100%}
#hexline{position:absolute;left:0;top:0}
.cap{position:absolute;left:96px;overflow:hidden;padding:4px 0 16px;font-weight:800;font-size:96px;line-height:1;letter-spacing:-0.05em;white-space:nowrap;color:#f2efe8}
.cap>span{display:inline-block}
.y{color:#ffd400}
#tscene{perspective:1800px;perspective-origin:960px 560px}
#twipe{position:absolute;inset:0}
#tcards{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-style:preserve-3d}
#tcount{right:96px;bottom:70px}
#tour img{position:absolute;left:0;top:0;width:1600px;height:900px;transform-origin:0 0}
#scrim{position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,13,13,0.85),rgba(13,13,13,0.35))}
#ring{position:absolute;left:0;top:0}
#chip{position:absolute;left:96px;bottom:96px;padding:22px 34px;border-radius:999px;background:#ffd400;color:#0d0d0d;font-weight:700;font-size:44px;letter-spacing:-0.02em;box-shadow:0 20px 60px rgba(0,0,0,0.45);white-space:nowrap}
#chip small{display:block;font:600 18px ${MONO};letter-spacing:0.14em;text-transform:uppercase;opacity:0.6;margin-bottom:4px}
#band{position:absolute;left:96px;top:80px;padding:14px 26px;background:#0d0d0d;color:#f2efe8;font-weight:700;font-size:40px;letter-spacing:-0.02em;border-radius:12px;box-shadow:0 0 0 2px #ffd400}
#proof{background:#f2efe8;perspective:1800px;perspective-origin:960px 600px}
#pstack{position:absolute;inset:0;transform-style:preserve-3d}
.win{width:1400px;height:720px;background:#0b0b0b;box-shadow:0 60px 120px rgba(13,13,13,0.35),0 0 0 1px rgba(13,13,13,0.12)}
.win .bar{height:46px;background:#1a1a1a;display:flex;align-items:center;gap:9px;padding-left:20px}
.win .bar i{width:13px;height:13px;border-radius:7px;background:#3a3a3a}
.win .bar span{margin-left:auto;margin-right:auto;transform:translateX(-30px);padding:6px 70px;border-radius:8px;background:#0d0d0d;font:500 17px ${MONO};color:#9a9a9a}
.win .vp{position:absolute;left:0;top:46px;right:0;bottom:0;overflow:hidden}
.win .vp img{width:100%}
#pcap{color:#0d0d0d}
#end{background:#f2efe8}
#ewin{left:269px;top:170px;width:1382px;height:820px}
#ewin .vp img{width:1382px}
#eyel{position:absolute;inset:0;background:#ffd400}
#mark{position:absolute;left:870px;top:150px;width:180px;height:180px;color:#0d0d0d}
#mark svg{width:100%;height:100%}
#ename{position:absolute;left:0;right:0;top:360px;text-align:center;font-weight:800;font-size:200px;letter-spacing:-0.065em;line-height:1}
#etag{position:absolute;left:0;right:0;top:612px;text-align:center;font-weight:600;font-size:46px;letter-spacing:-0.025em}
#eurl{position:absolute;left:760px;top:730px;width:400px;height:96px;border-radius:48px;background:#0d0d0d;color:#ffd400;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:42px;letter-spacing:-0.02em}
#eoss{position:absolute;left:0;right:0;top:880px;text-align:center;font:600 22px ${MONO};letter-spacing:0.2em}
#credit{position:absolute;left:96px;bottom:34px;padding:6px 14px;border-radius:8px;background:rgba(13,13,13,0.7);font:500 15px ${MONO};color:rgba(242,239,232,0.75);letter-spacing:0.02em}
`;
const winHtml = (id, n) => `<div class="win" id="${id}"><div class="bar"><i></i><i></i><i></i><span>miraiclip.com</span></div><div class="vp"><img data-img="${n}"></div></div>`;
const body = `
<div id="hook" class="full"></div>
<div id="ap" class="full"><div id="apclip" class="full"><div id="apcard"><img data-img="ed0"></div></div><svg id="hexline" width="${W}" height="${H}"><polygon fill="none" stroke="#ffd400" stroke-width="5"/></svg>
${cap("aph", 70, 'Give them a <span class="y">real editor.</span>')}</div>
<div id="tscene" class="full"><div id="tbase" class="full"></div><div id="twipe"></div><div id="tcards"></div>
${cap("th1", 70, "One engine.")}${cap("th2", 70, "Every look.", "left:740px")}<div id="tcount" class="meta">01 / 05 themes</div></div>
<div id="tour" class="full"><img data-img="ed0"><div id="scrim"></div><svg id="ring" width="${W}" height="${H}"><polygon fill="none" stroke="#ffd400" stroke-width="6"/></svg>
${cap("tu1", 380, "You bring the UI.", "font-size:130px")}${cap("tu2", 530, '<span class="y">We bring the rest.</span>', "font-size:130px")}
<div id="band">We bring the rest.</div><div id="chip"><small id="chipk">01</small><span id="chipt"></span></div></div>
<div id="proof" class="full">${cap("pcap", 64, "Live on day one.", "color:#0d0d0d")}<div id="pstack">${winHtml("w0", "land-effects")}${winHtml("w1", "land-cases")}${winHtml("w2", "land-grid")}</div></div>
<div id="end" class="full">${winHtml("ewin", "land-hero")}<div id="eyel"></div><div id="mark">${MARK}</div>
<div id="ename">Miraiclip</div><div id="etag">Build video editors, not video editor plumbing.</div><div id="eurl">miraiclip.com</div><div id="eoss">OPEN SOURCE · MIT</div></div>
<div id="credit">Big Buck Bunny © Blender Foundation · CC BY 3.0</div>`;

const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>${body}</div>
<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "aperture", width: W, height: H });
console.log(`template ${(html.length / 1e6).toFixed(2)} MB`);
