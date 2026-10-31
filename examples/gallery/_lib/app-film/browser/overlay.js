// ---- app-film kit · overlay: placing things around the app window, carrying snapshots between screens, the cursor
// and its clicks, the accent line through 3D points, reveal wipes, underlines and masked headlines. All set from t.
// The build defines WIN_W and WIN_H (the window size); the window is the plane z = 0, centred on the origin.
function w2w(x, y, z) { return [x - WIN_W / 2, y - WIN_H / 2, z || 0]; } // window coords → world
/** a window-space rect, lifted to z (and optionally rotated/scaled by extra) */
function place(el, x, y, z, w, h, extra) {
  el.style.width = f2(w) + "px"; el.style.height = f2(h) + "px";
  el.style.transform = "translate3d(" + f2(x - WIN_W / 2) + "px," + f2(y - WIN_H / 2) + "px," + f2(z || 0) + "px)" + (extra || "");
}
function mk(cls, parent, html) { var e = document.createElement("div"); e.className = cls; if (html != null) e.innerHTML = html; parent.appendChild(e); return e; }
function arc(u) { return Math.sin(Math.PI * c01(u)); }
function setHtml(el, html) { if (el.dataset.src !== html) { el.innerHTML = html; el.dataset.src = html; } }

/**
 * A snapshot of a real panel ({ html, rect } from the replay) flies from where it was to `to` (a rect, or null to
 * hide), arcing toward the camera and fading as it lands. keep = 1 scales uniformly (by width); else it squashes to
 * the target's height and fades by the middle.
 */
function flyClone(el, cap, to, span, t, keep) {
  if (!cap || !to || t < span[0] || t >= span[1]) { el.style.display = "none"; return; }
  setHtml(el, cap.html);
  var u = smoother((t - span[0]) / (span[1] - span[0])), r = cap.rect;
  var s = mix(1, to.w / r.w, u), sy = keep === 1 ? s : mix(1, to.h / r.h, u);
  el.style.display = "block"; el.style.width = r.w + "px"; el.style.height = r.h + "px"; el.style.transformOrigin = "0 0";
  el.style.transform = "translate3d(" + f2(mix(r.x, to.x, u) - WIN_W / 2) + "px," + f2(mix(r.y, to.y, u) - WIN_H / 2) + "px," + f2(180 * arc(u)) + "px) scale(" + s.toFixed(4) + "," + sy.toFixed(4) + ")";
  el.style.opacity = (1 - smr(u, keep === 1 ? 0.88 : 0.55, 1)).toFixed(3);
}
/** a snapshot that leaves the window and floats at a hero position { x, y, z, scale, rotY } */
function heroClone(el, cap, to, u) {
  if (!cap || u <= 0) { el.style.display = "none"; return; }
  setHtml(el, cap.html);
  var r = cap.rect;
  el.style.display = "block"; el.style.width = r.w + "px"; el.style.height = r.h + "px"; el.style.transformOrigin = "0 0";
  el.style.transform = "translate3d(" + f2(mix(r.x, to.x, u) - WIN_W / 2) + "px," + f2(mix(r.y, to.y, u) - WIN_H / 2) + "px," + f2(mix(0, to.z, u)) + "px) rotateY(" + (to.rotY * u).toFixed(2) + "deg) scale(" + mix(0.3, to.scale, u).toFixed(4) + ")";
  el.style.opacity = smr(u, 0, 0.35).toFixed(3);
}

