// ---- motion graphics: the cursor and its clicks (inside the window plane), the coral kite line, the prompt reveal,
// the preview highlight, the landing, and the headlines. Set from t every frame.
var cursor = $("cursor"), ripple = $("ripple"), mask = $("rmask"), hl = $("hl");
var HOME = { x: 1180, y: 760 };
function centre(r, kind) { return kind === "type" || kind === "retype" || kind === "focus" ? { x: r.x + Math.min(40, r.w / 2), y: r.y + Math.min(26, r.h / 2) } : { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
function poseCursor(t, rec) {
  var prev = -1, next = -1;
  ACTIONS.forEach(function (a, i) { if (a.t <= t) prev = i; else if (next < 0) next = i; });
  var from = prev >= 0 ? centre(rec.at[prev], ACTIONS[prev].kind) : HOME, at = from;
  if (next >= 0) {
    var el = host.querySelector(ACTIONS[next].sel);
    if (el) {
      var to = centre(layoutRect(el), ACTIONS[next].kind), a0 = Math.max(prev >= 0 ? ACTIONS[prev].t + (ACTIONS[prev].dur || 0) + 0.12 : 0, ACTIONS[next].t - 0.7);
      var u = smoother((t - a0) / (ACTIONS[next].t - 0.06 - a0)), lift = 30 * Math.sin(Math.PI * u);
      at = { x: mix(from.x, to.x, u), y: mix(from.y, to.y, u) - lift };
    }
  }
  var press = 0;
  ACTIONS.forEach(function (a) { if (a.kind === "click") press = Math.max(press, Math.exp(-Math.pow((t - a.t) / 0.07, 2))); });
  cursor.style.transform = "translate(" + f2(at.x) + "px," + f2(at.y) + "px) scale(" + (1 - 0.14 * press).toFixed(3) + ")";
  cursor.style.opacity = (smr(t, 4.45, 4.75) * (1 - smr(t, 21.7, 22.1))).toFixed(3);
  // the click ring at the last click
  var c = -1;
  ACTIONS.forEach(function (a, i) { if (a.kind === "click" && a.t <= t && t - a.t < 0.5) c = i; });
  if (c >= 0) {
    var p = centre(rec.at[c], "click"), k = (t - ACTIONS[c].t) / 0.5;
    ripple.style.display = "block";
    ripple.style.transform = "translate(" + f2(p.x) + "px," + f2(p.y) + "px) scale(" + (0.3 + 1.4 * expOut(k)).toFixed(3) + ")";
    ripple.style.opacity = (0.9 * (1 - k)).toFixed(3);
  } else ripple.style.display = "none";
}

// the generated prompt is revealed top to bottom behind a lilac edge (the app shows it all at once; this is the film's
// wipe over the real text, not a fake loading state)
function poseReveal(t) {
  var pr = host.querySelector(".kl-prompt"), u = smoother((t - T.reveal[0]) / (T.reveal[1] - T.reveal[0]));
  if (!pr || u >= 1 || t < T.reveal[0]) { mask.style.display = "none"; return; }
  var r = layoutRect(pr), top = r.y + 2 + (r.h - 4) * u;
  mask.style.display = "block";
  mask.style.left = r.x + 2 + "px"; mask.style.width = r.w - 4 + "px"; mask.style.top = f2(top) + "px"; mask.style.height = f2(r.y + r.h - 2 - top) + "px";
}
// a coral bar under the preview's first line while it is being rewritten
function poseHighlight(t) {
  var l1 = host.querySelector(".kl-pv-text .kl-l1"), on = smr(t, 15.25, 15.5) * (1 - smr(t, 17.3, 17.6));
  if (!l1 || on <= 0) { hl.style.display = "none"; return; }
  var r = layoutRect(l1);
  hl.style.display = "block"; hl.style.left = r.x + "px"; hl.style.top = r.y + r.h + 1 + "px"; hl.style.width = Math.max(8, r.w) + "px";
  hl.style.opacity = on.toFixed(3);
}
// the scheduled card is revealed as the flying preview lands on it, with a short coral glow
function poseLanding(t) {
  var card = host.querySelector('.kl-col[data-date="2026-11-12"] .kl-card');
  if (!card) return;
  if (t < T.previewFly[1] - 0.12) card.style.visibility = "hidden";
  else card.style.boxShadow = "0 0 0 2px rgba(255,106,77," + (0.9 * Math.exp(-(t - T.previewFly[1]) * 2)).toFixed(3) + "), 0 8px 24px rgba(255,106,77," + (0.35 * Math.exp(-(t - T.previewFly[1]) * 2)).toFixed(3) + ")";
}

// ---- the kite line: one coral stroke through 3D points, projected to the screen, drawn up to a share
var line = $("kline");
function drawLine(worldPts, c, share, alpha) {
  if (worldPts.length < 2 || share <= 0 || alpha <= 0) { line.style.opacity = 0; return; }
  var P = worldPts.map(function (p) { return project(p, c); }), d = "M" + f2(P[0].x) + " " + f2(P[0].y);
  for (var i = 0; i < P.length - 1; i++) { // Catmull-Rom → cubic Bézier, so the line flows through every point
    var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    d += " C" + f2(p1.x + (p2.x - p0.x) / 6) + " " + f2(p1.y + (p2.y - p0.y) / 6) + " " + f2(p2.x - (p3.x - p1.x) / 6) + " " + f2(p2.y - (p3.y - p1.y) / 6) + " " + f2(p2.x) + " " + f2(p2.y);
  }
  line.setAttribute("d", d);
  var len = line.getTotalLength();
  line.style.strokeDasharray = f2(len) + " " + f2(len + 10);
  line.style.strokeDashoffset = f2(len * (1 - c01(share)));
  line.style.opacity = c01(alpha).toFixed(3);
}
function poseLine(t, c, ideaPts, planPts) {
  if (t < T.appIn[1]) {
    var pts = [[-1700, 900, 300]].concat(ideaPts); // the line comes in from below the frame, like a kite string
    drawLine(pts, c, smoother((t - T.thread[0]) / (T.thread[1] - T.thread[0])), 1 - smr(t, 3.1, 3.7));
  } else if (t < T.reveal[1] + 0.6) {
    var g = host.querySelector('[data-act="generate"]'), o = host.querySelector(".kl-prompt");
    if (!g || !o || t < T.reveal[0] - 0.1) { line.style.opacity = 0; return; }
    var a = layoutRect(g), b = layoutRect(o);
    drawLine([w2w(a.x + a.w - 30, a.y + a.h / 2, 0), w2w(a.x + a.w + 40, a.y - 60, 60), w2w(b.x + 30, b.y + 40, 30), w2w(b.x + 30, b.y + b.h * 0.6, 0)], c,
      smoother((t - T.reveal[0] + 0.1) / 0.55), 1 - smr(t, T.reveal[1] + 0.1, T.reveal[1] + 0.5));
  } else if (planPts.length > 1) {
    drawLine(planPts.map(function (p) { return w2w(p.p[0], p.p[1], p.p[2] + 2); }), c, smoother((t - T.planLine[0]) / (T.planLine[1] - T.planLine[0])), 1 - smr(t, T.settle[0], T.settle[0] + 0.6));
  } else line.style.opacity = 0;
}

// ---- headlines: a line rises through its mask and drifts up as it leaves; one visual language for all of them
function lineIO(id, span, t) {
  var e = $(id), sp = e.firstElementChild, u = smoother((t - span[0]) / 0.6), v = sm((t - span[1]) / 0.45);
  e.style.opacity = t < span[0] || t > span[1] + 0.45 ? 0 : 1;
  sp.style.transform = "translateY(" + ((1 - u) * 108 - v * 22).toFixed(2) + "%)";
  sp.style.opacity = (u * (1 - v)).toFixed(3);
}
function fadeIO(id, tin, tout, t, dy) {
  var e = $(id), u = smoother((t - tin) / 0.55), v = sm((t - tout) / 0.45);
  e.style.opacity = (u * (1 - v)).toFixed(3);
  e.style.transform = "translateY(" + ((1 - u) * (dy || 16) - v * 10).toFixed(2) + "px)";
}
var HEADS = [["h1a", T.hook1], ["h1b", T.hook2], ["h2a", T.head2], ["h2b", [T.head2[0] + 0.12, T.head2[1] + 0.05]], ["h3a", T.head3], ["h3b", [T.head3[0] + 0.12, T.head3[1] + 0.05]],
  ["h4a", T.head4], ["h5a", T.head5], ["h5b", [T.head5[0] + 0.25, T.head5[1] + 0.05]], ["tag", [T.tag, 99]]];
function poseType(t) {
  HEADS.forEach(function (h) { lineIO(h[0], h[1], t); });
  // a soft scrim behind headlines that sit over the UI
  var scr = Math.max(smr(t, T.head2[0] - 0.2, T.head2[0] + 0.3) * (1 - smr(t, T.head2[1], T.head2[1] + 0.5)), smr(t, T.head3[0] - 0.2, T.head3[0] + 0.3) * (1 - smr(t, T.head3[1], T.head3[1] + 0.5)), smr(t, T.head4[0] - 0.2, T.head4[0] + 0.3) * (1 - smr(t, T.head4[1], T.head4[1] + 0.5)));
  $("scrim").style.opacity = scr.toFixed(3);
  var u = smoother((t - T.title) / 0.9);
  $("lock").style.opacity = u.toFixed(3);
  $("lock").style.transform = "translateY(" + f2((1 - u) * 26) + "px)";
  $("lockMark").style.transform = "rotate(" + f2(45 - 30 * (1 - u)) + "deg) scale(" + (0.6 + 0.4 * u).toFixed(3) + ")";
  fadeIO("cta", T.cta, 99, t, 10);
}
