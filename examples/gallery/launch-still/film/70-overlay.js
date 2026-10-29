// ---- motion graphics: masked captions, the name, callouts pinned to the exploded layers, the timer and the lockup.
// Every style is set from t on every frame, so any frame renders the same alone.

// a line rises through its mask (the element clips, its first child moves) and drifts up as it leaves
function lineIO(id, tin, tout, t) {
  var e = $(id), sp = e.firstElementChild, u = smoother((t - tin) / 0.65), v = sm((t - tout) / 0.45);
  e.style.opacity = t < tin || t > tout + 0.45 ? 0 : 1;
  sp.style.transform = "translateY(" + ((1 - u) * 108 - v * 22).toFixed(2) + "%)";
  sp.style.opacity = (u * (1 - v)).toFixed(3);
}
function fadeIO(id, tin, tout, t, dy) {
  var e = $(id), u = smoother((t - tin) / 0.55), v = sm((t - tout) / 0.45);
  e.style.opacity = (u * (1 - v)).toFixed(3);
  e.style.transform = "translateY(" + ((1 - u) * (dy || 18) - v * 10).toFixed(2) + "px)";
}
// the name: letters arrive from wide tracking to their set spacing, the way light settles on an engraving
function wordIO(id, tin, tout, t, from, to) {
  var e = $(id), u = smoother((t - tin) / 1.1), v = sm((t - tout) / 0.5);
  e.style.opacity = (Math.min(1, u * 1.6) * (1 - v)).toFixed(3);
  e.style.letterSpacing = mix(from, to, u).toFixed(4) + "em";
  e.style.filter = "blur(" + f2((1 - u) * 6) + "px)";
}

// callouts: a dot on the layer's edge nearest the type, an elbow leader, and the words at its end
var CALLOUTS = [
  { id: "co1", layer: "glass", y: -107, lift: 168, ly: 330, at: T.callouts[0] },
  { id: "co2", layer: "crown", y: -72, lift: 78, ly: 520, at: T.callouts[1] },
  { id: "co3", layer: "base", y: -15, lift: 0, ly: 710, at: T.callouts[2] },
];
var LABEL_END = 700;
function anchorOf(co, c, e) {
  var R = DIAL[co.layer].R, best = null;
  for (var a = 0; a < 360; a += 4) {
    var p = [Math.sin(a * deg) * R, co.y - co.lift * e, Math.cos(a * deg) * R], s = project(p, c);
    var n = [Math.sin(a * deg), 0, Math.cos(a * deg)], v = V.sub(camPos(c), p);
    if (V.dot(n, v) <= 0) continue; // only the side we can see
    if (!best || s.x < best.x) best = s;
  }
  return best;
}
function poseCallouts(t, c) {
  var e = explodeAmt(t);
  CALLOUTS.forEach(function (co, i) {
    var ld = $(co.id + "l"), dot = $(co.id + "d"), box = $(co.id);
    var out = sm((t - T.calloutsOut - i * 0.06) / 0.4), u = smoother((t - co.at) / 0.5);
    if (t < co.at || out >= 1) { ld.style.opacity = dot.style.opacity = box.style.opacity = 0; return; }
    var s = anchorOf(co, c, e), elbow = { x: s.x - 70, y: co.ly }, end = { x: LABEL_END + 26, y: co.ly };
    ld.setAttribute("points", f2(s.x) + "," + f2(s.y) + " " + f2(elbow.x) + "," + f2(elbow.y) + " " + f2(end.x) + "," + f2(end.y));
    var len = Math.hypot(s.x - elbow.x, s.y - elbow.y) + (elbow.x - end.x);
    ld.style.strokeDasharray = f2(len); ld.style.strokeDashoffset = f2(len * (1 - u));
    ld.style.opacity = (1 - out).toFixed(3);
    dot.setAttribute("cx", f2(s.x)); dot.setAttribute("cy", f2(s.y));
    dot.style.opacity = (smoother((t - co.at) / 0.2) * (1 - out)).toFixed(3);
    var tu = smoother((t - co.at - 0.3) / 0.5);
    box.style.top = (co.ly - 34) + "px";
    box.style.opacity = (tu * (1 - out)).toFixed(3); box.style.transform = "translateX(" + f2((1 - tu) * 14) + "px)";
  });
}

function pad2(n) { return String(n).padStart(2, "0"); }
function timerText(t) {
  if (t < T.countdown) return pad2(Math.round(minutesSet(t))) + ":00";
  var left = Math.ceil(T.minutes * 60 - (t - T.countdown));
  return pad2(Math.floor(left / 60)) + ":" + pad2(left % 60);
}

function poseOverlay(t, c) {
  // 1 · hook
  lineIO("h1", T.hook1In, T.hookOut, t); lineIO("h2", T.hook2In, T.hookOut + 0.08, t);
  // 2 · the name
  fadeIO("eyebrow", T.revealIn, T.revealOut, t, 12);
  wordIO("word", T.wordIn, T.revealOut + 0.05, t, 0.9, 0.34);
  lineIO("sub", T.subIn, T.revealOut + 0.1, t);
  // 3 · callouts
  poseCallouts(t, c);
  // 4 · the feature
  lineIO("set", T.turnIn, T.setOut, t);
  fadeIO("timer", T.turnIn + 0.15, T.keepOut + 0.1, t, 14);
  $("timerV").textContent = timerText(t);
  $("timer").style.setProperty("--hot", Math.exp(-Math.max(0, t - T.turn[1]) * 3).toFixed(3) * (t > T.turn[0] ? 1 : 0));
  lineIO("keep", T.keepIn, T.keepOut, t);
  // 5 · the payoff
  lineIO("calm", T.calmIn, T.calmOut, t);
  // 6 · lockup
  wordIO("lock", T.title, 99, t, 0.8, 0.34);
  lineIO("tag", T.tag, 99, t);
  fadeIO("cta", T.cta, 99, t, 10);
  // the vignette breathes with the light: deep in the hook, open once the dial is lit
  $("vig").style.opacity = mix(1, 0.75, smr(t, T.lightOn[0], T.lightOn[1])).toFixed(3);
}
