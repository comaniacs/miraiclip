// DEWLIT UGC ad: everything but the human.   node build.mjs → video.miraiclip.json, overlay.html, captions.srt
//
// Two video tracks (later tracks render on top):
//   presenter: six clips at the scripted slots. Now placeholders that say what to film; replace each with real
//              footage (or a disclosed AI avatar) of the same length, at the same start.
//   overlay:   one transparent scripted clip with the product inserts (which cut in full-frame), the karaoke captions,
//              the emphasis captions and the end card.
import fs from "node:fs";
import { createProject } from "../../../packages/core/dist/index.js";
import { T, SHOTS, LINES, INSERTS, EMPHASIS } from "./timeline.mjs";

const { W, H } = T;
const FONT = "'SF Pro Display','Avenir Next','Helvetica Neue',Arial,sans-serif";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const lineAt = (t0, t1) => LINES.filter((l) => l[0] < t1 && l[1] > t0).map((l) => l[2]).join(" ");

// ---- the vanity: the shared room behind the placeholders and the inserts (window light from the left)
const ROOM = `background:
 radial-gradient(ellipse 60% 45% at 0% 30%,rgba(255,244,226,0.95),rgba(255,244,226,0) 70%),
 linear-gradient(90deg,rgba(255,255,255,0.0) 0 62%,rgba(160,150,140,0.10) 62% 63%,rgba(255,255,255,0) 63%),
 repeating-linear-gradient(0deg,rgba(150,140,130,0.10) 0 2px,transparent 2px 120px),repeating-linear-gradient(90deg,rgba(150,140,130,0.10) 0 2px,transparent 2px 120px),
 linear-gradient(180deg,#efe8df,#e4dbd0 70%,#d9cec1)`;

function placeholder(shot, n) {
  return `<div style="position:absolute;inset:0;${ROOM};font-family:${FONT};color:#3a332e;overflow:hidden">
  <div style="position:absolute;left:150px;top:1220px;width:780px;height:240px;border-radius:30px;background:#f6f2ec;box-shadow:0 30px 60px rgba(60,40,30,0.18)"></div>
  <div style="position:absolute;left:210px;top:380px;width:660px;height:1100px;border:6px dashed rgba(58,51,46,0.35);border-radius:330px 330px 120px 120px"></div>
  <div style="position:absolute;left:380px;top:470px;width:320px;height:400px;border-radius:50%;border:6px dashed rgba(58,51,46,0.35)"></div>
  <div style="position:absolute;left:70px;right:70px;top:560px;padding:34px 40px;border-radius:28px;background:rgba(43,42,46,0.88);color:#f6f2ec">
    <div style="font-weight:700;font-size:30px;letter-spacing:0.18em;color:#e8c4b8">PRESENTER PLACEHOLDER · SHOT ${n} · ${shot.t[0].toFixed(1)}–${shot.t[1].toFixed(1)} s</div>
    <div style="font-weight:600;font-size:40px;margin-top:14px">${esc(shot.frame)}</div>
    <div style="font-weight:400;font-size:34px;margin-top:8px;opacity:0.85">${esc(shot.action)}</div>
    <div style="font-weight:500;font-size:34px;margin-top:18px;font-style:italic;opacity:0.9">“${esc(lineAt(shot.t[0], shot.t[1]))}”</div>
    <div style="font-size:26px;margin-top:18px;opacity:0.6">Replace this clip with phone footage (or a disclosed AI avatar), ${(shot.t[1] - shot.t[0]).toFixed(1)} s, 1080×1920.</div>
  </div></div>`;
}

