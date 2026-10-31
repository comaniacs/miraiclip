// ---- the world: one editor timeline (panel, six lanes, clips, transitions, an fx badge, the playhead) in 3D.
var world = $("world"), ground = $("ground"), panel = $("panel");
var LANES = ["V1", "V2", "V3", "V4", "A1", "A2"];
function laneY(i) { return -230 + i * 80; }
LANES.forEach(function (name, i) { mk("lane", panel, "<span>" + name + "</span>").style.top = (60 + i * 80) + "px"; });
for (var s = 0; s <= 15; s++) { var b = mk("", $("ruler")); b.outerHTML = '<b style="left:' + (s * 96 + 4) + 'px">00:' + (s * 2 < 10 ? "0" : "") + s * 2 + "</b>"; }
panel.style.transform = "translate3d(-780px,-290px,0)";

var CLIPS = [
  { id: "h0", tr: 0, x: -700, w: 300, col: "teal", label: "Ship a", hook: 0 },
  { id: "h1", tr: 1, x: -560, w: 520, col: "coral", label: "video editor", hook: 1, trim: [-560, 420] },
  { id: "h2", tr: 2, x: -250, w: 420, col: "violet", label: "in your app.", hook: 2 },
  { tr: 0, x: -380, w: 260, col: "sky", label: "intro.mp4", trim: [-400, 180] },
  { tr: 0, x: -100, w: 300, col: "teal", label: "product.mov", trim: [-220, 220] },
  { tr: 1, x: -40, w: 320, col: "coral", label: "demo.webm", trim: [-140, 260] },
  { tr: 1, x: 300, w: 400, col: "sky", label: "scene-2.mp4", trim: [140, 400] },
  { tr: 2, x: -700, w: 430, col: "amber", label: "overlay.html" },
  { tr: 2, x: 190, w: 300, col: "violet", label: "lower-third.html" },
  { tr: 2, x: 510, w: 230, col: "teal", label: "cta.html" },
  { tr: 3, x: -700, w: 540, col: "violet", label: "captions.srt" },
  { tr: 3, x: -140, w: 400, col: "amber", label: "logo.svg" },
  { tr: 3, x: 280, w: 460, col: "coral", label: "subtitles.vtt" },
  { tr: 4, x: -700, w: 1440, col: "au", label: "music.mp3" },
  { tr: 5, x: -560, w: 380, col: "au", label: "voiceover.wav" },
  { tr: 5, x: -150, w: 300, col: "au", label: "sfx.wav" },
  { tr: 5, x: 180, w: 520, col: "au", label: "voiceover-2.wav" },
  { id: "cA", tr: 0, x: 380, w: 320, col: "amber", label: "title.html", cmd: true },
];
// a deterministic waveform for the audio clips
function wave(w, seed) {
  var d = "", n = Math.floor(w / 6);
  for (var i = 0; i < n; i++) { var a = 4 + 18 * Math.abs(Math.sin(i * 0.37 + seed) * Math.sin(i * 0.11 + seed * 2.3)); d += "M" + (i * 6 + 3) + " " + (26 - a).toFixed(1) + "V" + (26 + a).toFixed(1); }
  return '<svg width="' + w + '" height="52"><path d="' + d + '" stroke="rgba(94,234,212,0.55)" stroke-width="3" stroke-linecap="round"/></svg>';
}
var nBuild = 0;
CLIPS.forEach(function (c, i) {
  c.el = mk("clip " + c.col + (c.hook != null ? " ctr" : ""), world, (c.col === "au" ? wave(c.w, i) : "") + '<span style="position:relative">' + c.label + "</span>");
  c.el.style.width = c.w + "px";
  c.born = c.hook != null ? T.morph[1] : c.cmd ? T.cmdAt[0] : 3.7 + 0.15 * nBuild++;
});
var byId = {}; CLIPS.forEach(function (c) { if (c.id) byId[c.id] = c; });
var trA = mk("tr", world, TR_SVG), trB = mk("tr", world, TR_SVG), fxb = mk("fxb", world, "fx"), ph = mk("", world); ph.id = "ph";
var PHX = curve([[3.4, -700], [8.4, 160], [13.4, 360], [18.9, -260], [23.9, -700], [24.3, -700], [26.1, 740], [30, 740]]);

