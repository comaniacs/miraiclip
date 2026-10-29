// ---- 2–3 · the satellites: gold-foil bodies with solar wings, broadcasting the time as expanding shells,
// the threads their signals follow down to you, and the stamped pulses that travel them.
function cellTexture() {
  var c = document.createElement("canvas"); c.width = 256; c.height = 96;
  var g = c.getContext("2d"); g.fillStyle = "#0a1a3c"; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = "#3a5a9a"; g.lineWidth = 2;
  for (var x = 0; x <= 256; x += 21.3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 96); g.stroke(); }
  for (var y = 0; y <= 96; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
var foil = new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 0.92, roughness: 0.34 });
var panelMat = new THREE.MeshStandardMaterial({ map: cellTexture(), metalness: 0.4, roughness: 0.25, color: 0xffffff });
var strutMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, metalness: 0.8, roughness: 0.4 });
var SAT_GEO = {
  body: new THREE.RoundedBoxGeometry(0.62, 0.62, 0.95, 2, 0.06),
  panel: new THREE.BoxGeometry(1.7, 0.03, 0.62),
  strut: new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8),
  dish: new THREE.ConeGeometry(0.22, 0.22, 24, 1, true),
};
function makeSat() {
  var g = new THREE.Group();
  g.add(new THREE.Mesh(SAT_GEO.body, foil));
  [-1, 1].forEach(function (s) {
    var p = new THREE.Mesh(SAT_GEO.panel, panelMat); p.position.x = s * 1.32; g.add(p);
    var st = new THREE.Mesh(SAT_GEO.strut, strutMat); st.rotation.z = Math.PI / 2; st.position.x = s * 0.5; g.add(st);
  });
  var d = new THREE.Mesh(SAT_GEO.dish, strutMat); d.rotation.x = Math.PI / 2; d.position.z = 0.6; g.add(d); // faces Earth (+z)
  g.scale.setScalar(1.6);
  return g;
}
var satGroup = new THREE.Group();
var BG_DIRS = [];
for (var bi = 0; bi < 9; bi++) {
  var dd = V(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
  if (dd.dot(N) > 0.55) dd.addScaledVector(N, -1.2).normalize(); // keep clear of the three that answer
  BG_DIRS.push(dd);
}
var satObjs = SATS.concat(BG_DIRS.map(function (d) { return d.clone().multiplyScalar(RS); })).map(function (pos, i) {
  var s = makeSat(); s.position.copy(pos); s.lookAt(0, 0, 0); s.rotateZ(i * 0.9); satGroup.add(s); return s;
});

// broadcast shells: three per satellite, expanding and fading, additive rims so they never sort
var shellMat = function (col) {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: col }, uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: "varying vec3 vN; varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }",
    fragmentShader: "uniform vec3 uCol; uniform float uA; varying vec3 vN; varying vec3 vW; void main(){ float fr=pow(1.0-abs(dot(normalize(vN),normalize(cameraPosition-vW))),2.6); gl_FragColor=vec4(uCol*fr*uA,1.0); }",
  });
};
var shellGeo = new THREE.SphereGeometry(1, 64, 40);
var SHELLS = [];
SATS.forEach(function (s, i) { for (var k = 0; k < 3; k++) { var m = new THREE.Mesh(shellGeo, shellMat(COLORS[i])); m.position.copy(s); satGroup.add(m); SHELLS.push({ m: m, sat: i, phase: k / 3 }); } });

// threads: the straight paths from each satellite to you; packets slide down them
var THREADS = SATS.map(function (s, i) {
  var pts = []; for (var k = 0; k <= 60; k++) pts.push(P.clone().lerp(s, Math.pow(k / 60, 2)));
  return fatLines(K.polySegs(pts).segs, { width: 2.2, headLen: 1, hot: 1, tail: 1, color: COLORS[i], hotColor: COLORS[i] });
});
var PACKETS = SATS.map(function (s, i) {
  return K.glowSprite(K.glowTexture([[0, "rgba(255,255,255,1)"], [0.2, "rgba(255,255,255,0.5)"], [1, "rgba(255,255,255,0)"]]), 1);
});
PACKETS.forEach(function (p, i) { p.material.color.copy(COLORS[i]); });

function poseSats(t) {
  var on = smr(t, 6.4, 8.0) * (1 - smr(t, 22.4, 23.6));
  satGroup.visible = on > 0.001;
  satObjs.forEach(function (s) { s.visible = on > 0.001; });
  var shellOn = smr(t, 6.6, 7.6) * (1 - smr(t, 14.4, 15.4)) * 0.9;
  SHELLS.forEach(function (sh) {
    var u = ((t * 0.42 + sh.phase) % 1), r = 1.5 + u * 34;
    sh.m.scale.setScalar(r); sh.m.material.uniforms.uA.value = shellOn * Math.pow(1 - u, 1.4) * (sh.sat === 0 ? 1 : mix(1, 0.35, smr(t, 9.6, 10.4)));
  });
  // threads: present from the start (they're what the hook shows), quieter while the spheres speak
  THREADS.forEach(function (th, i) {
    var focus = t > 9.6 && t < 15 ? (i === 0 ? 1 : 0.25) : 1;
    th.material.uniforms.uOpacity.value = 0.75 * focus * (1 - 0.6 * smr(t, 15, 16) * (1 - smr(t, 20.9, 21.6)));
  });
}
// a packet's position: in the hook, short falls into the dot (city scale); in the mechanism, the whole trip
function posePackets(t) {
  PACKETS.forEach(function (p, i) {
    var pos = null, size = 1;
    T.pulseLands.forEach(function (tl, k) {
      if (i !== k % 3) return;
      var u = (tl - t) / 0.7;
      if (u > 0 && u < 1) { pos = P.clone().addScaledVector(SATS[i].clone().sub(P).normalize(), 0.0028 * Math.pow(u, 1.6)); size = 0.00028; } // city scale: ~28 units up, ~2.8 wide
    });
    if (i === 0 && t > T.packet[0] && t < T.packet[1] + 0.15) {
      var f = c01((t - T.packet[0]) / (T.packet[1] - T.packet[0]));
      pos = SATS[0].clone().lerp(P, smoother(f)); size = 2.4;
    }
    p.visible = !!pos;
    if (pos) { p.position.copy(pos); p.scale.setScalar(size); }
  });
}
