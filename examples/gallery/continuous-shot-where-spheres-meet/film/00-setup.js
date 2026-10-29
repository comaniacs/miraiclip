// ---- the shared world: ThreeKit helpers, the frame, and the geometry every scene draws from.
// Units: Earth's radius is 10, so one unit is 637.1 km. Satellites orbit at 41.7 (26,566 km from the centre).
var K = ThreeKit;
var W = 1920, H = 1080;
var clamp = K.clamp, c01 = K.c01, sm = K.sm, smr = K.smr, smoother = K.smoother, mix = K.mix, logMix = K.logMix;
var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
var rng = S.rand(2027);
var GROUND = new THREE.Color(0x05070d);
var KM_PER_UNIT = 637.1, C_KM_S = 299792.458;
var fatLines = function (segs, opts) { opts.resolution = [W, H]; return K.fatLines(segs, opts); };

var RE = 10, RS = 41.7;
// "you": a point on the surface, and its local frame (n up, e east, u north)
var N = V(0.35, 0.55, 0.76).normalize(), P = N.clone().multiplyScalar(RE);
var E = V(0, 1, 0).cross(N).normalize(), U = N.clone().cross(E).normalize();
// the three satellites that answer, in the sky above you; each has its own colour
var SAT_DIRS = [[-0.48, 0.22], [0.52, 0.30], [0.04, -0.56]];
var SATS = SAT_DIRS.map(function (d) { return N.clone().add(E.clone().multiplyScalar(d[0])).add(U.clone().multiplyScalar(d[1])).normalize().multiplyScalar(RS); });
var COLORS = [new THREE.Color(0x3fd8ff), new THREE.Color(0xff6f8e), new THREE.Color(0xffc35a)];
var RADII = SATS.map(function (s) { return s.distanceTo(P); });
var DELAYS = RADII.map(function (r) { return r * KM_PER_UNIT / C_KM_S; }); // seconds

// sphere 1 ∩ sphere 2: a circle through P
var CIRCLE = (function () {
  var d = SATS[1].clone().sub(SATS[0]), D = d.length(); d.divideScalar(D);
  var a = (RADII[0] * RADII[0] - RADII[1] * RADII[1] + D * D) / (2 * D);
  var c = SATS[0].clone().addScaledVector(d, a), r = Math.sqrt(Math.max(0, RADII[0] * RADII[0] - a * a));
  var x = P.clone().sub(c).normalize(), y = d.clone().cross(x).normalize(); // x points at P, so the circle starts at you
  return { c: c, r: r, n: d, x: x, y: y };
})();
// spheres 1 ∩ 2 ∩ 3: P and its mirror image across the plane of the three satellites
var GHOST = (function () {
  var nrm = SATS[1].clone().sub(SATS[0]).cross(SATS[2].clone().sub(SATS[0])).normalize();
  return P.clone().addScaledVector(nrm, -2 * P.clone().sub(SATS[0]).dot(nrm));
})();
function circlePoint(a) { return CIRCLE.c.clone().addScaledVector(CIRCLE.x, Math.cos(a) * CIRCLE.r).addScaledVector(CIRCLE.y, Math.sin(a) * CIRCLE.r); }
// where the circle meets sphere 3, besides P: the ghost, by construction
