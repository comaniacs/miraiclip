// "The cloud is underwater": a 30 s playful explainer. Nimbus, a little cloud, asks where the cloud really is, gets a
// NOPE from the sky, and dives to the undersea cables that carry the internet between continents. HTML/CSS/SVG only.
//   node build.mjs
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";
import { T } from "./timeline.mjs";

const W = 1920, H = 1080;
const kit = ["film-core.js", "overlay.js"].map((f) => fs.readFileSync(new URL(`../_lib/app-film/browser/${f}`, import.meta.url), "utf8"));
const dir = new URL("./film/", import.meta.url);
const film = [`var W = ${W}, H = ${H}, PERSP = 1600, WIN_W = 0, WIN_H = 0;`, `var T = ${JSON.stringify(T)};`].concat(kit)
  .concat(fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, dir), "utf8"))).join("\n");

const FONT = "'Arial Rounded MT Bold','Avenir Next Rounded','Avenir Next',Arial,sans-serif";
const INK = "#1b1b3a", YEL = "#ffd23f", CORAL = "#ff6b6b", MINT = "#5be3b5";
const NIMBUS = `<svg viewBox="0 0 400 280" width="400" height="280">
<g id="nb-arml"><ellipse cx="62" cy="200" rx="34" ry="22" fill="#fff"/></g><g id="nb-armr"><ellipse cx="338" cy="200" rx="34" ry="22" fill="#fff"/></g>
<g fill="#fff"><circle cx="125" cy="160" r="88"/><circle cx="210" cy="115" r="108"/><circle cx="295" cy="165" r="80"/><rect x="110" y="150" width="200" height="105" rx="52"/></g>
<ellipse cx="140" cy="200" rx="22" ry="13" fill="#ffb3c1"/><ellipse cx="282" cy="200" rx="22" ry="13" fill="#ffb3c1"/>
<g><ellipse cx="172" cy="160" rx="27" ry="31" fill="#fff" stroke="${INK}" stroke-width="5"/><ellipse cx="250" cy="160" rx="27" ry="31" fill="#fff" stroke="${INK}" stroke-width="5"/>
<g id="nb-pupils"><circle cx="172" cy="163" r="14" fill="${INK}"/><circle cx="250" cy="163" r="14" fill="${INK}"/><circle cx="177" cy="157" r="5" fill="#fff"/><circle cx="255" cy="157" r="5" fill="#fff"/></g>
<rect id="nb-lids" x="140" y="125" width="145" height="0" fill="#fff"/></g>
<path id="nb-mouth" d="M196 210 Q211 228 226 210" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
<g id="nb-mask" opacity="0"><rect x="132" y="118" width="160" height="86" rx="38" fill="rgba(150,220,255,0.35)" stroke="${YEL}" stroke-width="11"/><path d="M296 150 C330 150 330 120 330 40" fill="none" stroke="${CORAL}" stroke-width="14" stroke-linecap="round"/></g>
<g id="nb-sweat" opacity="0"><path d="M318 82 C310 98 306 106 314 112 C322 116 330 108 326 96 Z" fill="#7fd3ff"/></g>
</svg>`;
const FISH = (c) => `<svg viewBox="0 0 120 70" width="120" height="70"><path d="M84 35 L118 10 L112 35 L118 60 Z" fill="${c}"/><ellipse cx="52" cy="35" rx="48" ry="28" fill="${c}"/><circle cx="26" cy="29" r="8" fill="#fff"/><circle cx="24" cy="29" r="4" fill="${INK}"/><path d="M10 42 Q16 46 22 42" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
const SAT = `<svg viewBox="0 0 260 120" width="260" height="120"><rect x="0" y="35" width="90" height="50" rx="6" fill="#3d7bff"/><path d="M0 52H90M0 68H90M30 35V85M60 35V85" stroke="#9cc0ff" stroke-width="3"/><rect x="170" y="35" width="90" height="50" rx="6" fill="#3d7bff"/><path d="M170 52H260M170 68H260M200 35V85M230 35V85" stroke="#9cc0ff" stroke-width="3"/><rect x="95" y="25" width="70" height="70" rx="14" fill="${YEL}" stroke="${INK}" stroke-width="5"/><path d="M130 25 V5" stroke="${INK}" stroke-width="5"/><circle cx="130" cy="5" r="7" fill="${CORAL}"/></svg>`;
const SHARK = `<svg viewBox="0 0 420 200" width="420" height="200"><ellipse id="halo" cx="160" cy="18" rx="70" ry="14" fill="none" stroke="${YEL}" stroke-width="9" opacity="0"/><path d="M150 70 L190 10 L215 72 Z" fill="#7b8ca8"/><path d="M20 110 C60 60 200 50 330 85 L410 40 L390 110 L410 170 L330 130 C220 165 70 165 20 110 Z" fill="#8fa1bd"/><path d="M40 118 C110 150 220 150 300 128 C220 140 110 140 40 118 Z" fill="#eef3fb"/><circle cx="90" cy="98" r="10" fill="${INK}"/><circle cx="93" cy="95" r="3.5" fill="#fff"/><path id="sh-mouth" d="M45 125 Q70 132 95 124" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;
const ANCHOR = `<svg viewBox="0 0 200 240" width="200" height="240"><circle cx="100" cy="30" r="20" fill="none" stroke="#4a4f63" stroke-width="12"/><path d="M100 50 V215 M55 90 H145 M20 150 Q30 215 100 215 Q170 215 180 150" fill="none" stroke="#4a4f63" stroke-width="16" stroke-linecap="round"/><path d="M8 160 L20 135 L36 158 Z M192 160 L180 135 L164 158 Z" fill="#4a4f63"/></svg>`;
const XSEC = `<svg viewBox="0 0 360 360" width="360" height="360"><circle cx="180" cy="180" r="170" fill="#fff" stroke="${INK}" stroke-width="8"/><circle cx="180" cy="180" r="120" fill="${INK}"/><circle cx="180" cy="180" r="96" fill="#9aa3b5"/><circle cx="180" cy="180" r="70" fill="#d9894a"/><circle cx="180" cy="180" r="46" fill="#0b1a3a"/><g id="fibers"></g></svg>`;

