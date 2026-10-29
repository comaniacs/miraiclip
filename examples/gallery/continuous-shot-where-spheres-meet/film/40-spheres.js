// ---- 3–4 · the distance spheres: each grows out of its satellite until it passes exactly through you. Two meet
// in a circle (drawn from you around); three meet in two points, and the one out in space fades.
var sphereMat = function (col) {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: col }, uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    vertexShader: "varying vec3 vN; varying vec3 vW; varying vec3 vO; void main(){ vO=normalize(position); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }",
    fragmentShader: "uniform vec3 uCol; uniform float uA; varying vec3 vN; varying vec3 vW; varying vec3 vO;\n" +
      "void main(){ float fr=pow(1.0-abs(dot(normalize(vN),normalize(cameraPosition-vW))),2.2);" +
      " float lat=asin(clamp(vO.y,-1.0,1.0)), lon=atan(vO.z,vO.x);" +
      " float gl=smoothstep(0.93,0.985,abs(fract(lat*5.73)-0.5)*2.0);" + // a line every 10° of latitude
      " float gn=smoothstep(0.93,0.985,abs(fract(lon*2.865)-0.5)*2.0);" + // and every 20° of longitude
      " float grid=max(gl,gn)*0.35;" +
      " gl_FragColor=vec4(uCol*(fr*0.9+grid*(0.25+fr))*uA,1.0); }",
  });
};
var sphereGeo = new THREE.SphereGeometry(1, 128, 80);
var SPHERES = SATS.map(function (s, i) { var m = new THREE.Mesh(sphereGeo, sphereMat(COLORS[i])); m.position.copy(s); m.visible = false; return m; });
var GROW = [T.sphere1, T.sphere2, T.sphere3];

// the circle where spheres 1 and 2 meet: it starts at you and draws round
var circlePts = []; for (var ci = 0; ci <= 200; ci++) circlePts.push(circlePoint(ci / 200 * Math.PI * 2));
var circle = fatLines(K.polySegs(circlePts).segs, { width: 3.2, headLen: 0.06, hot: 2.4, tail: 1.1, color: 0xe8f4ff, hotColor: 0xffffff });
var youPoint = K.glowSprite(K.GLOW.hot, 3.2), ghostPoint = K.glowSprite(K.GLOW.hot, 3.2);
[youPoint, ghostPoint].forEach(function (p) { p.material.color.set(0xcfe6ff); p.visible = false; });
youPoint.position.copy(P); ghostPoint.position.copy(GHOST);

function poseSpheres(t) {
  var out = 1 - smr(t, 21.6, 23.4); // the dive leaves them behind
  SPHERES.forEach(function (m, i) {
    var g = smoother((t - GROW[i][0]) / (GROW[i][1] - GROW[i][0]));
    m.visible = g > 0.001 && out > 0.001;
    m.scale.setScalar(Math.max(0.01, RADII[i] * g));
    // a sphere is brightest as it forms, then steps back so the next one and the intersections read
    var a = 0.55 * g * out * (1 - 0.45 * smr(t, GROW[i][1] + 0.6, GROW[i][1] + 1.6));
    if (i === 0) a *= 1 - 0.3 * smr(t, T.circle[0], T.circle[1]);
    m.material.uniforms.uA.value = a;
  });
  var cOn = t >= T.circle[0];
  circle.visible = cOn && out > 0.001;
  circle.material.uniforms.uHead.value = smoother((t - T.circle[0]) / (T.circle[1] - T.circle[0]));
  circle.material.uniforms.uOpacity.value = out * (1 - 0.5 * smr(t, T.sphere3[1], T.sphere3[1] + 0.6));
  var pOn = smr(t, T.points, T.points + 0.25);
  var flash = t > T.points ? 1 + 1.5 * Math.exp(-(t - T.points) * 5) : 1;
  youPoint.visible = ghostPoint.visible = pOn > 0.001 && out > 0.001;
  youPoint.material.opacity = pOn * out; youPoint.scale.setScalar(3.2 * flash);
  ghostPoint.material.opacity = pOn * out * (1 - 0.8 * smr(t, T.ghost, T.ghost + 0.6)); ghostPoint.scale.setScalar(3.2 * flash);
}
