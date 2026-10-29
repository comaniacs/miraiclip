// ---- motion graphics: captions, leader labels pinned to the 3D cut face, counters, the comparison bar and the lockup.
// Every style is set from t on every frame, so any frame can be rendered alone.
var $ = function (id) { return document.getElementById(id); };

// a line rises through its mask on the way in and drifts up as it fades on the way out
function lineIO(id, tin, tout, t) { K.lineIO($(id), tin, tout, t); }
function fadeIO(id, tin, tout, t, dy) { K.fadeIO($(id), tin, tout, t, dy); }
var CAPTIONS = [
  ["c_h1", T.hook1In, T.hookOut], ["c_h2", T.hook2In, T.hookOut + 0.08],
  ["c_set", T.setupIn, T.setupOut],
  ["c_m1", T.mech1In, T.mech1Out], ["c_m2", T.mech2In, T.mech2Out],
  ["c_free", T.freeIn, T.freeOut],
  ["c_rev", T.revealIn, T.revealOut],
  ["c_t1", T.title, 99], ["c_t2", T.sub, 99],
];

// zone labels: a dot on the cut face, an elbow leader, and the words at its end
var LABELS = [
  { at: T.coreLabel, k: "THE CORE", v: "15 million °C", r: 1.6, a: -42 },
  { at: T.radLabel, k: "RADIATIVE ZONE", v: "light random-walks out", r: 5.0, a: -40 },
  { at: T.convLabel, k: "CONVECTIVE ZONE", v: "boiling plasma rises", r: 8.6, a: -38 },
];
function toScreen(v, cam) { return K.toScreen(v, cam, W, H); }
function poseLabel(t, cam) {
  var L = null;
  LABELS.forEach(function (l) { if (t >= l.at[0] - 0.05 && t <= l.at[1] + 0.5) L = l; });
  var ld = $("ld"), dot = $("ldot"), box = $("lab");
  if (!L) { ld.style.opacity = dot.style.opacity = box.style.opacity = 0; return; }
  var a = L.a * deg, s = toScreen(V(L.r * Math.cos(a), L.r * Math.sin(a), 0.05), cam);
  var e = { x: s.x + 80, y: s.y + 90 }, f = { x: e.x + 70, y: e.y };
  ld.setAttribute("points", s.x.toFixed(1) + "," + s.y.toFixed(1) + " " + e.x.toFixed(1) + "," + e.y.toFixed(1) + " " + f.x.toFixed(1) + "," + f.y.toFixed(1));
  var len = 80 * Math.SQRT2 + 70, u = smoother((t - L.at[0]) / 0.45), out = sm((t - L.at[1]) / 0.4);
  ld.style.strokeDasharray = len.toFixed(1); ld.style.strokeDashoffset = (len * (1 - u)).toFixed(1);
  ld.style.opacity = (1 - out).toFixed(3);
  dot.setAttribute("cx", s.x.toFixed(1)); dot.setAttribute("cy", s.y.toFixed(1));
  dot.style.opacity = (smoother((t - L.at[0]) / 0.2) * (1 - out)).toFixed(3);
  $("labK").textContent = L.k; $("labV").textContent = L.v;
  var tu = smoother((t - L.at[0] - 0.3) / 0.45);
  box.style.left = (f.x + 16).toFixed(1) + "px"; box.style.top = (f.y - 30).toFixed(1) + "px";
  box.style.opacity = (tu * (1 - out)).toFixed(3); box.style.transform = "translateX(" + ((1 - tu) * -10).toFixed(2) + "px)";
}

var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); };
function poseCounters(t) {
  fadeIO("yrs", T.walkStart + 0.2, T.yearsOut, t);
  var share = yearsShare(t), y = 100000 * share;
  $("yrsV").textContent = share >= 1 ? "~100,000" : fmt(Math.floor(y / 100) * 100);
  fadeIO("clk", T.clockIn, T.clockOut, t);
  var f = c01(beamS(t) / BEAM_LEN), secs = 500 * f;
  $("clkV").textContent = Math.floor(secs / 60) + ":" + String(Math.floor(secs % 60)).padStart(2, "0");
  $("clkKm").textContent = (150 * f).toFixed(f >= 1 ? 0 : 1) + " of 150 million km";
}
function poseBar(t) {
  fadeIO("bar", T.barIn, T.barOut, t, 12);
  var u = smoother((t - T.barIn - 0.2) / 1.2);
  $("barFill").style.transform = "scaleX(" + u.toFixed(4) + ")";
  var k = smoother((t - T.barTick) / 0.35);
  $("barTick").style.opacity = k.toFixed(3); $("barTick").style.transform = "scaleY(" + mix(0.2, 1, k).toFixed(3) + ")";
  $("barYou").style.opacity = smoother((t - T.barTick - 0.15) / 0.4).toFixed(3);
  $("barNote").style.opacity = (0.75 * smoother((t - T.barTick - 0.6) / 0.5)).toFixed(3);
}
function poseOverlay(t, cam) {
  CAPTIONS.forEach(function (c) { lineIO(c[0], c[1], c[2], t); });
  poseLabel(t, cam); poseCounters(t); poseBar(t);
}
