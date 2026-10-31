// Miraiclip launch film: 30 s of motion graphics on one deterministic timeline. HTML and CSS 3D only.   node build.mjs
// The film scripts in film/ run after the app-film kit's film-core (camera maths) and overlay (type helpers) modules.
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";
import { cap } from "../_lib/app-film/build.mjs";
import { T, CPS } from "./timeline.mjs";

const W = 1920, H = 1080, PERSP = 1400;
const kit = ["film-core.js", "overlay.js"].map((f) => fs.readFileSync(new URL(`../_lib/app-film/browser/${f}`, import.meta.url), "utf8"));
const dir = new URL("./film/", import.meta.url);
const film = [`var W = ${W}, H = ${H}, PERSP = ${PERSP}, WIN_W = 0, WIN_H = 0;`, `var T = ${JSON.stringify(T)}, CPS = ${CPS};`].concat(kit)
  .concat(fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, dir), "utf8"))).join("\n");

// the hexagon mark from docs/public/images/logo.svg
const LOGO = `<svg viewBox="0 0 180 180"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5eead4"/><stop offset="0.55" stop-color="#2dd4bf"/><stop offset="1" stop-color="#8b7bff"/></linearGradient></defs><path fill="url(#lg)" fill-rule="evenodd" d="m 105.50024,22.224647 c -9.59169,-5.537563 -21.40871,-5.537563 -31.000093,0 L 39.054693,42.689119 C 29.463353,48.226675 23.55484,58.460531 23.55484,69.535642 v 40.928918 c 0,11.07542 5.908513,21.3092 15.499853,26.84652 l 35.445453,20.46446 c 9.591313,5.53732 21.408404,5.53732 31.000094,0 l 35.44507,-20.46446 c 9.59131,-5.53732 15.49985,-15.7711 15.49985,-26.84652 V 69.535642 c 0,-11.075111 -5.90854,-21.308967 -15.49985,-26.846523 z M 34.112797,85.737639 c -1.384445,2.397827 -1.384445,5.352099 0,7.749927 l 24.781554,42.922974 c 1.38437,2.39783 3.942853,3.87496 6.711592,3.87496 h 49.563107 c 2.76905,0 5.3273,-1.47713 6.71144,-3.87496 l 24.78194,-42.922974 c 1.38414,-2.397828 1.38414,-5.3521 0,-7.749927 L 121.88049,42.814746 c -1.38414,-2.397828 -3.94239,-3.874964 -6.71144,-3.874964 H 65.605944 c -2.768739,0 -5.327223,1.477059 -6.711592,3.874964 z"/></svg>`;

