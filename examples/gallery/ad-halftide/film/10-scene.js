// ---- HALFTIDE: the paper (with the liquid drawn on it as SVG metaball "goo"), the falling drop, and the glass
// bottle. Every blob's position is a continuous function of t that blends one flow into the next, so the ink is one
// body of liquid from the first drop to the last pour. World: px, y down; the paper lies on y = 0.
var world = $("world");
function el(cls, parent, css, html) { var e = document.createElement("div"); e.className = cls; if (css) e.style.cssText = css; if (html) e.innerHTML = html; parent.appendChild(e); return e; }
function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
var PW = 2000, PH = 1300, D = [700, 760], B = [1250, 610]; // paper size; the drop's landing point; the bottle's spot (paper coords)
function toWorld(u, v, y) { return [u - PW / 2, y || 0, v - PH / 2]; }
var NS = "http://www.w3.org/2000/svg";
var paper = el("paper", world, "left:" + -PW / 2 + "px;top:" + -PH / 2 + "px;width:" + PW + "px;height:" + PH + "px;transform:rotateX(90deg)");
paper.innerHTML = '<svg width="' + PW + '" height="' + PH + '" viewBox="0 0 ' + PW + " " + PH + '"><defs>' +
  '<filter id="goo" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur in="SourceGraphic" stdDeviation="12" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"/></filter>' +
  '<radialGradient id="stain"><stop offset="0" stop-color="#1f4f9e" stop-opacity="0.22"/><stop offset="0.6" stop-color="#1f4f9e" stop-opacity="0.08"/><stop offset="1" stop-color="#1f4f9e" stop-opacity="0"/></radialGradient></defs>' +
  '<ellipse id="stainE" cx="' + D[0] + '" cy="' + D[1] + '" rx="330" ry="300" fill="url(#stain)" opacity="0"/>' +
  '<path id="wline" d="" fill="none" stroke="#1f4f9e" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>' +
  '<g filter="url(#goo)"><g id="gBlue" fill="#1f4f9e"></g><g id="gKelp" fill="#1d7a6b"></g><g id="gAmber" fill="#d4892a"></g></g></svg>';
var svg = paper.firstChild;
function blobs(gid, n) { var g = svg.querySelector("#" + gid), out = []; for (var i = 0; i < n; i++) { var c = document.createElementNS(NS, "circle"); g.appendChild(c); out.push(c); } return out; }
function setBlob(c, p, r) { if (r <= 0.5) { c.setAttribute("r", 0); return; } c.setAttribute("cx", f2(p[0])); c.setAttribute("cy", f2(p[1])); c.setAttribute("r", f2(r)); }

// ---- the written line: a looping flourish that flows out from the bottle's base across the page
var WPATH = "M" + (B[0] - 120) + " " + (B[1] + 120) + " C 1000 780, 860 860, 760 900 S 560 1020, 520 920 S 640 760, 700 860 S 640 1040, 480 1010 S 300 900, 330 820 S 470 760, 420 900 S 300 1060, 220 990";
var wline = svg.querySelector("#wline"); wline.setAttribute("d", WPATH);
var WLEN = wline.getTotalLength();

