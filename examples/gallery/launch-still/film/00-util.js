// ---- shared helpers: easing, a tiny vector kit, monotone keyframe curves and the CSS-3D projection.
// Units are CSS pixels in world space; y points down (so "up" is -y), the dial sits on the floor plane y = 0.
var W = 1920, H = 1080, PERSP = 1400;
var $ = function (id) { return document.getElementById(id); };
var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
var c01 = function (x) { return clamp(x, 0, 1); };
var sm = function (x) { x = c01(x); return x * x * (3 - 2 * x); };
var smr = function (t, a, b) { return sm((t - a) / (b - a)); };
var smoother = function (x) { x = c01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
var mix = function (a, b, u) { return a + (b - a) * u; };
var expOut = function (x) { x = c01(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
var deg = Math.PI / 180;
var f2 = function (x) { return x.toFixed(2); };

var V = {
  add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
  sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
  mul: function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
  dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
  norm: function (a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};

// Monotone cubic (Fritsch–Carlson) through keyframes: C1-continuous, so speed never jumps at a key, and no
// overshoot, so the camera never swings past a framing and back.
function curve(keys) {
  var n = keys.length, xs = keys.map(function (k) { return k[0]; }), ys = keys.map(function (k) { return k[1]; });
  var d = [], m = [];
  for (var i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = 0; m[n - 1] = 0; // start and end at rest
  for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { var tau = 3 / Math.sqrt(s); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
  }
  return function (x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    var k = 0; while (x > xs[k + 1]) k++;
    var h = xs[k + 1] - xs[k], u = (x - xs[k]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[k] + (u3 - 2 * u2 + u) * h * m[k] + (-2 * u3 + 3 * u2) * ys[k + 1] + (u3 - u2) * h * m[k + 1];
  };
}

// The camera is a pose { yaw, elev, dist, tgt, ox, oy } (degrees, px). The world element gets
//   translateZ(PERSP - dist) rotateX(-elev) rotateY(yaw) translate3d(-tgt)
// inside a perspective of PERSP, and the whole view is shifted by (ox, oy) on screen. project() is the same maths,
// so the overlay's leader lines and the shot check land exactly on what CSS draws.
function camTransform(c) {
  return "translateZ(" + f2(PERSP - c.dist) + "px) rotateX(" + (-c.elev).toFixed(3) + "deg) rotateY(" + c.yaw.toFixed(3) + "deg) translate3d(" + f2(-c.tgt[0]) + "px," + f2(-c.tgt[1]) + "px," + f2(-c.tgt[2]) + "px)";
}
function toView(p, c) {
  var q = V.sub(p, c.tgt), a = c.yaw * deg, e = -c.elev * deg;
  var x1 = Math.cos(a) * q[0] + Math.sin(a) * q[2], z1 = -Math.sin(a) * q[0] + Math.cos(a) * q[2], y1 = q[1]; // rotateY
  var y2 = Math.cos(e) * y1 - Math.sin(e) * z1, z2 = Math.sin(e) * y1 + Math.cos(e) * z1; // rotateX
  return [x1, y2, z2 + PERSP - c.dist];
}
function project(p, c) {
  var v = toView(p, c), k = PERSP / (PERSP - v[2]);
  return { x: W / 2 + c.ox + v[0] * k, y: H / 2 + c.oy + v[1] * k, k: k, behind: v[2] >= PERSP - 1 };
}
// where the camera is in the world: the inverse of the two rotations applied to (0, 0, dist)
function camPos(c) {
  var a = c.yaw * deg, e = -c.elev * deg;
  var y = Math.sin(e) * c.dist, z = Math.cos(e) * c.dist; // inverse rotateX of (0,0,dist)
  return [c.tgt[0] - Math.sin(a) * z, c.tgt[1] + y, c.tgt[2] + Math.cos(a) * z]; // inverse rotateY
}
