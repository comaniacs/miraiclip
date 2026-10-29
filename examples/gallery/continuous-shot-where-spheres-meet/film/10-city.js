// ---- 1 & 6 · the city map around you: a street grid, dark glass blocks, the blue dot and its accuracy halo.
// Built in local units (one unit is about 64 m) on the plane tangent to Earth at P, and scaled into the world.
var CITY_SCALE = 1e-4, CITY_R = 90;
var city = new THREE.Group();
city.position.copy(P);
city.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(E, N, U.clone().negate())); // x east, y up
city.scale.setScalar(CITY_SCALE);

// the ground: dark, fading into the night at its edge so the map has no rim
var groundMat = new THREE.ShaderMaterial({
  uniforms: { uFade: { value: 1 } }, transparent: true, depthWrite: false,
  vertexShader: "varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader: "uniform float uFade; varying vec2 vP; void main(){ float r=length(vP)/" + CITY_R.toFixed(1) + "; vec3 c=mix(vec3(0.018,0.026,0.048),vec3(0.012,0.018,0.034),r); gl_FragColor=vec4(c,uFade*(1.0-smoothstep(0.55,1.0,r)));\n#include <colorspace_fragment>\n}",
});
var ground = new THREE.Mesh(new THREE.CircleGeometry(CITY_R, 96), groundMat); ground.renderOrder = -1; // first: it writes no depth, so streets, the dot and its rings layer on top
ground.rotation.x = -Math.PI / 2; city.add(ground);

// streets: a grid turned 18°, plus two avenues; dim amber, brighter for the avenues
var GRID_A = 18 * Math.PI / 180, ca = Math.cos(GRID_A), sa = Math.sin(GRID_A);
var rot = function (x, z) { return V(x * ca - z * sa, 0.02, x * sa + z * ca); };
var streetSegs = [], avenueSegs = [];
for (var k = -16; k <= 16; k++) {
  var o = k * 4, half = Math.sqrt(Math.max(0, 70 * 70 - o * o));
  if (half < 4) continue;
  streetSegs.push([rot(o, -half), rot(o, half), 0, 0], [rot(-half, o), rot(half, o), 0, 0]);
}
[[V(-66, 0.03, -30), V(64, 0.03, 34)], [V(-40, 0.03, 58), V(42, 0.03, -56)]].forEach(function (a) { avenueSegs.push([a[0], a[1], 0, 0]); });
var streets = fatLines(streetSegs, { width: 1.6, hot: 0.55, tail: 0.55, color: 0xff9a4a, hotColor: 0xff9a4a, headLen: 1 });
var avenues = fatLines(avenueSegs, { width: 2.6, hot: 1.0, tail: 1.0, color: 0xffc070, hotColor: 0xffc070, headLen: 1 });
city.add(streets); city.add(avenues);

// blocks: dark glass towers inside the grid cells, clear of the streets and of the dot
var BLD = [];
for (var gx = -15; gx < 15; gx++) for (var gz = -15; gz < 15; gz++) {
  var cx = gx * 4 + 2, cz = gz * 4 + 2;
  if (cx * cx + cz * cz > 62 * 62) continue;
  for (var b = 0; b < 2; b++) {
    var lx = cx + (rng() - 0.5) * 1.6, lz = cz + (rng() - 0.5) * 1.6;
    if (lx * lx + lz * lz < 3.2 * 3.2) continue;
    var hgt = 0.4 + Math.pow(rng(), 2.2) * (6 - Math.hypot(lx, lz) * 0.06);
    BLD.push({ p: rot(lx, lz), w: 0.9 + rng() * 1.1, d: 0.9 + rng() * 1.1, h: Math.max(0.3, hgt), lit: rng() });
  }
}
var bldMat = new THREE.MeshStandardMaterial({ color: 0x0a1120, metalness: 0.55, roughness: 0.4, emissive: 0xffffff, envMapIntensity: 0.18 });
bldMat.onBeforeCompile = function (sh) {
  // lit windows: a fine grid on the walls, only on some buildings (the per-instance colour sets how many)
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vLocal;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocal = position;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vLocal;")
    .replace("vec3 totalEmissiveRadiance = emissive;", "vec2 wg = fract(vec2(vLocal.x * 6.0 + vLocal.z * 6.0, vLocal.y * 9.0)); float cell = fract(sin(dot(floor(vec2(vLocal.x * 6.0 + vLocal.z * 6.0, vLocal.y * 9.0)), vec2(12.9898, 78.233))) * 43758.5453); float win = step(0.45, wg.x) * step(0.4, wg.y) * step(vLocal.y, 0.98) * step(0.62, cell); vec3 totalEmissiveRadiance = emissive * vColor * win;")
    .replace("#include <color_fragment>", "");
};
var blds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), bldMat, BLD.length);
blds.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BLD.length * 3), 3);
var M4 = new THREE.Matrix4(), Q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -GRID_A);
var BLD_EM = BLD.map(function (bd, i) {
  M4.compose(bd.p, Q, V(bd.w, bd.h, bd.d)); blds.setMatrixAt(i, M4);
  return bd.lit > 0.4 ? [0.55 * bd.lit, 0.36 * bd.lit, 0.17 * bd.lit] : [0, 0, 0];
});
city.add(blds);

