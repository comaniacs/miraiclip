// "Where the Spheres Meet", an original 30 s one-take explainer in three.js: how GPS finds your phone without ever
// hearing from it. Three signal delays become three spheres; where they meet is you.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
//
// The film is plain scripts in film/, concatenated in name order into one stage.build closure, with the timeline
// in timeline.mjs injected as T so picture and sound share their numbers.
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";
import { T } from "./timeline.mjs";

const W = 1920, H = 1080;
const dir = new URL("./film/", import.meta.url);
const parts = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
const film = [`var T = ${JSON.stringify(T)};`].concat(parts.map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, dir), "utf8"))).join("\n");

const css = `
#ov{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;font-family:'Avenir Next','Helvetica Neue',Arial,sans-serif;color:#f2f6ff;-webkit-font-smoothing:antialiased}
#shade{position:absolute;left:0;top:0;width:1100px;height:${H}px;background:linear-gradient(90deg,rgba(5,7,13,0.66),rgba(5,7,13,0.32) 45%,rgba(5,7,13,0))}
#ov .cap{position:absolute;left:120px;overflow:hidden;padding:4px 0 10px;font-weight:600;font-size:54px;line-height:1.12;letter-spacing:-0.01em;white-space:nowrap;text-shadow:0 2px 28px rgba(5,7,13,0.7)}
#ov .cap>span{display:inline-block}
#ov .k{font-weight:500;font-size:19px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(214,228,255,0.78)}
#ov .v{font-weight:500;font-size:22px;color:rgba(242,246,255,0.88);margin-top:4px}
#lab{position:absolute;white-space:nowrap;text-shadow:0 2px 18px rgba(5,7,13,0.8)}
#math{position:absolute;left:120px;top:150px;text-shadow:0 2px 24px rgba(5,7,13,0.7)}
#math .row{display:flex;align-items:baseline;gap:18px;margin-top:6px}
#math .num{font-weight:600;font-size:56px;font-variant-numeric:tabular-nums;color:#3fd8ff;line-height:1.05}
#math .op{font-weight:500;font-size:24px;color:rgba(214,228,255,0.8)}
#foot{position:absolute;left:120px;top:560px;font-weight:500;font-size:22px;color:rgba(214,228,255,0.78)}
#c_ttl{font-size:84px;letter-spacing:-0.02em}
#c_sub{font-weight:500;font-size:30px;letter-spacing:0;color:rgba(242,246,255,0.84)}
`;
const cap = (id, top, text) => `<div class="cap" id="${id}" style="top:${top}px;opacity:0"><span>${text}</span></div>`;
const overlay = `<div id="ov"><div id="shade"></div>
<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible"><polyline id="ld" points="" fill="none" stroke="rgba(214,240,255,0.9)" stroke-width="1.6" style="opacity:0"/><circle id="ldot" cx="0" cy="0" r="4.5" fill="#f2f6ff" style="opacity:0"/></svg>
<div id="lab" style="opacity:0"><div class="k">GPS satellite</div><div class="v">20,200 km up · broadcasting the time</div></div>
${cap("c_h1", 420, "Your phone never tells space where it is.")}${cap("c_h2", 490, "It only listens.")}
${cap("c_set", 452, "Satellites broadcast one thing: the exact time.")}
${cap("c_m1", 452, "The delay says how far away it is.")}
${cap("c_m2", 452, "So you’re somewhere on this sphere.")}
${cap("c_t1", 452, "Two spheres meet in a circle.")}
${cap("c_t2", 452, "A third leaves two points. Only one is on Earth.")}
${cap("c_rev", 452, "Three distances. One place: you.")}
${cap("c_ttl", 760, "Where the spheres meet.")}${cap("c_sub", 868, "GPS finds you without ever hearing from you.")}
<div id="math" style="opacity:0"><div class="k">Signal delay from satellite 1</div>
<div class="row"><div class="num" id="mDelay">0.000 s</div></div>
<div class="row" id="mDist" style="opacity:0"><div class="op">× speed of light =</div><div class="num" id="mDistV">0 km</div></div></div>
<div id="foot" style="opacity:0">A fourth satellite keeps the phone’s clock exact.</div>
</div>`;

const html = `<div class="stage" data-libs="stage three three-kit" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;background:#05070d;overflow:hidden"><style>${css}</style><canvas id="c" width="${W}" height="${H}" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px"></canvas>${overlay}</div>\n<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "where-spheres-meet", width: W, height: H });
