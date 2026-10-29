// ---- 5 · Earth: procedural oceans, land and clouds lit only by the Sun, a fresnel atmosphere, and the ring of light
// that spreads from where the beam lands
var SUN_L = DIR.clone().negate(); // direction from Earth to the Sun
var earthU = {
  uL: { value: SUN_L }, uTime: { value: 0 }, uHit: { value: LAND.clone().sub(PE).normalize() }, uRing: { value: -1 }, uCenter: { value: PE },
};
var earthMat = new THREE.ShaderMaterial({
  uniforms: earthU,
  vertexShader: "varying vec3 vN; varying vec3 vO; varying vec3 vW; void main(){ vO=normalize(position); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }",
  fragmentShader: GLSL_NOISE + "\nuniform vec3 uL; uniform float uTime; uniform vec3 uHit; uniform float uRing; varying vec3 vN; varying vec3 vO; varying vec3 vW;\n" +
    "void main(){ vec3 n=normalize(vN); float a=uTime*0.03; mat2 rot=mat2(cos(a),-sin(a),sin(a),cos(a)); vec3 o=vO; o.xz=rot*o.xz;" +
    " float h=fbm(o*1.7+vec3(3.1,1.7,0.4)); float land=smoothstep(0.06,0.10,h); float coast=smoothstep(-0.06,0.06,h)*(1.0-land);" +
    " vec3 ocean=mix(vec3(0.008,0.035,0.11),vec3(0.02,0.10,0.24),coast*0.8+0.2);" +
    " float veg=fbm(o*4.0+7.0)*0.5+0.5; vec3 ground=mix(vec3(0.30,0.24,0.13),vec3(0.07,0.15,0.05),smoothstep(0.35,0.7,veg));" +
    " float ice=smoothstep(0.80,0.88,abs(o.y)+0.05*fbm(o*6.0)); ground=mix(ground,vec3(0.85,0.88,0.9),ice); ocean=mix(ocean,vec3(0.8,0.85,0.9),ice);" +
    " vec3 base=mix(ocean,ground,land);" +
    " vec3 oc=o; oc.xz=mat2(cos(a*0.6),-sin(a*0.6),sin(a*0.6),cos(a*0.6))*vO.xz; float cl=smoothstep(0.12,0.5,fbm(oc*2.2+vec3(1.0,uTime*0.01,5.0))*0.5+0.5-0.36);" +
    " base=mix(base,vec3(0.9,0.92,0.95),cl*0.7);" +
    " float ndl=dot(n,uL); float day=smoothstep(-0.06,0.22,ndl); float lam=max(ndl,0.0);" +
    " vec3 v=normalize(cameraPosition-vW); vec3 hv=normalize(uL+v); float spec=pow(max(dot(n,hv),0.0),60.0)*(1.0-land)*(1.0-cl)*0.9;" +
    " vec3 col=base*(0.05+1.35*lam)*day+vec3(1.0,0.9,0.75)*spec*day;" +
    " col+=vec3(0.002,0.004,0.01)*(1.0-day);" +
    " float dh=acos(clamp(dot(normalize(vO),uHit),-1.0,1.0)); float ring=uRing<0.0?0.0:exp(-pow((dh-uRing)/0.035,2.0))*exp(-uRing*2.2)*2.5+exp(-dh*dh/0.004)*exp(-uRing*3.0)*3.0*step(0.0,uRing);" +
    " col+=vec3(1.0,0.82,0.55)*ring;" +
    " gl_FragColor=vec4(col,1.0);\n" + SHADE_TAIL + "}",
});
var earth = new THREE.Mesh(new THREE.SphereGeometry(RE, 160, 120), earthMat);
earth.position.copy(PE);
var atmoMat = new THREE.ShaderMaterial({
  uniforms: earthU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false,
  vertexShader: "varying vec3 vN; varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }",
  fragmentShader: "uniform vec3 uL; varying vec3 vN; varying vec3 vW;\n" +
    "void main(){ vec3 n=normalize(vN); vec3 v=normalize(cameraPosition-vW); float fr=pow(1.0-max(dot(n,v),0.0),2.6);" +
    " float lit=smoothstep(-0.35,0.45,dot(n,uL)); float fwd=pow(max(dot(-v,uL),0.0),5.0);" +
    " vec3 col=vec3(0.28,0.55,1.0)*fr*(0.06+1.25*lit)+vec3(1.0,0.72,0.45)*pow(fr,1.6)*fwd*1.6;" +
    " gl_FragColor=vec4(col,1.0); }",
});
var atmo = new THREE.Mesh(new THREE.SphereGeometry(RE * 1.05, 128, 96), atmoMat);
atmo.position.copy(PE);
var earthGlow = glowSprite(GLOW_BLUE, RE * 9); earthGlow.position.copy(PE); earthGlow.material.fog = false;

function poseEarth(t, camPos) {
  var far = camPos.distanceTo(PE);
  var on = t > 16.0;
  earth.visible = atmo.visible = earthGlow.visible = on;
  earthU.uTime.value = t;
  earthU.uRing.value = t < T.landing ? -1 : (t - T.landing) * 0.55;
  earthGlow.material.opacity = c01((far - 25) / 120) * 0.9; // a blue point from far away, gone up close
}