// ---- the blue body: 54 blobs that bloom from the drop, drain in a vortex to the bottle's spot, then flow along the
// written line as its wet head; after the writing they join the ribbons
var blue = blobs("gBlue", 54), kelp = blobs("gKelp", 26), amber = blobs("gAmber", 26);
// big, overlapping blobs so the goo fuses into one body with tendrils (small, far-apart blobs read as splatter)
var BL = blue.map(function (c, i) { var lead = i % 6 === 0; return { c: c, a: hash(i) * 2 * Math.PI, R: lead ? 240 + 140 * hash(i + 60) : 40 + 200 * Math.pow(hash(i + 60), 1.4), r: lead ? 20 : 34 + 30 * hash(i + 120), sw: (hash(i + 180) - 0.5) * 2.0 }; });
function bloomPos(b, t) {
  var u = expOut((t - T.hit) / 2.6), a = b.a + b.sw * u + 0.25 * Math.sin(t * 0.8 + b.a * 3);
  return [D[0] + Math.cos(a) * b.R * u, D[1] + Math.sin(a) * b.R * u * 0.9];
}
function vortexPos(b, t, from) { // spiral from wherever the bloom left it into the bottle's spot
  var v = smoother((t - T.vortex[0] - 0.4 * hash(b.a * 10)) / (T.vortex[1] - T.vortex[0] - 0.4));
  var dx = from[0] - B[0], dy = from[1] - B[1], r = Math.hypot(dx, dy) * (1 - v), a = Math.atan2(dy, dx) + 3.2 * v * v;
  return { p: [B[0] + Math.cos(a) * r, B[1] + Math.sin(a) * r], v: v };
}
// a ribbon: a train of blobs flowing round the bottle on a wobbling loop; k = which ribbon (0 blue, 1 kelp, 2 amber)
function ribbonPos(k, i, n, t) {
  var into = smoother((t - T.pour[0] - k * 0.25) / (T.pour[1] - T.pour[0] - 0.5));
  var th = (k * 2.1) + (i / n) * 1.6 + (0.9 + 0.12 * k) * (t - T.ribbons[0]) + 2.4 * into * into;
  var R = (360 + 110 * k + 50 * Math.sin(3 * th + k)) * (1 - into) * smoother((t - T.ribbons[0] + 0.4 - k * 0.3) / 1.4);
  return { p: [B[0] + Math.cos(th) * R, B[1] + Math.sin(th) * R * 0.78], r: (14 + 16 * Math.sin(Math.PI * i / n)) * (1 - 0.6 * into), on: (1 - smr(into, 0.85, 1)) };
}
function poseInk(t) {
  BL.forEach(function (b, i) {
    var p, r = b.r;
    if (t < T.hit) { setBlob(b.c, D, 0); return; }
    if (t < T.vortex[1]) {
      var from = bloomPos(b, Math.min(t, T.vortex[0] + 0.4)), vx = vortexPos(b, t, from);
      p = t < T.vortex[0] ? bloomPos(b, t) : vx.p;
      r = b.r * (1 - 0.25 * expOut((t - T.hit) / 2.6)) * (1 - 0.45 * vx.v) * smr(t, T.hit - 0.05, T.hit + 0.35); // the body keeps its weight as it drains
      setBlob(b.c, p, r); return;
    }
    if (t < T.ribbons[0]) { // the wet head of the stroke: a few blobs ride the line as it is drawn
      var w = smoother((t - T.write[0]) / (T.write[1] - T.write[0]));
      if (i < 8 && w > 0 && w < 1) { var q = wline.getPointAtLength(Math.max(0, w * WLEN - i * 9)); setBlob(b.c, [q.x, q.y], 15 - i * 1.3); }
      else setBlob(b.c, B, 0);
      return;
    }
    var rb = ribbonPos(0, i % 26, 26, t); setBlob(b.c, rb.p, i < 26 ? rb.r * rb.on : 0);
  });
  [kelp, amber].forEach(function (set, k) { set.forEach(function (c, i) { var rb = ribbonPos(k + 1, i, 26, t); setBlob(c, rb.p, t > T.ribbons[0] ? rb.r * rb.on : 0); }); });
  // the line: drawn by the wet head, then it stays on the page; the bloom leaves a soft stain where the drop landed
  var w = smoother((t - T.write[0]) / (T.write[1] - T.write[0]));
  wline.style.strokeDasharray = f2(WLEN) + " " + f2(WLEN + 10); wline.style.strokeDashoffset = f2(WLEN * (1 - w));
  svg.querySelector("#stainE").setAttribute("opacity", (smr(t, T.hit, T.hit + 2) * (1 - 0.4 * smr(t, T.vortex[0], T.vortex[1]))).toFixed(3));
}

// ---- the drop: a glassy ink bead falling to the landing point, and the splash ring
var drop = el("drop", world, "left:-22px;top:-30px;width:44px;height:60px"), splash = el("splash", world, "left:-60px;top:-60px;width:120px;height:120px");
function poseDrop(t, c) {
  var face = " rotateY(" + (-c.yaw).toFixed(2) + "deg) rotateX(" + c.elev.toFixed(2) + "deg)", d = toWorld(D[0], D[1]);
  var u = c01(t / T.hit), y = mix(-760, -22, u * u) + 18 * smr(t, T.hit, T.hit + 0.25);
  drop.style.display = t < T.hit + 0.25 ? "block" : "none"; // it melts into the bloom rather than vanishing
  drop.style.opacity = (1 - smr(t, T.hit, T.hit + 0.25)).toFixed(3);
  drop.style.transform = "translate3d(" + d[0] + "px," + f2(y) + "px," + d[2] + "px)" + face + " scaleY(" + (1 + 0.25 * u * u).toFixed(3) + ")";
  var s = c01((t - T.hit) / 0.7);
  splash.style.display = t >= T.hit && s < 1 ? "block" : "none";
  splash.style.transform = "translate3d(" + d[0] + "px,-1px," + d[2] + "px) rotateX(90deg) scale(" + (0.4 + 3 * expOut(s)).toFixed(3) + ")";
  splash.style.opacity = (1 - s).toFixed(3);
}