const FONT = "'Avenir Next','Helvetica Neue',Arial,sans-serif", MONO = "'SF Mono',Menlo,Consolas,monospace";
const css = `
*{box-sizing:border-box;margin:0}
.stage{background:#05070b;color:#eef3f2;font-family:${FONT};-webkit-font-smoothing:antialiased}
#bg{position:absolute;inset:0;overflow:hidden}
#bg i{position:absolute;border-radius:50%;filter:blur(90px)}
#grid{position:absolute;inset:0;background:linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px) 0 0/80px 80px,linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px) 0 0/80px 80px;-webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 50%,#000 30%,transparent 80%)}
#view{position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:${PERSP}px;perspective-origin:${W / 2}px ${H / 2}px}
#ground,#world{position:absolute;left:${W / 2}px;top:${H / 2}px;width:0;height:0;transform-style:preserve-3d}
#world>div,#ground>div{position:absolute;left:0;top:0}
#panel{width:1560px;height:556px;border-radius:22px;background:linear-gradient(180deg,rgba(22,28,38,0.92),rgba(12,16,23,0.94));box-shadow:0 0 0 1px rgba(255,255,255,0.08),0 40px 120px rgba(0,0,0,0.55),0 0 160px rgba(45,212,191,0.10)}
#ruler{position:absolute;left:60px;right:20px;top:14px;height:30px;background:repeating-linear-gradient(90deg,rgba(255,255,255,0.28) 0 1px,transparent 1px 12px) bottom/100% 8px no-repeat,repeating-linear-gradient(90deg,rgba(255,255,255,0.5) 0 1.5px,transparent 1.5px 96px) bottom/100% 16px no-repeat}
#ruler b{position:absolute;top:0;font:500 11px ${MONO};color:rgba(238,243,242,0.45)}
.lane{position:absolute;left:12px;right:12px;height:64px;border-radius:10px;background:rgba(255,255,255,0.025)}
.lane span{position:absolute;left:10px;top:22px;font:600 13px ${MONO};color:rgba(238,243,242,0.4)}
.clip,.hw{border-radius:9px;overflow:hidden;white-space:nowrap;color:#04110f;font-weight:700;display:flex;align-items:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.45),inset 0 -2px 0 rgba(0,0,0,0.18)}
.clip{height:52px;padding-left:14px;font-size:17px;letter-spacing:-0.01em}
.clip::after{content:"";position:absolute;right:8px;top:8px;bottom:8px;width:36%;border-radius:5px;background:repeating-linear-gradient(90deg,rgba(255,255,255,0.22) 0 30px,rgba(0,0,0,0.08) 30px 32px)}
.clip.au::after,.clip.ctr::after{display:none}
.clip.ctr{justify-content:center;padding-left:0}
.clip.au svg{position:absolute;left:0;top:0}
.clip.au{color:#eef3f2}
.teal{background:linear-gradient(135deg,#5eead4,#14b8a6)}.coral{background:linear-gradient(135deg,#ff9a7a,#ff5a3c)}.violet{background:linear-gradient(135deg,#b3a8ff,#7c6cff)}
.amber{background:linear-gradient(135deg,#ffe08a,#ffb020)}.sky{background:linear-gradient(135deg,#9ad8ff,#3ea6ff)}.au{background:linear-gradient(135deg,#1f3b4a,#173039);box-shadow:inset 0 0 0 1px rgba(94,234,212,0.35)}
.tr{width:34px;height:34px;transform-origin:17px 17px}
.tr svg{display:block}
.fxb{width:46px;height:30px;border-radius:15px;background:#0b0f15;color:#ffc44d;font:700 15px ${MONO};display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1.5px #ffc44d,0 0 24px rgba(255,196,77,0.6)}
#ph{width:3px;height:520px;background:#ff6b4a;box-shadow:0 0 18px rgba(255,107,74,0.9)}
#ph::before{content:"";position:absolute;left:-9px;top:-14px;width:21px;height:18px;border-radius:4px 4px 10px 10px;background:#ff6b4a}
#ov{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none}
#ov>div{position:absolute}
.hw{position:absolute;justify-content:center;font-size:150px;letter-spacing:-0.04em;padding:0 46px;height:190px;border-radius:28px}
.hw i{position:absolute;top:14%;bottom:14%;width:10px;border-radius:5px;background:rgba(4,17,15,0.45);opacity:0}
.hw i.l{left:12px}.hw i.r{right:12px}
#hph{left:0;top:150px;width:4px;height:780px;background:#fff;box-shadow:0 0 30px #fff,0 0 60px rgba(255,107,74,0.9);opacity:0}
#flash{inset:0;background:#fff;opacity:0}
.cap{position:absolute;left:120px;overflow:hidden;padding:6px 0 14px;font-weight:700;font-size:76px;line-height:1.05;letter-spacing:-0.035em;white-space:nowrap;color:#eef3f2}
.cap>span{display:inline-block}
.cap .t{color:#2dd4bf}.cap .c{color:#ff6b4a}.cap .m{color:rgba(238,243,242,0.55)}
.chip{display:inline-flex;align-items:center;gap:10px;padding:12px 22px;border-radius:30px;background:rgba(255,255,255,0.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12);font-size:24px;font-weight:600;color:rgba(238,243,242,0.85)}
.chip b{color:#2dd4bf}
.card{border-radius:22px;background:linear-gradient(180deg,rgba(20,26,36,0.86),rgba(11,15,21,0.9));box-shadow:0 0 0 1px rgba(255,255,255,0.1),0 30px 80px rgba(0,0,0,0.5);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.bar3{height:44px;display:flex;align-items:center;gap:8px;padding-left:18px;border-bottom:1px solid rgba(255,255,255,0.07)}
.bar3 i{width:12px;height:12px;border-radius:6px;background:rgba(255,255,255,0.18)}
.bar3 span{margin-left:12px;font:500 15px ${MONO};color:rgba(238,243,242,0.45)}
#code{left:120px;top:300px;width:880px;opacity:0}
#code pre{padding:22px 28px 26px;font:500 25px/1.75 ${MONO};color:#cfd8dc;white-space:pre}
#code .k{color:#8b7bff}#code .s{color:#5eead4}#code .p{color:rgba(238,243,242,0.4)}#code .ok{display:inline-block;margin-left:16px;padding:0 12px;border-radius:12px;font-size:17px;line-height:30px;vertical-align:3px;background:rgba(45,212,191,0.14);color:#5eead4}
#code .ok.u{background:rgba(255,196,77,0.14);color:#ffc44d}
.caret{display:inline-block;width:12px;height:28px;vertical-align:-5px;background:#2dd4bf}
#fxn{left:110px;top:250px;font-weight:800;font-size:300px;line-height:1;letter-spacing:-0.06em;background:linear-gradient(135deg,#5eead4,#2dd4bf 45%,#8b7bff);-webkit-background-clip:text;background-clip:text;color:transparent;opacity:0}
#fxl{left:124px;top:560px;font-weight:700;font-size:64px;letter-spacing:-0.03em;opacity:0}
#fxc{left:124px;top:680px;display:flex;gap:14px;opacity:0}
#mon{left:940px;top:170px;width:860px;height:496px;opacity:0;padding:14px}
#scr{position:relative;width:832px;height:468px;border-radius:12px;overflow:hidden}
#scr>div{position:absolute;inset:0}
#sky{background:linear-gradient(180deg,#203a6b 0%,#e86a5a 58%,#ffc27a 78%)}
#sun{left:470px!important;top:150px!important;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,#fff6d8,#ffd27a 55%,#ff9a5a);box-shadow:0 0 90px #ffb36b}
.mt{clip-path:polygon(0 100%,0 62%,12% 48%,22% 58%,36% 38%,50% 56%,64% 42%,78% 60%,90% 46%,100% 56%,100% 100%)}
#m1{background:linear-gradient(180deg,#6d3a6e,#3b2148);transform:translateY(40px)}
#m2{background:linear-gradient(180deg,#3a1f4a,#1c1230);transform:translateY(130px) scaleX(-1.3)}
#m3{background:#120b1e;transform:translateY(230px) scaleX(1.6)}
#look{mix-blend-mode:normal}
#mlab{left:964px;top:690px;opacity:0}
#mlab b{color:#ffc44d}
#prompt{left:120px;top:300px;width:860px;opacity:0}
#pin{margin:26px 28px 0;padding:20px 24px;border-radius:16px;background:rgba(255,255,255,0.05);box-shadow:inset 0 0 0 1.5px rgba(45,212,191,0.5);font-size:34px;font-weight:600;min-height:84px}
#pin .ph{color:rgba(238,243,242,0.35)}
#calls{padding:22px 28px 28px;display:flex;flex-direction:column;gap:12px}
#calls>div{display:flex;align-items:center;gap:14px;font:500 22px ${MONO};color:#cfd8dc;opacity:0}
#calls>div i{width:28px;height:28px;border-radius:8px;background:rgba(139,123,255,0.18);color:#b3a8ff;font:700 16px ${MONO};display:flex;align-items:center;justify-content:center;font-style:normal}
#calls>div em{margin-left:auto;font-style:normal;color:#5eead4;font-size:18px}
#exp{left:1100px;top:160px;width:700px;opacity:0;padding:28px 32px}
#exp h4{font-size:30px;font-weight:700;display:flex;justify-content:space-between}
#exp h4 span{font:600 30px ${MONO};color:#2dd4bf}
#pbar{margin-top:22px;height:14px;border-radius:7px;background:rgba(255,255,255,0.08);overflow:hidden}
#pbar i{display:block;height:100%;width:0;border-radius:7px;background:linear-gradient(90deg,#2dd4bf,#8b7bff,#ff6b4a)}
#fmts{margin-top:24px;display:flex;gap:12px}
#fmts .chip{font-size:21px;padding:9px 18px;opacity:0}
#end{left:0;top:0;width:${W}px;height:${H}px;display:flex;flex-direction:column;align-items:center;opacity:0}
#glow{position:absolute;left:560px;top:120px;width:800px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(45,212,191,0.28),rgba(139,123,255,0.12) 45%,transparent 70%);filter:blur(30px)}
#logo{position:relative;margin-top:190px;width:190px;height:190px;filter:drop-shadow(0 0 40px rgba(45,212,191,0.55))}
#logo svg{width:100%;height:100%}
#name{position:relative;margin-top:26px;font-weight:700;font-size:132px;letter-spacing:-0.045em;line-height:1}
#etag{position:relative;margin-top:26px;font-size:40px;font-weight:500;color:rgba(238,243,242,0.75);letter-spacing:-0.01em}
#etag b{color:#eef3f2;font-weight:700}
#url{position:relative;margin-top:44px;padding:18px 44px;border-radius:44px;background:linear-gradient(135deg,#5eead4,#2dd4bf);color:#04110f;font-weight:700;font-size:38px;letter-spacing:-0.01em;box-shadow:0 14px 50px rgba(45,212,191,0.45)}
#oss{position:relative;margin-top:30px;font:600 20px ${MONO};letter-spacing:0.18em;color:rgba(238,243,242,0.5)}
#hud{inset:0}
#hud i{position:absolute;width:44px;height:44px;border-color:rgba(238,243,242,0.35);border-style:solid;border-width:0}
#hud .a{left:48px;top:48px;border-left-width:2px;border-top-width:2px}#hud .b{right:48px;top:48px;border-right-width:2px;border-top-width:2px}
#hud .c{left:48px;bottom:48px;border-left-width:2px;border-bottom-width:2px}#hud .d{right:48px;bottom:48px;border-right-width:2px;border-bottom-width:2px}
#tc{position:absolute;right:110px;top:62px;font:600 20px ${MONO};letter-spacing:0.08em;color:rgba(238,243,242,0.6)}
#tc::before{content:"";display:inline-block;width:10px;height:10px;border-radius:5px;background:#ff6b4a;margin-right:12px;vertical-align:1px;box-shadow:0 0 10px #ff6b4a}
#spec{position:absolute;left:110px;top:62px;font:600 16px ${MONO};letter-spacing:0.16em;color:rgba(238,243,242,0.4)}
`;
const trSvg = `<svg width="34" height="34" viewBox="0 0 34 34"><rect x="5" y="5" width="24" height="24" rx="5" transform="rotate(45 17 17)" fill="#0b0f15" stroke="#fff" stroke-width="2.5"/><path d="M11 11l12 12M23 11L11 23" stroke="#ff6b4a" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const overlay = `
<div id="hud"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i><div id="tc">00:00:00:00</div><div id="spec">MIRAICLIP · 1920×1080 · 30 FPS</div></div>
<div id="hook"></div><div id="hph"></div>
${cap("b1", 140, "Build video editors.")}
${cap("b2", 232, '<span class="m">Not video editor</span> <span class="t">plumbing.</span>', "font-size:60px")}
<div id="proof" style="left:120px;top:340px;opacity:0"><span class="chip">Tested on a <b>4,464-clip</b>, <b>125-minute</b> timeline</span></div>
${cap("c1", 140, 'Every edit is a <span class="t">command.</span>')}
<div id="code" class="card"><div class="bar3"><i></i><i></i><i></i><span>editor.ts</span></div><pre id="pre"></pre></div>
<div id="fxn">0</div><div id="fxl">effects, built in.</div>
<div id="fxc"><span class="chip">Keyframes</span><span class="chip">Transitions</span><span class="chip">Karaoke captions</span></div>
<div id="mon" class="card"><div id="scr"><div id="sky"></div><div id="sun"></div><div id="m1" class="mt"></div><div id="m2" class="mt"></div><div id="m3" class="mt"></div><div id="look"></div></div></div>
<div id="mlab"><span class="chip">effect/add · <b id="mname">Original</b></span></div>
${cap("a1", 140, 'Agents edit with the <span class="t">same commands.</span>')}
<div id="prompt" class="card"><div class="bar3"><i></i><i></i><i></i><span>assistant · MCP</span></div><div id="pin"></div><div id="calls"></div></div>
${cap("e1", 140, 'Export <span class="c">anywhere.</span>')}
<div id="exp" class="card"><h4>Exporting MP4<span id="pct">0%</span></h4><div id="pbar"><i></i></div><div id="fmts"><span class="chip">MP4</span><span class="chip">WebM</span><span class="chip">Browser</span><span class="chip">Worker</span><span class="chip">Node</span></div></div>
<div id="end"><div id="glow"></div><div id="logo">${LOGO}</div><div id="name">Miraiclip</div><div id="etag">Build video editors, <b>not video editor plumbing.</b></div><div id="url">miraiclip.com</div><div id="oss">OPEN SOURCE · MIT</div></div>
<div id="flash"></div>`;

const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>
<div id="bg"><i id="o1"></i><i id="o2"></i><i id="o3"></i><div id="grid"></div></div>
<div id="view"><div id="ground"><div id="panel"><div id="ruler"></div></div></div><div id="world"></div></div>
<div id="ov">${overlay}</div></div>
<script>var TR_SVG = ${JSON.stringify(trSvg)};
stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "launch", width: W, height: H });
