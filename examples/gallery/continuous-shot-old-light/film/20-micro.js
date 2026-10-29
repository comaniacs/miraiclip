// ---- 1 · the micro world: plasma particles, the photon, its collisions and its trail.
// Built in local units (a 60-unit cloud) and scaled by MICRO_SCALE into the Sun's core, so the zoom out is one camera.
var MICRO_SCALE = 0.001, MC = V(0.08, 0, 0.08); // sits just inside the cutaway gap, at the Sun's centre
var micro = new THREE.Group(); micro.position.copy(MC); micro.scale.setScalar(MICRO_SCALE);

// the path: one straight flight per collision, bouncing off the surface of the particle it hits
var COLL = T_COLL, NC = COLL.length;
var PV = [], PN = [], PR = [];
(function buildPath() {
  var p = V(0, 0, 0), dir = V(0.35, 0.15, -1).normalize();
  for (var k = 0; k < NC; k++) {
    var len = k < 6 ? 10 + rng() * 3 : 6.5 + rng() * 5;
    p = p.clone().addScaledVector(dir, len); PV.push(p);
    var nd = V(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
    if (p.length() > 34) nd.addScaledVector(p.clone().normalize(), -1.3).normalize(); // stay inside the cloud
    if (nd.dot(dir) > 0.6) nd.addScaledVector(dir, -1).normalize(); // a visible change of course
    PN.push(nd.clone().sub(dir).normalize()); // the contact normal: out - in
    PR.push(k < 6 ? 1.35 : 0.9 + rng() * 0.4);
    dir = nd;
  }
})();
var P_START = PV[0].clone().addScaledVector(V(0.35, 0.15, -1).normalize(), -5.5);
var PATH = [P_START].concat(PV), PSEG = polySegs(PATH);

// the photon's position: still for a beat at each collision in the hook (absorbed), then off in a new direction
function photonLocal(t) {
  if (t <= COLL[0]) return P_START.clone().lerp(PV[0], t / COLL[0]);
  var k = 0; while (k < NC - 1 && COLL[k + 1] <= t) k++;
  if (k >= NC - 1) return PV[NC - 1].clone();
  var dur = COLL[k + 1] - COLL[k], hold = k < 6 ? Math.min(0.12, dur * 0.2) : 0;
  return PV[k].clone().lerp(PV[k + 1], c01((t - COLL[k] - hold) / (dur - hold)));
}
function photonArc(t) {
  if (t <= COLL[0]) return PSEG.len[1] * t / COLL[0];
  var k = 0; while (k < NC - 1 && COLL[k + 1] <= t) k++;
  if (k >= NC - 1) return 1;
  var dur = COLL[k + 1] - COLL[k], hold = k < 6 ? Math.min(0.12, dur * 0.2) : 0;
  return mix(PSEG.len[k + 1], PSEG.len[k + 2], c01((t - COLL[k] - hold) / (dur - hold)));
}
function lastCollision(t) { var k = -1; while (k < NC - 1 && COLL[k + 1] <= t) k++; return k; }

// the particles: one sits at every collision, the rest fill the cloud but keep out of the photon's way
var PART = [];
for (var k0 = 0; k0 < NC; k0++) PART.push({ p: PV[k0].clone().addScaledVector(PN[k0], -PR[k0]), r: PR[k0], hit: COLL[k0], hue: 0.5 });
(function fill() {
  var tries = 0, segA = PATH.slice(0, -1), segB = PATH.slice(1), tmp = V(0, 0, 0), ab = V(0, 0, 0);
  while (PART.length < 1700 && tries < 40000) {
    tries++;
    var q = V(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).multiplyScalar(62);
    if (q.length() > 62) continue;
    var small = rng() < 0.3, r = small ? 0.26 + rng() * 0.16 : 0.6 + rng() * 0.6, ok = true;
    for (var s = 0; s < segA.length && ok; s++) {
      ab.subVectors(segB[s], segA[s]); var u = c01(tmp.subVectors(q, segA[s]).dot(ab) / ab.lengthSq());
      if (tmp.copy(segA[s]).addScaledVector(ab, u).distanceTo(q) < r + 1.8) ok = false;
    }
    if (ok) PART.push({ p: q, r: r, hit: -1, hue: small ? 1 : rng() * 0.6 });
  }
})();
var NP = PART.length;
var partGeo = new THREE.SphereGeometry(1, 20, 14);
var partMat = new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.32, metalness: 0.25, emissive: 0xffffff, emissiveIntensity: 1 });
partMat.onBeforeCompile = function (sh) { // the per-particle colour drives the glow, the lit colour stays shared
  sh.fragmentShader = sh.fragmentShader.replace("vec3 totalEmissiveRadiance = emissive;", "vec3 totalEmissiveRadiance = emissive * vColor;").replace("#include <color_fragment>", "");
};
var parts = new THREE.InstancedMesh(partGeo, partMat, NP); parts.frustumCulled = false;
parts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NP * 3), 3);
var BASE_EM = [], M4 = new THREE.Matrix4();
PART.forEach(function (pt, i) {
  M4.makeScale(pt.r, pt.r, pt.r).setPosition(pt.p); parts.setMatrixAt(i, M4);
  var c = pt.hue === 1 ? [0.10, 0.075, 0.05] : [0.045 + pt.hue * 0.03, 0.012 + pt.hue * 0.008, 0.003];
  BASE_EM.push(c);
});
micro.add(parts);

