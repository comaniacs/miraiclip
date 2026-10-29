// ---- 2–3 · the Sun: a sphere with its front half cut away (z > 0), its layers drawn on the z = 0 cut face,
// and the thread: the photon's random walk across that face, then one convection roll to the surface.
var R = 10, PHI_EXIT = 35 * Math.PI / 180;
var DIR = V(Math.cos(PHI_EXIT), Math.sin(PHI_EXIT), 0); // the way out, and the way to Earth
var EXIT = DIR.clone().multiplyScalar(R);
var sun = new THREE.Group();

var sunUniforms = { uTime: { value: 0 }, uFade: { value: 0 }, uGround: { value: GROUND }, uDim: { value: V(0, 0, 0) } };
var SHADE_TAIL = "#include <tonemapping_fragment>\n#include <colorspace_fragment>\n";
var surfMat = new THREE.ShaderMaterial({
  uniforms: sunUniforms,
  vertexShader: "varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vP=position; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }",
  fragmentShader: GLSL_NOISE + "\nuniform float uTime; uniform float uFade; uniform vec3 uGround; varying vec3 vP; varying vec3 vN; varying vec3 vV;\n" +
    "void main(){ vec3 q=normalize(vP);" +
    " float g=fbm(q*7.0+vec3(0.0,uTime*0.04,0.0)); float cell=1.0-abs(snoise(q*22.0+vec3(uTime*0.05)));" +
    " vec3 col=mix(vec3(0.95,0.28,0.04),vec3(1.0,0.58,0.16),0.5+0.5*g); col*=0.85+0.3*cell;" +
    " float mu=max(dot(normalize(vN),normalize(vV)),0.0); col*=0.35+0.65*pow(mu,0.5); col*=1.05;" +
    " gl_FragColor=vec4(mix(uGround,col,uFade),1.0);\n" + SHADE_TAIL + "}",
});
var surface = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120, Math.PI, Math.PI), surfMat);
sun.add(surface);
// the front half, put back while the Sun is behind the camera on the ride, so from Earth it is whole again
var frontHalf = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120, 0, Math.PI), surfMat);
frontHalf.visible = false; sun.add(frontHalf);

// the cut faces: core, radiative and convective bands, with a thin hot line at each boundary
var faceMat = new THREE.ShaderMaterial({
  uniforms: sunUniforms, side: THREE.DoubleSide,
  vertexShader: "varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
  fragmentShader: GLSL_NOISE + "\nuniform float uTime; uniform float uFade; uniform vec3 uGround; uniform vec3 uDim; varying vec3 vW;\n" +
    "float band(float r,float a,float b){return smoothstep(a-0.012,a+0.012,r)*(1.0-smoothstep(b-0.012,b+0.012,r));}\n" +
    "void main(){ float r=length(vW)/" + R.toFixed(1) + "; vec2 f=vec2(vW.x+vW.z,vW.y); float ang=atan(f.y,f.x);" +
    " vec3 core=mix(vec3(1.0,0.90,0.70)*1.5,vec3(1.0,0.62,0.26)*1.0,smoothstep(0.0,0.25,r));" +
    " float grain=fbm(vec3(f*0.5,1.3))*0.5+0.5; float stri=0.0;" +
    " vec3 rad=mix(vec3(0.72,0.26,0.06),vec3(0.42,0.10,0.025),(r-0.25)/0.45)*(0.8+0.25*grain+0.12*stri);" +
    " float cells=fbm(vec3(f*0.42,uTime*0.12)); float ridge=1.0-abs(snoise(vec3(f*0.6,uTime*0.08+7.0)));" +
    " vec3 conv=mix(vec3(0.52,0.11,0.03),vec3(0.85,0.30,0.07),smoothstep(-0.4,0.5,cells))*(0.8+0.25*ridge*ridge);" +
    " vec3 col=core*band(r,-1.0,0.25)*(1.0-0.35*uDim.x)+rad*band(r,0.25,0.70)*(1.0-0.45*uDim.y)+conv*band(r,0.70,1.01)*(1.0-0.45*uDim.z);" +
    " float lines=exp(-pow((r-0.25)/0.005,2.0))+exp(-pow((r-0.70)/0.005,2.0))+0.7*exp(-pow((r-0.995)/0.006,2.0));" +
    " col+=vec3(1.0,0.78,0.5)*0.55*lines;" +
    " gl_FragColor=vec4(mix(uGround,col,uFade),1.0);\n" + SHADE_TAIL + "}",
});
var face = new THREE.Mesh(new THREE.CircleGeometry(R, 192), faceMat); // the z = 0 cut face
sun.add(face);

var corona = glowSprite(GLOW_SOFT, R * 4.2); corona.material.fog = false; sun.add(corona);
var sunPoint = glowSprite(GLOW_HOT, 1); sunPoint.material.fog = false; sun.add(sunPoint);
var coreGlow = glowSprite(GLOW_HOT, 7); coreGlow.material.fog = false; coreGlow.material.depthTest = false; coreGlow.position.set(0, 0, 0.6); // in the scene, not the Sun group: it blooms before the Sun appears

