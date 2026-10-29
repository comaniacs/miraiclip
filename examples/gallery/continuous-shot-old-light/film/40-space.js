// ---- 4 · space: the stars, the straight beam from the Sun's surface to Earth, and the dust that shows its speed
var EARTH_DIST = 600, RE = 1.6;
var PE = DIR.clone().multiplyScalar(EARTH_DIST);
var LAND = PE.clone().addScaledVector(DIR, -RE); // where the light lands, facing the Sun
var BEAM_LEN = LAND.distanceTo(EXIT);

// the photon's distance along the beam: a slow release from the surface, then exponential acceleration to Earth
function beamS(t) {
  if (t <= T.breakout) return 0;
  var u = c01((t - T.breakout) / (T.landing - T.breakout)), k = 4.5;
  return BEAM_LEN * (Math.exp(k * u) - 1) / (Math.exp(k) - 1);
}
function beamPoint(t) { return EXIT.clone().addScaledVector(DIR, beamS(t)); }

var beamPts = [];
for (var bi = 0; bi <= 400; bi++) beamPts.push(EXIT.clone().addScaledVector(DIR, BEAM_LEN * Math.pow(bi / 400, 2)));
var BSEG = polySegs(beamPts);
// arc position along the beam for a distance s (the samples are spaced as u^2)
function beamArc(s) { var u = Math.sqrt(c01(s / BEAM_LEN)), i = Math.min(399, Math.floor(u * 400)); return mix(BSEG.len[i], BSEG.len[i + 1], u * 400 - i); }
var beam = fatLines(BSEG.segs, { width: 3.2, headLen: 0.004, hot: 3.0, tail: 0.95, color: 0xffc070, hotColor: 0xfff8ee });
var beamHead = glowSprite(GLOW_HOT, 1.1), beamHalo = glowSprite(GLOW_SOFT, 4.5), burst = glowSprite(GLOW_HOT, 9);
[beamHead, beamHalo, burst].forEach(function (s) { s.material.fog = false; });

// stars: a fixed shell, round points of constant pixel size
var STAR_N = 2600, starPos = new Float32Array(STAR_N * 3), starAttr = new Float32Array(STAR_N * 2);
for (var si = 0; si < STAR_N; si++) {
  var sv = V(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize().multiplyScalar(3200).add(V(300, 200, 0));
  starPos[si * 3] = sv.x; starPos[si * 3 + 1] = sv.y; starPos[si * 3 + 2] = sv.z;
  starAttr[si * 2] = 1.2 + Math.pow(rng(), 6) * 2.6; starAttr[si * 2 + 1] = 0.25 + rng() * 0.75;
}
var starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute("aS", new THREE.BufferAttribute(starAttr, 2));
var starMat = new THREE.ShaderMaterial({
  uniforms: { uFade: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  vertexShader: "attribute vec2 aS; varying float vB; void main(){ vB=aS.y; gl_PointSize=aS.x; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader: "uniform float uFade; varying float vB; void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=1.0-smoothstep(0.4,1.0,d); gl_FragColor=vec4(vec3(1.0,0.95,0.88)*vB*a*uFade*0.8,1.0); }",
});
var stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false;

// dust: short streaks along the beam whose length follows the camera's speed, like a shutter would see them
var DUST = [];
for (var di = 0; di < 1800; di++) {
  var along = 14 + rng() * (EARTH_DIST - 26), ang = rng() * Math.PI * 2, rr = 0.9 + Math.pow(rng(), 0.7) * 9;
  var dp = DIR.clone().multiplyScalar(along).add(V(0, 0, 1).multiplyScalar(Math.cos(ang) * rr)).add(V(-DIR.y, DIR.x, 0).multiplyScalar(Math.sin(ang) * rr));
  DUST.push([dp, dp, 0, 0]);
}
var dust = fatLines(DUST, { width: 1.4, headLen: 1, hot: 0.45, tail: 0.45, color: 0xffe2c0, hotColor: 0xffe2c0 });

function poseSpace(t, camSpeed) {
  starMat.uniforms.uFade.value = smr(t, T.starsFade[0], T.starsFade[1]);
  var s = beamS(t), on = t >= T.breakout;
  beam.visible = on;
  beam.material.uniforms.uHead.value = beamArc(s);
  beam.material.uniforms.uHeadLen.value = 0.004 + 0.03 * smr(t, 16, 20);
  var hp = beamPoint(t);
  beamHead.visible = beamHalo.visible = on && t < T.landing + 0.02;
  beamHead.position.copy(hp); beamHalo.position.copy(hp);
  beamHead.material.opacity = smr(t, T.breakout, T.breakout + 0.15);
  beamHalo.material.opacity = 0.9 * beamHead.material.opacity;
  burst.visible = t >= T.breakout && t < T.breakout + 1.5;
  burst.position.copy(EXIT); burst.material.opacity = Math.exp(-(t - T.breakout) * 3.2);
  burst.scale.setScalar(9 * (1 + (t - T.breakout) * 1.2));
  var len = clamp(camSpeed * 0.022, 0, 6);
  dust.visible = t > 15.6 && t < 21.4;
  dust.material.uniforms.uStreak.value.copy(DIR).multiplyScalar(-len);
  dust.material.uniforms.uOpacity.value = smr(t, 15.6, 16.6) * (1 - smr(t, 20.2, 21.2)) * 0.9;
}