const css = `
*{box-sizing:border-box;margin:0}
.stage{background:#8fd3ff;font-family:${FONT};color:${INK}}
.full{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden}
#world{position:absolute;left:0;top:0;width:${W}px;height:4300px}
#world>div,#world>svg{position:absolute}
#sky{left:0;top:0;width:${W}px;height:1100px;background:linear-gradient(180deg,#5fbfff,#bfe8ff 80%)}
#sun{left:1560px;top:90px;width:180px;height:180px;border-radius:50%;background:${YEL};box-shadow:0 0 0 24px rgba(255,210,63,0.3),0 0 0 52px rgba(255,210,63,0.15)}
.puff{height:70px;border-radius:40px;background:#fff;opacity:0.85}
.puff::before,.puff::after{content:"";position:absolute;border-radius:50%;background:#fff}
.puff::before{left:22%;top:-34px;width:80px;height:80px}.puff::after{left:48%;top:-22px;width:60px;height:60px}
#sea{left:0;top:1080px;width:${W}px;height:3220px;background:linear-gradient(180deg,#38c6e8 0%,#1a8fc9 20%,#0f5aa0 45%,#0b2d6b 70%,#071a3f 100%)}
#waves{left:0;top:1040px;width:${W + 200}px;height:80px}
#rays{left:0;top:1080px;width:${W}px;height:1400px;background:repeating-linear-gradient(100deg,rgba(255,255,255,0.08) 0 60px,transparent 60px 220px);-webkit-mask-image:linear-gradient(180deg,#000,transparent)}
#bed{left:-100px;top:3880px;width:${W + 200}px;height:420px;border-radius:50% 50% 0 0/60px 60px 0 0;background:linear-gradient(180deg,#c9a46a,#8d7350 40%,#5a4a3a)}
.weed{width:26px;border-radius:13px 13px 0 0;background:${MINT};transform-origin:50% 100%}
#cable{left:-40px;top:3896px;width:${W + 80}px;height:52px;border-radius:26px;background:linear-gradient(180deg,#5a6080 0%,#2a2e44 45%,#14162a);box-shadow:0 8px 0 rgba(0,0,0,0.3)}
#pulses{left:0;top:3910px;width:${W}px;height:24px}
#pulses>div{position:absolute;top:0;width:90px;height:24px;border-radius:12px;background:radial-gradient(ellipse,#fff 0%,${MINT} 45%,transparent 72%);filter:drop-shadow(0 0 8px ${MINT})}
.bub{width:24px;height:24px;border-radius:50%;border:3px solid rgba(255,255,255,0.7);background:rgba(255,255,255,0.12)}
#nimbus{position:absolute;left:0;top:0;width:400px;height:280px;filter:drop-shadow(0 18px 0 rgba(27,27,58,0.12))}
#sat,#shark,#anchor,.fish{position:absolute;left:0;top:0}
#stamp{position:absolute;left:1240px;top:330px;padding:16px 46px;border:12px solid ${CORAL};border-radius:24px;color:${CORAL};font-size:150px;letter-spacing:0.04em;opacity:0;background:rgba(255,255,255,0.6)}
#splash{position:absolute;left:0;top:0}
.row{position:absolute;left:0;right:0;text-align:center;pointer-events:none}
.stk{display:inline-block;padding:18px 40px;border-radius:26px;background:#fff;color:${INK};font-size:64px;line-height:1.1;box-shadow:0 10px 0 rgba(27,27,58,0.18);opacity:0;white-space:nowrap}
.stk.y{background:${YEL}}.stk.c{background:${CORAL};color:#fff}.stk.m{background:${MINT}}.stk.k{background:${INK};color:#fff}
.stk.big{font-size:118px;padding:20px 54px}
.stk em{font-style:normal;color:${CORAL}}.stk.k em{color:${YEL}}
#xsec{position:absolute;left:1270px;top:300px;width:360px;height:360px;opacity:0}
#xlead{position:absolute;left:0;top:0}
#hose{position:absolute;left:1300px;top:690px;opacity:0}
#globe{background:#1b1b3a}
#gstars i{position:absolute;width:6px;height:6px;border-radius:3px;background:#fff}
#earth{position:absolute;left:660px;top:250px;width:600px;height:600px}

#src{position:absolute;right:48px;bottom:30px;font-size:22px;color:rgba(255,255,255,0.8);opacity:0}
#spark{position:absolute;left:0;top:0;opacity:0}
`;
const row = (id, top, cls, html) => `<div class="row" style="top:${top}px"><span class="stk ${cls}" id="${id}">${html}</span></div>`;
const body = `
<div id="view" class="full"><div id="world">
<div id="sky"></div><div id="sun"></div><div id="puffs"></div>
<div id="sea"></div><div id="rays"></div><svg id="waves" width="${W + 200}" height="80"><path id="wavep" fill="#38c6e8"/></svg>
<div id="fishes"></div><div id="bubs"></div><div id="weeds"></div><div id="bed"></div><div id="cable"></div><div id="pulses"></div>
</div></div>
<div id="sat">${SAT}</div><div id="shark">${SHARK}</div><div id="anchor">${ANCHOR}</div>
<svg id="splash" width="${W}" height="${H}"></svg><svg id="spark" width="${W}" height="${H}"><g fill="${YEL}"><path d="M0 -60 L14 -14 L60 0 L14 14 L0 60 L-14 14 L-60 0 L-14 -14 Z"/></g></svg>
<svg id="xlead" width="${W}" height="${H}"><path d="" stroke="#fff" stroke-width="5" stroke-dasharray="10 10" fill="none"/></svg>
<div id="xsec">${XSEC}</div>
<svg id="hose" width="300" height="120" viewBox="0 0 300 120"><path d="M20 60 C80 0 140 120 200 60 S280 20 290 60" fill="none" stroke="#3fbf5f" stroke-width="30" stroke-linecap="round"/><rect x="0" y="45" width="34" height="30" rx="6" fill="${YEL}"/></svg>
<div id="nimbus">${NIMBUS}</div>
<div id="stamp">NOPE!</div>
<div id="globe" class="full"><div id="gstars"></div><svg id="earth" viewBox="-300 -300 600 600"><defs><clipPath id="ec"><circle r="270"/></clipPath></defs><circle r="270" fill="#2e8bff"/>
<g clip-path="url(#ec)" fill="${MINT}"><ellipse cx="-120" cy="-90" rx="110" ry="80"/><ellipse cx="-60" cy="120" rx="70" ry="110"/><ellipse cx="130" cy="-60" rx="120" ry="70"/><ellipse cx="160" cy="110" rx="60" ry="50"/><ellipse cx="40" cy="-200" rx="90" ry="30"/></g>
<circle r="270" fill="none" stroke="${INK}" stroke-width="10"/><g id="wraps"></g></svg></div>

${row("q1", 90, "", "Quick question…")}${row("q2", 200, "y big", "Where <em>IS</em> the cloud?")}
${row("s1", 90, "", "Up in the sky?")}${row("s2", 880, "k", "Satellites? They carry only a <em>tiny slice.</em>")}
${row("d1", 110, "y big", "It's down here! ↓")}
${row("c1", 70, "y", "<em>~99%</em> of data between continents")}${row("c2", 175, "", "travels through cables on the sea floor.")}
<div class="row" style="top:690px;left:1080px;right:120px"><span class="stk m" id="c3">≈ garden-hose thick!</span></div>
${row("g1", 80, "y", "<em>1.4 million+ km</em> of these cables")}${row("g2", 900, "y", 'Enough to wrap Earth <em id="gn">0</em> times')}
${row("b1", 70, "c", "They break 150–200 times a year!")}${row("b2", 190, "", "Sharks? <em>Rarely.</em>")}${row("b3", 190, "y", "Usually: ship anchors &amp; fishing gear.")}
${row("o1", 110, "", "So the cloud…")}${row("o2", 220, "y big", "…is mostly <em>underwater.</em>")}${row("o3", 860, "m", "Say hi to the fish!")}
<div id="src">Sources: TeleGeography · ICPC</div>`;

const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>${body}</div>
<script>var FISH_SVG = ${JSON.stringify([CORAL, YEL, MINT, "#ff9f43", "#a29bfe"].map(FISH))};
stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "undersea", width: W, height: H });