// ---- the overlay: one scripted clip, transparent except where an insert cuts in
const css = `
*{box-sizing:border-box;margin:0}
.stage{background:transparent;font-family:${FONT};color:#fff;-webkit-font-smoothing:antialiased}
.ins{position:absolute;inset:0;overflow:hidden;display:none}
.room{position:absolute;inset:-80px;${ROOM}}
.bottle{position:absolute;left:390px;top:520px;width:300px;height:900px}
.bottle .body{position:absolute;left:0;top:300px;width:300px;height:600px;border-radius:44px 44px 54px 54px;overflow:hidden;
  background:linear-gradient(90deg,#d8d2ca 0%,#f7f4ef 18%,#ffffff 30%,#f2eee8 52%,#ddd6cd 82%,#c9c1b7 100%);box-shadow:0 40px 70px rgba(70,50,35,0.25),inset 0 0 0 2px rgba(255,255,255,0.6)}
.bottle .body::after{content:"";position:absolute;left:46px;top:20px;width:22px;height:540px;border-radius:11px;background:linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.2));filter:blur(2px)}
.bottle .lab{position:absolute;left:0;top:150px;width:300px;text-align:center;color:#2b2a2e}
.lab i{display:block;margin:0 auto 18px;width:64px;height:36px;border-radius:20px;background:#e8c4b8;box-shadow:22px -12px 0 -2px #e8c4b8,-20px -6px 0 -6px #e8c4b8}
.lab b{display:block;font-weight:700;font-size:46px;letter-spacing:0.24em;padding-left:0.24em}
.lab span{display:block;margin-top:14px;font-size:27px;font-weight:500}
.lab em{display:block;margin-top:120px;font-style:normal;font-size:20px;letter-spacing:0.2em;color:#6b6460}
.bottle .collar{position:absolute;left:88px;top:220px;width:124px;height:90px;border-radius:12px;background:linear-gradient(90deg,#9c7a46,#e9cf98 30%,#c7a462 60%,#8f6d3c)}
.bottle .bulb{position:absolute;left:100px;top:40px;width:100px;height:190px;border-radius:50px 50px 18px 18px;background:linear-gradient(90deg,#c99e91,#f0d3c9 35%,#e8c4b8 60%,#b98d80)}
.shadow{position:absolute;left:330px;top:1400px;width:420px;height:70px;border-radius:50%;background:radial-gradient(closest-side,rgba(60,40,30,0.35),rgba(60,40,30,0))}
.glass{position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 30% 20%,#ffffff,#e9eef0 50%,#cfd8dc)}
.glass::after{content:"";position:absolute;left:-200px;top:300px;width:1600px;height:240px;transform:rotate(-24deg);background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.55),rgba(255,255,255,0))}
.dropper{position:absolute;left:470px;top:-40px;width:140px;height:520px}
.dropper .tube{position:absolute;left:50px;top:180px;width:40px;height:340px;border-radius:0 0 20px 20px;background:linear-gradient(90deg,rgba(200,210,214,0.7),rgba(255,255,255,0.95) 40%,rgba(190,200,205,0.7))}
.dropper .tube::after{content:"";position:absolute;left:8px;right:8px;bottom:6px;height:180px;border-radius:0 0 14px 14px;background:#fbf8f3}
.dropper .bulbx{position:absolute;left:20px;top:0;width:100px;height:190px;border-radius:50px 50px 18px 18px;background:linear-gradient(90deg,#c99e91,#f0d3c9 35%,#e8c4b8 60%,#b98d80)}
.vanity{position:absolute;left:-80px;right:-80px;top:1300px;bottom:-80px;background:linear-gradient(180deg,#f4f1ec,#e6e0d8),repeating-linear-gradient(115deg,rgba(150,150,160,0.12) 0 2px,transparent 2px 60px)}
.towel{position:absolute;left:640px;top:1180px;width:420px;height:200px;border-radius:24px;background:repeating-linear-gradient(90deg,#9fb5a3 0 14px,#93aa97 14px 18px);box-shadow:0 20px 40px rgba(40,50,40,0.2)}
.leaf{position:absolute;left:40px;top:860px;width:320px;height:520px;background:radial-gradient(ellipse 18% 9% at 50% 20%,#7d9b80 98%,transparent),radial-gradient(ellipse 18% 9% at 30% 40%,#86a389 98%,transparent),radial-gradient(ellipse 18% 9% at 65% 55%,#7d9b80 98%,transparent),radial-gradient(ellipse 18% 9% at 40% 72%,#86a389 98%,transparent);opacity:0.9}
#cap{position:absolute;left:90px;right:90px;top:1360px;text-align:center;font-weight:800;font-size:58px;line-height:1.18;letter-spacing:-0.01em;color:#fff;-webkit-text-stroke:3px rgba(20,16,14,0.75);paint-order:stroke fill;text-shadow:0 4px 14px rgba(0,0,0,0.45)}
#cap .w{opacity:0.0}#cap .w.on{opacity:1}#cap .w.now{color:#ffd6c8}
#emph{position:absolute;left:0;right:0;top:300px;text-align:center}
#emph span{display:inline-block;padding:14px 28px;border-radius:16px;background:#f6f2ec;color:#2b2a2e;font-weight:700;font-size:44px;box-shadow:0 10px 30px rgba(0,0,0,0.18);transform-origin:50% 100%}
#end{position:absolute;left:70px;right:70px;top:1390px;padding:36px 40px;border-radius:34px;background:rgba(246,242,236,0.97);color:#2b2a2e;display:none;box-shadow:0 30px 70px rgba(0,0,0,0.25)}
#end b{display:block;font-weight:700;font-size:56px;letter-spacing:0.22em}
#end span{display:block;font-size:36px;margin-top:6px;font-weight:500}
#end .pill{display:inline-block;margin-top:22px;padding:14px 30px;border-radius:40px;background:#2b2a2e;color:#f6f2ec;font-weight:700;font-size:30px}
#end small{display:block;margin-top:22px;font-size:22px;color:#7a726c}
`;
const words = LINES.map((l) => l[2].split(" "));
const overlay = `
<div class="ins" id="iBottle"><div class="room"></div><div class="vanity"></div><div class="leaf"></div><div class="shadow"></div>
  <div class="bottle"><div class="bulb"></div><div class="collar"></div><div class="body"><div class="lab"><i></i><b>DEWLIT</b><span>Cloud Milk Serum</span><em>30 ML · 1.0 FL OZ</em></div></div></div></div>
<div class="ins" id="iTexture"><div class="glass"></div>
  <svg width="${W}" height="${H}" style="position:absolute;left:0;top:0"><defs><filter id="goo"><feGaussianBlur in="SourceGraphic" stdDeviation="14" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 26 -11" result="g"/><feGaussianBlur in="g" stdDeviation="2" result="s"/><feSpecularLighting in="s" surfaceScale="6" specularConstant="0.9" specularExponent="28" lighting-color="#ffffff" result="sp"><feDistantLight azimuth="225" elevation="45"/></feSpecularLighting><feComposite in="sp" in2="g" operator="in" result="spi"/><feComposite in="g" in2="spi" operator="arithmetic" k1="0" k2="1" k3="0.8" k4="0"/></filter></defs><g id="milk" filter="url(#goo)" fill="#faf6ef"></g></svg>
  <div class="dropper"><div class="bulbx"></div><div class="tube"></div></div></div>
<div class="ins" id="iVanity"><div class="room"></div><div class="vanity"></div><div class="towel"></div><div class="shadow" style="left:300px;top:1440px"></div>
  <div class="bottle" style="left:360px;top:560px"><div class="bulb"></div><div class="collar"></div><div class="body"><div class="lab"><i></i><b>DEWLIT</b><span>Cloud Milk Serum</span><em>30 ML · 1.0 FL OZ</em></div></div></div></div>
<div id="emph"><span id="emphS"></span></div>
<div id="cap">${words.map((ws, i) => `<div class="ln" id="ln${i}" style="display:none">${ws.map((w) => `<span class="w">${esc(w)}</span>`).join(" ")}</div>`).join("")}</div>
<div id="end"><b>DEWLIT</b><span>Cloud Milk Serum</span><div class="pill">Link in bio ↗</div><small>Creative concept · fictional brand · presenter clips are placeholders</small></div>`;