// the photon: a hot core, a halo, and the light it throws on the plasma around it
var photonCore = glowSprite(GLOW_HOT, 2.6), photonHalo = glowSprite(GLOW_SOFT, 13), flash = glowSprite(GLOW_HOT, 9);
[photonCore, photonHalo, flash].forEach(function (s) { s.material.fog = false; micro.add(s); });
var photonLight = new THREE.PointLight(0xffd9a8, 0, 0, 2); micro.add(photonLight);
var trail = fatLines(PSEG.segs, { width: 2.6, headLen: 0.035, hot: 2.4, tail: 0.5, color: 0xff9a40, hotColor: 0xfff2d6 });
micro.add(trail);

function poseMicro(t, camDist) {
  var on = t < 9.6;
  micro.visible = on; if (!on) return;
  var p = photonLocal(t), kc = lastCollision(t), since = kc >= 0 ? t - COLL[kc] : 9;
  var absorbed = kc >= 0 && kc < 6 ? 1 - smr(since, 0.0, 0.14) * 1 : 0; // the photon dims while it is absorbed
  var fadeOut = 1 - smr(t, 6.6, 8.6);
  photonCore.position.copy(p); photonHalo.position.copy(p);
  photonCore.material.opacity = 1 - 0.7 * absorbed; photonHalo.material.opacity = (0.9 - 0.5 * absorbed) * mix(1, 0.6, smr(t, 4, 8));
  photonCore.scale.setScalar(2.6 * mix(1, 3.5, smr(t, 4.5, 8.5))); // keeps the spark readable while the world shrinks
  photonLight.position.copy(p); photonLight.intensity = 4e-3 * fadeOut; // world units: the cloud is scaled to 1/1000
  flash.position.copy(kc >= 0 ? PV[kc] : p); flash.material.opacity = kc >= 0 && kc < 40 ? Math.exp(-since * 9) : 0;
  // collision glow: a particle flares when it absorbs the photon and cools over half a second
  var IC = parts.instanceColor.array;
  for (var i = 0; i < NP; i++) {
    var b = BASE_EM[i], h = PART[i].hit, f = h >= 0 && t >= h ? Math.exp(-(t - h) * 4.5) * 1.4 : 0;
    IC[i * 3] = (b[0] + f * 0.6) * fadeOut; IC[i * 3 + 1] = (b[1] + f * 0.28) * fadeOut; IC[i * 3 + 2] = (b[2] + f * 0.08) * fadeOut;
  }
  parts.instanceColor.needsUpdate = true;
  partMat.color.setRGB(1.0 * fadeOut, 0.48 * fadeOut, 0.17 * fadeOut);
  trail.material.uniforms.uHead.value = photonArc(t);
  trail.material.uniforms.uTail.value = mix(0.5, 0.9, smr(t, 4.5, 8.0));
  trail.material.uniforms.uOpacity.value = 1 - smr(t, 8.8, 9.5);
  trail.material.uniforms.uWidth.value = mix(2.6, 1.6, smr(t, 5, 8));
}
// where the camera follows in the hook: the photon, smoothed over half a second so bounces don't jerk the frame
function photonWorldSmoothed(t) {
  var acc = V(0, 0, 0), n = 10;
  for (var i = 0; i < n; i++) acc.add(photonLocal(Math.max(0, t - 0.55 * i / (n - 1))));
  return acc.multiplyScalar(MICRO_SCALE / n).add(MC);
}