// ---- the bottle: a glass box with a neck and cap; the ink inside is a box whose height is the ink level
var BW = 220, BH = 280, BD = 170, bw = toWorld(B[0], B[1]);
var bottle = el("g3", world), inkG = el("g3", bottle), glassG = el("g3", bottle);
function box(parent, w, h, d, y0, cls, front) { // faces: front, back, left, right, top; y0 = the box's bottom (0 = paper)
  var f = {};
  f.front = el(cls + " f", parent, "left:" + -w / 2 + "px;top:" + (y0 - h) + "px;width:" + w + "px;height:" + h + "px;transform:translateZ(" + d / 2 + "px)", front || "");
  f.back = el(cls + " f", parent, "left:" + -w / 2 + "px;top:" + (y0 - h) + "px;width:" + w + "px;height:" + h + "px;transform:translateZ(" + -d / 2 + "px) rotateY(180deg)");
  f.left = el(cls + " f", parent, "left:" + -d / 2 + "px;top:" + (y0 - h) + "px;width:" + d + "px;height:" + h + "px;transform:translateX(" + -w / 2 + "px) rotateY(-90deg)");
  f.right = el(cls + " f", parent, "left:" + -d / 2 + "px;top:" + (y0 - h) + "px;width:" + d + "px;height:" + h + "px;transform:translateX(" + w / 2 + "px) rotateY(90deg)");
  f.top = el(cls + " f top", parent, "left:" + -w / 2 + "px;top:" + -d / 2 + "px;width:" + w + "px;height:" + d + "px;transform:translateY(" + (y0 - h) + "px) rotateX(90deg)");
  return f;
}
var ink = box(inkG, BW - 24, 1, BD - 24, -6, "inkf");
var glass = box(glassG, BW, BH, BD, 0, "glass", '<div class="lbl"><small>No. 07</small><b>HALFTIDE</b><span>Tidewater Blue</span><em>50 ml · fountain pen ink</em></div>');
var neck = box(glassG, 90, 44, 90, -BH, "glass neck"), cap = box(glassG, 104, 70, 104, -BH - 44, "capf");
var NORMALS = { front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, -1, 0] };
function inkLevel(t) { // full as it rises; it drops as it writes and flows out; the pour fills it again
  return 0.86 - 0.42 * smoother((t - T.write[0]) / (T.ribbons[0] + 2 - T.write[0])) + 0.5 * smoother((t - T.fill[0]) / (T.fill[1] - T.fill[0]));
}
function poseBottle(t, c, spin) {
  var rise = smoother((t - T.rise[0]) / (T.rise[1] - T.rise[0]));
  bottle.style.display = rise <= 0 ? "none" : "block";
  bottle.style.transform = "translate3d(" + bw[0] + "px," + f2(mix(BH + 140, 0, rise)) + "px," + bw[2] + "px) rotateY(" + spin.toFixed(2) + "deg)";
  var lvl = inkLevel(t) * (BH - 20), ripple = 6 * Math.sin(t * 9) * Math.exp(-Math.max(0, t - T.fill[0]) * 0.8) * smr(t, T.fill[0], T.fill[0] + 0.3);
  ink.front.style.height = ink.back.style.height = ink.left.style.height = ink.right.style.height = f2(lvl) + "px";
  ["front", "back", "left", "right"].forEach(function (k) { ink[k].style.top = f2(-6 - lvl) + "px"; });
  ink.top.style.transform = "translateY(" + f2(-6 - lvl + ripple) + "px) rotateX(90deg)";
  // explicit face visibility from each face's normal (Chrome lets face content escape backface-visibility)
  var cp = camPos(c), s = spin * deg, base = [bw[0], -BH / 2, bw[2]], view = V.sub(cp, base);
  [glass, ink, neck, cap].forEach(function (bx) {
    Object.keys(NORMALS).forEach(function (k) {
      var n = NORMALS[k], wn = [n[0] * Math.cos(s) + n[2] * Math.sin(s), n[1], -n[0] * Math.sin(s) + n[2] * Math.cos(s)];
      bx[k].style.visibility = V.dot(wn, view) > 0 ? "visible" : "hidden";
    });
  });
}