// ---- the cursor: it travels to each action's target just before the action, arcing a little, presses on clicks,
// and leaves a ring where it clicked. opts: { home: {x, y}, visible: [in, out] }
function actionPoint(r, kind) { return kind === "type" || kind === "retype" || kind === "focus" ? { x: r.x + Math.min(40, r.w / 2), y: r.y + Math.min(26, r.h / 2) } : { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
function poseCursor(cursor, ripple, t, rec, R, actions, opts) {
  var prev = -1, next = -1;
  actions.forEach(function (a, i) { if (a.t <= t) prev = i; else if (next < 0) next = i; });
  var from = prev >= 0 ? actionPoint(rec.at[prev], actions[prev].kind) : opts.home, at = from;
  if (next >= 0) {
    var el = R.q(actions[next].sel);
    if (el) {
      var to = actionPoint(R.rect(el), actions[next].kind), a0 = Math.max(prev >= 0 ? actions[prev].t + (actions[prev].dur || 0) + 0.12 : 0, actions[next].t - 0.7);
      var u = smoother((t - a0) / (actions[next].t - 0.06 - a0));
      at = { x: mix(from.x, to.x, u), y: mix(from.y, to.y, u) - 30 * Math.sin(Math.PI * u) };
    }
  }
  var press = 0;
  actions.forEach(function (a) { if (a.kind === "click") press = Math.max(press, Math.exp(-Math.pow((t - a.t) / 0.07, 2))); });
  cursor.style.transform = "translate(" + f2(at.x) + "px," + f2(at.y) + "px) scale(" + (1 - 0.14 * press).toFixed(3) + ")";
  cursor.style.opacity = (smr(t, opts.visible[0], opts.visible[0] + 0.3) * (1 - smr(t, opts.visible[1], opts.visible[1] + 0.4))).toFixed(3);
  var c = -1;
  actions.forEach(function (a, i) { if (a.kind === "click" && a.t <= t && t - a.t < 0.5) c = i; });
  if (c >= 0) {
    var p = actionPoint(rec.at[c], "click"), k = (t - actions[c].t) / 0.5;
    ripple.style.display = "block";
    ripple.style.transform = "translate(" + f2(p.x) + "px," + f2(p.y) + "px) scale(" + (0.3 + 1.4 * expOut(k)).toFixed(3) + ")";
    ripple.style.opacity = (0.9 * (1 - k)).toFixed(3);
  } else ripple.style.display = "none";
}

/** a wipe over a real element's rect, top to bottom, with a glowing edge (the app shows it all at once) */
function revealMask(mask, r, u) {
  if (!r || u <= 0 || u >= 1) { mask.style.display = "none"; return; }
  var top = r.y + 2 + (r.h - 4) * u;
  mask.style.display = "block";
  mask.style.left = r.x + 2 + "px"; mask.style.width = r.w - 4 + "px"; mask.style.top = f2(top) + "px"; mask.style.height = f2(r.y + r.h - 2 - top) + "px";
}
/** an accent bar under a real element's rect */
function underline(bar, r, on) {
  if (!r || on <= 0) { bar.style.display = "none"; return; }
  bar.style.display = "block"; bar.style.left = r.x + "px"; bar.style.top = r.y + r.h + 1 + "px"; bar.style.width = Math.max(8, r.w) + "px";
  bar.style.opacity = on.toFixed(3);
}

// ---- the accent line: one stroke through 3D points, projected, smoothed (Catmull-Rom → Bézier), drawn up to a share
function drawLine(path, worldPts, c, share, alpha) {
  if (worldPts.length < 2 || share <= 0 || alpha <= 0) { path.style.opacity = 0; return; }
  var P = worldPts.map(function (p) { return project(p, c); }), d = "M" + f2(P[0].x) + " " + f2(P[0].y);
  for (var i = 0; i < P.length - 1; i++) {
    var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    d += " C" + f2(p1.x + (p2.x - p0.x) / 6) + " " + f2(p1.y + (p2.y - p0.y) / 6) + " " + f2(p2.x - (p3.x - p1.x) / 6) + " " + f2(p2.y - (p3.y - p1.y) / 6) + " " + f2(p2.x) + " " + f2(p2.y);
  }
  path.setAttribute("d", d);
  var len = path.getTotalLength();
  path.style.strokeDasharray = f2(len) + " " + f2(len + 10);
  path.style.strokeDashoffset = f2(len * (1 - c01(share)));
  path.style.opacity = c01(alpha).toFixed(3);
}

// ---- headlines: one visual language for every line. A line rises through its mask and drifts up as it leaves.
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
/** how much a scrim behind headlines should show: the max over the spans that sit over the UI */
function scrimAt(t, spans) {
  return spans.reduce(function (m, s) { return Math.max(m, smr(t, s[0] - 0.2, s[0] + 0.3) * (1 - smr(t, s[1], s[1] + 0.5))); }, 0);
}
