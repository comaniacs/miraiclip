// ---- motion graphics: captions, the satellite label pinned to satellite 1, the delay → distance maths, and the
// lockup. Painted as a held frame (tl.frame hold), so motion blur never doubles a digit.
var $ = function (id) { return document.getElementById(id); };
var CAPTIONS = [
  ["c_h1", T.hook1In, T.hookOut], ["c_h2", T.hook2In, T.hookOut + 0.08],
  ["c_set", T.setupIn, T.setupOut],
  ["c_m1", T.mech1In, T.mech1Out], ["c_m2", T.mech2In, T.mech2Out],
  ["c_t1", T.tr1In, T.tr1Out], ["c_t2", T.tr2In, T.tr2Out],
  ["c_rev", T.revIn, T.revOut],
  ["c_ttl", T.title, 99], ["c_sub", T.sub, 99],
];
var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); };

function poseLabel(t, cam) {
  var u = smoother((t - T.altLabel[0]) / 0.45), out = sm((t - T.altLabel[1]) / 0.4), ld = $("ld"), dot = $("ldot"), box = $("lab");
  // the leader runs away from the nearer edge, so the label never leaves the frame
  var s = K.toScreen(SATS[0], cam, W, H), dir = s.x > W * 0.62 ? -1 : 1, e = { x: s.x + 90 * dir, y: s.y + 80 }, f = { x: e.x + 70 * dir, y: e.y };
  ld.setAttribute("points", [s, e, f].map(function (p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" "));
  var len = 90 * Math.SQRT2 + 70;
  ld.style.strokeDasharray = len.toFixed(1); ld.style.strokeDashoffset = (len * (1 - u)).toFixed(1); ld.style.opacity = (1 - out).toFixed(3);
  dot.setAttribute("cx", s.x.toFixed(1)); dot.setAttribute("cy", s.y.toFixed(1)); dot.style.opacity = (smoother((t - T.altLabel[0]) / 0.2) * (1 - out)).toFixed(3);
  var tu = smoother((t - T.altLabel[0] - 0.3) / 0.45);
  box.style.left = (f.x + 16 * dir).toFixed(1) + "px"; box.style.top = (f.y - 30).toFixed(1) + "px";
  box.style.transform = dir < 0 ? "translateX(-100%)" : "none"; box.style.textAlign = dir < 0 ? "right" : "left";
  box.style.opacity = (tu * (1 - out)).toFixed(3);
}
// the maths for satellite 1: the delay counts up while the pulse travels; the distance follows the sphere
function poseMath(t) {
  K.fadeIO($("math"), T.mathIn, T.mathOut, t);
  var travel = c01((t - T.packet[0]) / (T.packet[1] - T.packet[0]));
  $("mDelay").textContent = (DELAYS[0] * travel).toFixed(3) + " s";
  var grow = c01((t - T.sphere1[0]) / (T.sphere1[1] - T.sphere1[0]));
  $("mDist").style.opacity = smoother((t - T.sphere1[0]) / 0.4).toFixed(3);
  $("mDistV").textContent = fmt(Math.floor(RADII[0] * KM_PER_UNIT * smoother(grow) / 10) * 10) + " km";
}
function poseOverlay(t, cam) {
  CAPTIONS.forEach(function (c) { K.lineIO($(c[0]), c[1], c[2], t); });
  poseLabel(t, cam); poseMath(t);
  K.fadeIO($("foot"), T.footIn, T.footOut, t, 10);
}
