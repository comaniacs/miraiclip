// ---- 2 · night Earth: dark land and sea, warm city lights (brightest where you are), a thin blue rim.
// Where the city map lies on it, Earth is pushed back in depth so the map always draws on top.
var earthU = { uFade: { value: 0 }, uP: { value: N.clone() }, uKey: { value: V(-0.6, 0.5, -0.62).normalize() } };
var earthMat = new THREE.ShaderMaterial({
  uniforms: earthU,
  vertexShader: "varying vec3 vO; varying vec3 vN; varying vec3 vW; void main(){ vO=normalize(position); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }",
  fragmentShader: K.NOISE_GLSL + "\nuniform float uFade; uniform vec3 uP; uniform vec3 uKey; varying vec3 vO; varying vec3 vN; varying vec3 vW;\n" +
    "void main(){" +
    " float h=fbm(vO*1.8+vec3(2.0,0.3,1.1)); float land=smoothstep(0.04,0.09,h);" +
    " vec3 col=mix(vec3(0.006,0.012,0.03),vec3(0.018,0.022,0.03),land);" +
    " float lights=smoothstep(0.55,0.8,fbm(vO*38.0)*0.5+0.5)*land; float cities=smoothstep(0.1,0.5,fbm(vO*6.0+4.0))*land;" +
    " float home=exp(-pow(distance(vO,uP)/0.0012,2.0));" +
    " col+=vec3(1.0,0.66,0.32)*(lights*cities*0.6+home*0.12+exp(-pow(distance(vO,uP)/0.05,2.0))*lights*0.5);" +
    " vec3 n=normalize(vN), v=normalize(cameraPosition-vW); float fr=pow(1.0-max(dot(n,v),0.0),3.0);" +
    " col+=vec3(0.02,0.04,0.08)*max(dot(n,uKey),0.0)+vec3(0.25,0.5,1.0)*fr*0.35;" +
    " gl_FragColor=vec4(col*uFade,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
});
// pushed back in depth, so the city's ground, streets and blocks, lying on the same surface, always win
earthMat.polygonOffset = true; earthMat.polygonOffsetFactor = 4; earthMat.polygonOffsetUnits = 8;
var earth = new THREE.Mesh(new THREE.SphereGeometry(RE, 160, 120), earthMat);
var atmoU = { uFade: { value: 0 } };
var atmo = new THREE.Mesh(new THREE.SphereGeometry(RE * 1.035, 128, 96), new THREE.ShaderMaterial({
  uniforms: atmoU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  vertexShader: "varying vec3 vN; varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }",
  fragmentShader: "uniform float uFade; varying vec3 vN; varying vec3 vW; void main(){ vec3 n=normalize(vN), v=normalize(cameraPosition-vW); float fr=pow(1.0-max(dot(n,v),0.0),4.0); gl_FragColor=vec4(vec3(0.25,0.55,1.0)*fr*0.9*uFade,1.0); }",
}));

function poseEarth(t, camPos) {
  var f = Math.max(smr(t, T.earthFade[0], T.earthFade[1]), 0) * (1 - smr(t, 24.4, 25.6));
  earth.visible = atmo.visible = f > 0.001;
  earthU.uFade.value = f;
  // the rim is only seen from outside its shell: it grows in as the camera climbs past it, so crossing it never pops
  atmoU.uFade.value = f * smr(camPos.length(), RE * 1.035, RE * 1.2);
}
