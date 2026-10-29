// ---- the camera: three shots blended into one take. Each is a pure function of t returning a position, a point to
// look at, a field of view and an up vector.
var Z = V(0, 0, 1), NUP = V(-DIR.y, DIR.x, 0), YUP = V(0, 1, 0);
var deg = Math.PI / 180;

// A · the core and the Sun: one log zoom from 0.022 to 40 units, an orbit that slows to a drift, the subject held
// right of centre so the type has the left third
function camSun(t) {
  var az = (t < 9.4 ? 26.8 + 27 * Math.pow(1 - t / 9.4, 2) : 26.8 - 6 * sm((t - 9.4) / (T.convEnd - 9.4))) * deg; // settles by the rest
  var el = (17 + 4 * smr(t, 5, 12)) * deg;
  var dir = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  var D = logMix(0.018, 48, smoother((t - T.zoomStart) / (T.zoomEnd - T.zoomStart))) * logMix(1, 42 / 48, smr(t, 9.0, 14.1));
  var w = smr(t, 4.6, 8.4), q = photonWorldSmoothed(t).lerp(V(0, 0, 0), w);
  if (t > T.walkStart) q.add(threadPoint(t).p.multiplyScalar(0.12 * smr(t, T.walkStart, 11)));
  var p = q.clone().addScaledVector(dir, D);
  var fwd = q.clone().sub(p).normalize(), right = fwd.clone().cross(YUP).normalize();
  return { p: p, q: q.clone().addScaledVector(right, -D * mix(0.2, 0.3, smr(t, 6, 9))), fov: mix(40, 38, smr(t, 6, 12)), up: YUP.clone() };
}

// B · the ride: the camera orbits the photon while it flies, always looking at it. It starts ahead, the Sun
// straight behind the spark; swings round its side; and ends behind it, where the aim leads off down the beam to Earth
function camRide(t) {
  var h = beamPoint(t), th = Math.PI * smr(t, 15.4, 17.6), k = smr(t, 16.6, 18.0);
  var p = h.clone().addScaledVector(DIR, Math.cos(th) * mix(4.0, 4.5, k)).addScaledVector(Z, Math.sin(th) * 4.0 + 1.8 * k).addScaledVector(NUP, mix(1.0, 0.9, k));
  return { p: p, q: h.clone().addScaledVector(DIR, 14 * smr(t, 17.2, 18.6)), fov: mix(38, 50, smr(t, 16.0, 18.4)), up: YUP.clone() };
}

// C · Earth: an approach that starts at the ride's own speed, an orbit from the dayside round toward the night
// side, then a pull back until the Sun is a point beside a lit crescent
var C0 = (function () {
  var rel = camRide(T.approach).p.sub(PE), De = rel.length(); rel.divideScalar(De);
  var c1 = rel.dot(SUN_L), c2 = rel.dot(Z), c3 = rel.dot(NUP);
  var tNext = camRide(T.approach + 0.01).p.distanceTo(PE);
  return { De: De, a: Math.atan2(c2, c1), el: Math.asin(c3), rate: (Math.log(tNext) - Math.log(De)) / 0.01 };
})();
var APPROACH_DUR = 2.0, DE_NEAR = 8.6;
function hermite(u, m0) { u = c01(u); var u2 = u * u, u3 = u2 * u; return (-2 * u3 + 3 * u2) + m0 * (u3 - 2 * u2 + u); }
function camEarth(t) {
  var dl = Math.log(DE_NEAR) - Math.log(C0.De), m0 = C0.rate * APPROACH_DUR / dl;
  var De = Math.exp(Math.log(C0.De) + dl * hermite((t - T.approach) / APPROACH_DUR, m0)) * logMix(1, 19 / DE_NEAR, smr(t, 25.6, 30.8));
  var a = C0.a + (32 * deg - C0.a) * smr(t, T.approach, 22.0) + 48 * deg * smr(t, 21.4, 26.4) + 62 * deg * smr(t, 25.4, 31.0);
  var el = C0.el + (8 * deg - C0.el) * smr(t, T.approach, 22.0) + 10 * deg * smr(t, 25.4, 31.0);
  var dir = SUN_L.clone().multiplyScalar(Math.cos(a)).addScaledVector(Z, Math.sin(a)).multiplyScalar(Math.cos(el)).addScaledVector(NUP, Math.sin(el));
  var p = PE.clone().addScaledVector(dir, De);
  var fwd = PE.clone().sub(p).normalize(), right = fwd.clone().cross(YUP).normalize();
  var look = PE.clone().addScaledVector(right, -De * 0.3).sub(p).normalize();
  // the closing frame: aim between the Sun and Earth so both share it
  var toSun = p.clone().negate().normalize(), toEarth = PE.clone().sub(p).normalize();
  var bis = toSun.clone().multiplyScalar(0.42).add(toEarth.multiplyScalar(0.58)).normalize();
  look.lerp(bis, smr(t, 25.6, 29.4)).normalize();
  return { p: p, q: p.clone().addScaledVector(look, De), fov: mix(50, 40, smr(t, T.approach, 22.0)) - 4 * smr(t, 25.6, 30), up: YUP.clone().lerp(NUP, 0.45 * smr(t, 25.6, 30)).normalize() };
}

// one camera from the three shots: the aim turns to the escaping photon first, then the camera follows it out
var camAt = K.shots([
  { at: 0, fn: camSun },
  { at: T.breakout, fn: camRide, blend: T.rideStart - T.breakout, aimFirst: 0.4 },
  { at: T.approach, fn: camEarth, blend: 0.9 },
]);
function placeCamera(cam, t) {
  var c = camAt(t);
  K.place(cam, c, { near: Math.min(c.p.distanceTo(c.q), nearestThing(c.p)), maxNear: 0.4, far: 8000 });
  return c;
}
// the closest thing the camera might be looking past: the photon in the core, the beam on the ride, Earth's surface
function nearestThing(p) {
  return Math.min(p.distanceTo(MC) + 1e-4, p.distanceTo(PE) - RE, Math.max(0.05, distToBeam(p)), Math.max(0.05, p.length() - R));
}
function distToBeam(p) { var r = p.clone().sub(EXIT), s = clamp(r.dot(DIR), 0, BEAM_LEN); return r.addScaledVector(DIR, -s).length(); }