// you: a blue dot, a white rim, an accuracy halo, a glow, and the rings it breathes out
var dot = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshBasicMaterial({ color: 0x4f9dff, toneMapped: false, transparent: true }));
var rim = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }));
var halo = new THREE.Mesh(new THREE.CircleGeometry(3.0, 64), new THREE.MeshBasicMaterial({ color: 0x4f9dff, transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false }));
[dot, rim, halo].forEach(function (m, i) { m.rotation.x = -Math.PI / 2; m.position.y = 0.06 + i * 0.002; city.add(m); });
var RINGS = [0, 1, 2].map(function () {
  var r = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.0, 64), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  r.rotation.x = -Math.PI / 2; r.position.y = 0.07; city.add(r); return r;
});
var dotGlow = K.glowSprite(K.glowTexture([[0, "rgba(220,240,255,0.9)"], [0.15, "rgba(110,175,255,0.45)"], [1, "rgba(60,120,255,0)"]]), 5);
dotGlow.position.y = 0.3; city.add(dotGlow);

function poseCity(t, D) {
  var fade = 1 - smr(t, 5.6, 7.0), back = smr(t, 23.2, 24.8); // leaves as Earth arrives; returns for the landing
  var k = Math.max(fade, back);
  city.visible = k > 0.001;
  groundMat.uniforms.uFade.value = k;
  streets.material.uniforms.uOpacity.value = k; avenues.material.uniforms.uOpacity.value = k;
  var IC = blds.instanceColor.array;
  for (var i = 0; i < BLD_EM.length; i++) { IC[i * 3] = BLD_EM[i][0] * k; IC[i * 3 + 1] = BLD_EM[i][1] * k; IC[i * 3 + 2] = BLD_EM[i][2] * k; }
  blds.instanceColor.needsUpdate = true;
  bldMat.color.setScalar(k).multiply(new THREE.Color(0x0a1120));
  // the dot breathes; after the landing three rings close in on it
  var breathe = 1 + 0.08 * Math.sin(t * 2 * Math.PI / 1.6);
  dot.scale.setScalar(breathe); rim.scale.setScalar(breathe);
  [dot, rim].forEach(function (m) { m.material.opacity = k; });
  halo.material.opacity = 0.14 * k; dotGlow.material.opacity = 0.9 * k;
  RINGS.forEach(function (r, i) {
    var conv = smr(t, T.converge + i * 0.25, T.converge + 1.4 + i * 0.25);
    var rad = t < T.converge ? 1 + ((t * 0.6 + i / 3) % 1) * 3.2 : mix(5.5 - i * 0.6, 0.8, conv);
    // the breathing rings fade out just before the converging ones fade in, so the switch happens at zero
    var a = t < T.converge ? (1 - ((t * 0.6 + i / 3) % 1)) * 0.5 * (1 - smr(t, T.converge - 0.4, T.converge)) : 0.7 * smr(t, T.converge, T.converge + 0.35) * (1 - conv * 0.6);
    r.scale.setScalar(rad); r.material.opacity = a * k;
    r.material.color.copy(t < T.converge ? new THREE.Color(0x9fd0ff) : COLORS[i]);
  });
}
