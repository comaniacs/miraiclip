// ---- the camera: one take, as smooth curves of four numbers around your local "up" (N):
// distance D (log-eased: ×70,000 out, then home again), tilt from up, orbit around up, and the point it aims at.
var deg = Math.PI / 180;
// the orbit's drift (5°/s) eases to a stop for the declared rest and picks up after it; integrated once, so the
// angle is smooth however the rate changes
var AZ_TABLE = (function () {
  var out = [0], dt = 0.001, acc = 0;
  for (var i = 1; i <= T.DUR / dt + 1; i++) {
    var t = i * dt, w = 1 - smr(t, T.restFrom - 0.6, T.restFrom) + smr(t, T.restTo, T.restTo + 0.6);
    acc += 5 * c01(w) * dt; out.push(acc);
  }
  return out;
})();
function azDrift(t) { var x = clamp(t, 0, T.DUR) * 1000, i = Math.floor(x); return mix(AZ_TABLE[i], AZ_TABLE[Math.min(i + 1, AZ_TABLE.length - 1)], x - i); }

var HIGH = 14; // how far above you the aim rises when the satellites are in view
function camAt(t) {
  var logD = Math.log(0.0017) + (Math.log(85) - Math.log(0.0017)) * smoother((t - T.zoomStart) / (T.zoomEnd - T.zoomStart))
    + Math.log(125 / 85) * smr(t, 9.6, 14.5)
    + (Math.log(0.0016) - Math.log(125)) * smoother((t - T.dive[0]) / (T.dive[1] - T.dive[0]));
  var D = Math.exp(logD);
  var el = (42 + 38 * smr(t, 4.4, 9.2) - 40 * smr(t, 21.4, 25.8)) * deg;
  var az = (-30 + azDrift(t) + 40 * smr(t, 14.6, 20.0)) * deg;
  // the aim rises above you in proportion to how far out the camera is, so you stay in frame at every distance
  var target = P.clone().addScaledVector(N, HIGH * 1.2 * D / Math.sqrt(D * D + 85 * 85));
  target.add(SATS[0].clone().sub(P.clone().addScaledVector(N, HIGH)).multiplyScalar(0.3 * smr(t, 9.6, 11.0) * (1 - smr(t, 14.2, 15.6))));
  var dir = N.clone().multiplyScalar(Math.cos(el)).add(E.clone().multiplyScalar(Math.cos(az) * Math.sin(el))).add(U.clone().multiplyScalar(Math.sin(az) * Math.sin(el)));
  var p = target.clone().addScaledVector(dir, D);
  // the subject sits right of centre: the type has the left third
  var fwd = target.clone().sub(p).normalize(), right = fwd.clone().cross(N).normalize();
  return { p: p, q: target.clone().addScaledVector(right, -D * 0.18), fov: 40 - 4 * smr(t, 25, 30), up: N.clone() };
}
function placeCamera(cam, t) { return K.place(cam, camAt(t), { maxNear: 0.5, far: 3000 }).position; }