const script = `
var T = ${JSON.stringify(T)}, LINES = ${JSON.stringify(LINES)}, INSERTS = ${JSON.stringify(INSERTS)}, EMPHASIS = ${JSON.stringify(EMPHASIS)};
var $ = function (id) { return document.getElementById(id); };
var c01 = function (x) { return Math.max(0, Math.min(1, x)); }, sm = function (x) { x = c01(x); return x * x * (3 - 2 * x); };
// handheld: a slow, small two-axis drift, like a phone held at arm's length (deterministic)
function hand(t, k) { return [7 * Math.sin(t * 1.3 + k) + 3 * Math.sin(t * 3.1 + 2 * k), 6 * Math.cos(t * 1.1 + k) + 2 * Math.sin(t * 2.7 + k)]; }
function ins(id, span, t) { var on = t >= span[0] && t < span[1]; $(id).style.display = on ? "block" : "none"; return on ? (t - span[0]) / (span[1] - span[0]) : -1; }
var milk = document.getElementById("milk"), BL = [];
for (var i = 0; i < 26; i++) { var c = document.createElementNS("http://www.w3.org/2000/svg", "circle"); milk.appendChild(c); BL.push({ c: c, a: i / 26 * 6.283 + Math.sin(i * 7.1), d: 0.35 + 0.65 * ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 }); }
function paint(t) {
  // 1 · the bottle close-up: a push-in while the label turns to camera (a quick hand rotation)
  var u = ins("iBottle", INSERTS.bottle, t);
  if (u >= 0) {
    var h = hand(t, 1), b = $("iBottle").querySelector(".bottle"), turn = 1 - sm(u / 0.6);
    b.style.transform = "translate(" + (h[0] - 40 * turn) + "px," + h[1] + "px) scale(" + (1.0 + 0.08 * u) + ")";
    var lab = b.querySelector(".lab"); lab.style.transform = "translateX(" + (-120 * turn) + "px) scaleX(" + (1 - 0.45 * turn) + ")"; lab.style.opacity = 1 - 0.5 * turn;
  }
  // 2 · the texture macro: one milky drop falls from the dropper, lands, and spreads into a soft pool
  u = ins("iTexture", INSERTS.texture, t);
  if (u >= 0) {
    var tt = t - INSERTS.texture[0], fall = c01(tt / 0.7), land = c01((tt - 0.7) / 2.4), h2 = hand(t, 2);
    $("iTexture").style.transform = "translate(" + h2[0] + "px," + h2[1] + "px) scale(" + (1.06 + 0.04 * tt) + ")";
    BL.forEach(function (b, i) {
      var r, x, y;
      if (tt < 0.7) { x = 540; y = 520 + 560 * fall * fall; r = i < 4 ? 52 - i * 6 : 0; }
      else { var spread = 1 - Math.pow(1 - land, 2.4), a = b.a + 0.4 * land; x = 540 + Math.cos(a) * 210 * b.d * spread; y = 1080 + Math.sin(a) * 140 * b.d * spread; r = 95 * (1 - 0.3 * spread) * (0.8 + 0.4 * b.d); } // one pool, not droplets
      b.c.setAttribute("cx", x.toFixed(1)); b.c.setAttribute("cy", y.toFixed(1)); b.c.setAttribute("r", r.toFixed(1));
    });
  }
  // 3 · the bottle on the vanity, a slow push-in
  u = ins("iVanity", INSERTS.vanity, t);
  if (u >= 0) { var h3 = hand(t, 3); $("iVanity").querySelector(".bottle").style.transform = "translate(" + h3[0] + "px," + h3[1] + "px) scale(" + (1 + 0.06 * u) + ")"; }
}
function poseType(t) {
  // karaoke captions: the current line, words appearing as they are spoken, the spoken word tinted
  LINES.forEach(function (l, i) {
    var el = $("ln" + i), on = t >= l[0] - 0.05 && t < l[1] + 0.35;
    el.style.display = on ? "block" : "none";
    if (!on) return;
    var ws = el.children, n = ws.length, k = Math.floor((t - l[0]) / ((l[1] - l[0]) / n));
    for (var j = 0; j < n; j++) { ws[j].className = "w" + (j <= k ? " on" : "") + (j === k ? " now" : ""); }
  });
  $("cap").style.display = t >= INSERTS.end[0] ? "none" : "block";
  var e = EMPHASIS.filter(function (x) { return t >= x[0] && t < x[1]; })[0], s = $("emphS");
  s.style.display = e ? "inline-block" : "none";
  if (e) { s.textContent = e[2]; var p = sm((t - e[0]) / 0.25), q = sm((e[1] - t) / 0.2); s.style.transform = "scale(" + (0.85 + 0.15 * p) + ") rotate(-2deg)"; s.style.opacity = Math.min(p, q); }
  var en = $("end"), v = sm((t - INSERTS.end[0]) / 0.4);
  en.style.display = t >= INSERTS.end[0] ? "block" : "none"; en.style.opacity = v; en.style.transform = "translateY(" + (40 * (1 - v)) + "px)";
}
tl.frame(paint);
tl.frame(poseType, { hold: true });
${SHOTS.map((s) => `tl.label("${s.id}", ${s.t[0]});`).join(" ")}
`;
const overlayHtml = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>${overlay}</div>\n<script>stage.build((tl, S) => {${script}});</script>`;
fs.writeFileSync(new URL("./overlay.html", import.meta.url), overlayHtml);

const project = createProject({ width: W, height: H, fps: T.FPS });
project.transaction(() => {
  project.dispatch({ type: "track/add", payload: { id: "presenter", kind: "video" } });
  project.dispatch({ type: "track/add", payload: { id: "overlay", kind: "video" } });
  SHOTS.forEach((s, i) => project.dispatch({ type: "clip/add", payload: { kind: "html", id: s.id, trackId: "presenter", startUs: s.t[0] * 1e6, durationUs: (s.t[1] - s.t[0]) * 1e6, template: placeholder(s, i + 1) } }));
  project.dispatch({ type: "clip/add", payload: { kind: "html", id: "overlay", trackId: "overlay", startUs: 0, durationUs: T.DUR * 1e6, template: overlayHtml, scripted: true } });
});
fs.writeFileSync(new URL("./video.miraiclip.json", import.meta.url), JSON.stringify(project.toJSON(), null, 2) + "\n");

// captions as a separate subtitle file, from the same lines
const ts = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
fs.writeFileSync(new URL("./captions.srt", import.meta.url), LINES.map((l, i) => `${i + 1}\n${ts(l[0])} --> ${ts(l[1] + 0.3)}\n${l[2]}\n`).join("\n"));
console.log("wrote video.miraiclip.json, overlay.html, captions.srt");