// the thread: a 2D random walk biased gently outward, then one convection roll up to EXIT
var THREAD = [MC.clone()], WALK_N;
(function walk() {
  var x = 0.18, y = 0.02, z = 0.05, step = 0.16;
  THREAD.push(V(x, y, z));
  for (var i = 0; i < 6000; i++) {
    var a = rng() * Math.PI * 2, r = Math.hypot(x, y), phi = Math.atan2(y, x);
    var dx = Math.cos(a) * step, dy = Math.sin(a) * step;
    var bias = 0.32 * step;
    dx += Math.cos(phi) * bias; dy += Math.sin(phi) * bias;
    if (r > 3) { var pull = (PHI_EXIT - 0.18 - phi) * 0.25 * step; dx += -Math.sin(phi) * pull * r * 0.3; dy += Math.cos(phi) * pull * r * 0.3; }
    x += dx; y += dy;
    THREAD.push(V(x, y, z));
    if (Math.hypot(x, y) >= 6.95) break;
  }
  WALK_N = THREAD.length - 1;
  var pe = THREAD[WALK_N], pr = Math.hypot(pe.x, pe.y), pphi = Math.atan2(pe.y, pe.x);
  var polar = function (rr, ph) { return V(rr * Math.cos(ph), rr * Math.sin(ph), z); };
  var roll = new THREE.CatmullRomCurve3([pe, polar(pr + 0.55, pphi - 0.13), polar(8.4, pphi - 0.02), polar(9.35, PHI_EXIT - 0.05), polar(R, PHI_EXIT)], false, "centripetal");
  for (var k = 1; k <= 70; k++) THREAD.push(roll.getPoint(k / 70));
})();
var TSEG = polySegs(THREAD);
var thread = fatLines(TSEG.segs, { width: 3.0, headLen: 0.05, hot: 1.6, tail: 1.0, color: 0xfff1d8, hotColor: 0xffffff, normal: true });
sun.add(thread);
var head = glowSprite(GLOW_HOT, 1.0), headHalo = glowSprite(GLOW_SOFT, 3.2);
[head, headHalo].forEach(function (s) { s.material.fog = false; sun.add(s); });

// how far along the thread at time t, as a vertex index (fractional)
function threadIndex(t) {
  if (t < T.walkStart) return 1;
  if (t < T.walkEnd) { var u = (t - T.walkStart) / (T.walkEnd - T.walkStart); return 1 + (WALK_N - 1) * (0.25 * sm(u) + 0.75 * u); }
  return WALK_N + (THREAD.length - 1 - WALK_N) * expOut((t - T.walkEnd) / (T.convEnd - T.walkEnd));
}
function threadPoint(t) {
  var fi = threadIndex(t), i = Math.min(Math.floor(fi), THREAD.length - 2);
  return { p: THREAD[i].clone().lerp(THREAD[i + 1], fi - i), s: mix(TSEG.len[i], TSEG.len[i + 1], fi - i) };
}
// share of the 100,000 years spent so far: the walk is the whole of it, convection is a rounding error
function yearsShare(t) { return c01((threadIndex(t) - 1) / (WALK_N - 1)); }

function poseSun(t, camPos) {
  var fade = smr(t, T.sunFade[0], T.sunFade[1]);
  sun.visible = fade > 0;
  sunUniforms.uFade.value = fade; sunUniforms.uTime.value = t;
  // the zone being talked about stays bright, the other two step back
  var hiC = smr(t, 8.0, 8.4) * (1 - smr(t, 9.4, 9.8)), hiR = smr(t, 9.6, 10.0) * (1 - smr(t, 12.9, 13.3)), hiV = smr(t, 13.0, 13.4) * (1 - smr(t, 14.3, 14.7));
  sunUniforms.uDim.value.set((hiR + hiV), (hiC + hiV), (hiC + hiR));
  // the corona sits behind the Sun as seen from the camera, so it never cuts through the face; far away it grows
  // so the Sun still reads as a glowing point beside Earth
  var far = camPos.length();
  corona.position.copy(camPos).normalize().multiplyScalar(-R * 1.2);
  corona.scale.setScalar(R * 4.2 * Math.max(1, far / 140));
  corona.material.opacity = fade * 0.85;
  frontHalf.visible = t > 18.0; face.visible = t <= 18.0;
  // from far away the Sun is one hot point: the same spark the film opened on
  sunPoint.position.copy(camPos).normalize().multiplyScalar(R * 1.15);
  sunPoint.scale.setScalar(far * 0.075); sunPoint.material.opacity = c01((far - 160) / 220); coreGlow.material.opacity = smr(t, 6.2, 8.0) * (0.9 - 0.5 * smr(t, 9.0, 11.0)) * (1 - smr(t, T.breakout, T.breakout + 1.0)); // the core blooms round the shrinking tangle
  var tp = threadPoint(t), on = t >= T.walkStart - 0.4;
  thread.visible = on;
  thread.material.uniforms.uHead.value = tp.s;
  thread.material.uniforms.uOpacity.value = smr(t, T.walkStart - 0.4, T.walkStart) * mix(1, 0.4, smr(t, T.breakout, T.breakout + 0.6));
  var rest = t > T.convEnd && t < T.breakout ? 0.5 + 0.5 * Math.cos((t - T.convEnd) * Math.PI * 2 / 0.8) : 1; // the pulse during the rest
  head.visible = headHalo.visible = on && t < T.breakout + 0.05;
  head.position.copy(tp.p); headHalo.position.copy(tp.p);
  head.material.opacity = smr(t, T.walkStart - 0.4, T.walkStart); headHalo.material.opacity = 0.9 * head.material.opacity;
  head.scale.setScalar(1.0 * mix(0.8, 1.25, rest)); headHalo.scale.setScalar(3.2 * mix(0.85, 1.3, rest));
}