// the agent's trims ripple in one after another
function trimU(c, t) { var k = c.trim ? ["h1", "intro.mp4", "product.mov", "demo.webm", "scene-2.mp4"].indexOf(c.id || c.label) : -1; return k < 0 ? 0 : smoother((t - T.calls[0] - 0.12 * k) / 0.7); }
function clipX(c, t) { return c.trim ? mix(c.x, c.trim[0], trimU(c, t)) : c.x; }
function clipW(c, t) { return c.trim ? mix(c.w, c.trim[1], trimU(c, t)) : c.w; }

function poseWorld(t, c) {
  var tf = camTransform(c), gone = 1 - smr(t, T.flash - 0.1, T.flash + 0.35);
  world.style.transform = ground.style.transform = tf;
  panel.style.opacity = (smr(t, 2.0, 3.0) * gone).toFixed(3);
  var phx = PHX(t);
  CLIPS.forEach(function (k) {
    var u = k.hook != null ? (t >= k.born ? 1 : 0) : expOut((t - k.born) / 0.6), on = t >= k.born;
    var x = clipX(k, t), w = clipW(k, t), y = laneY(k.tr) + 6, z = k.hook != null ? 0 : mix(k.cmd ? 420 : 520, 0, u);
    var lit = t > T.exp[0] && t < T.flash + 0.4 && phx > x ? 1.22 : 1;
    k.el.style.display = on ? "flex" : "none";
    k.el.style.width = w.toFixed(1) + "px";
    k.el.style.transform = "translate3d(" + f2(x + (k.cmd ? 0 : (1 - u) * 160)) + "px," + f2(y - (1 - u) * 30) + "px," + f2(z) + "px)";
    k.el.style.opacity = (c01(u * 2.5) * gone).toFixed(3);
    k.el.style.filter = k.id === "h2" ? "hue-rotate(" + (fxOn(t) * 70).toFixed(1) + "deg) saturate(" + (1 + 0.5 * fxOn(t)).toFixed(2) + ") brightness(" + lit + ")" : lit > 1 ? "brightness(" + lit + ")" : "";
  });
  // transitions: A between "video editor" and demo.webm (the command), B between intro and product (the agent)
  var d = byId.h1, ua = expOut((t - T.cmdAt[1]) / 0.5), ub = expOut((t - T.calls[2] - 0.15) / 0.5);
  pose3(trA, clipX(d, t) + clipW(d, t) - 17, laneY(1) + 15, 12, ua, gone);
  pose3(trB, -220 - 17, laneY(0) + 15, 12, ub, gone);
  var h2 = byId.h2, fo = fxOn(t);
  fxb.style.display = fo > 0.001 ? "flex" : "none";
  fxb.style.transform = "translate3d(" + f2(h2.x + h2.w - 62) + "px," + f2(laneY(2) + 17 - (1 - fo) * 60) + "px," + f2(16 + (1 - fo) * 160) + "px)";
  fxb.style.opacity = (fo * gone).toFixed(3);
  ph.style.display = t >= T.morph[1] && t < T.flash + 0.4 ? "block" : "none";
  ph.style.transform = "translate3d(" + f2(phx) + "px,-280px,4px)";
  ph.style.opacity = gone.toFixed(3);
}
function pose3(el, x, y, z, u, gone) {
  el.style.display = u > 0.001 ? "block" : "none";
  el.style.transform = "translate3d(" + f2(x) + "px," + f2(y) + "px," + f2(z) + "px) scale(" + mix(2.4, 1, u).toFixed(3) + ") rotate(" + mix(-180, 0, u).toFixed(1) + "deg)";
  el.style.opacity = (c01(u * 2) * gone).toFixed(3);
}
// effect/add drops the fx badge on; undo lifts it off; redo puts it back
function fxOn(t) {
  return expOut((t - T.cmdAt[2]) / 0.45) * (1 - smoother((t - T.cmdAt[3]) / 0.4)) + expOut((t - T.cmdAt[4]) / 0.45) * (t > T.cmdAt[4] ? 1 : 0);
}
