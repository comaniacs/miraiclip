// ---- the renderer, the scene and the frame: everything drawn from t alone
var cv = document.getElementById("c");
var renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

var scene = new THREE.Scene();
scene.background = GROUND;
scene.fog = new THREE.Fog(GROUND, 1, 2);
scene.add(new THREE.AmbientLight(0xffb070, 0.05));
var fill = new THREE.DirectionalLight(0xff9a50, 0.35); fill.position.set(-1, 2, 1); scene.add(fill); // a warm top light to shape the plasma
scene.add(stars); scene.add(sun); scene.add(coreGlow); scene.add(micro);
scene.add(beam); scene.add(beamHead); scene.add(beamHalo); scene.add(burst); scene.add(dust);
scene.add(earth); scene.add(atmo); scene.add(earthGlow);

var cam = new THREE.PerspectiveCamera(40, W / H, 0.001, 8000);
var LINES = [trail, thread, beam, dust];

function draw(t) {
  var c = placeCamera(cam, t);
  var dt = 1 / 60, speed = camAt(t + dt).p.distanceTo(camAt(Math.max(0, t - dt)).p) / (2 * dt);
  // depth haze only in the core, where the plasma should fall away into the dark
  var D = c.p.distanceTo(MC);
  if (t < 8.6) { scene.fog.near = D * 0.9; scene.fog.far = D * 3.4; } else { scene.fog.near = 1e7; scene.fog.far = 2e7; }
  poseMicro(t, D); poseSun(t, c.p); poseSpace(t, speed); poseEarth(t, c.p);
  LINES.forEach(function (l) { l.material.uniforms.uNear.value = cam.near; });
  renderer.render(scene, cam);
  poseOverlay(t, cam);
}

// how far the picture moves between two instants, for the exporter's motion blur: probe points around what the
// camera looks at, seen from both poses
var probe = new THREE.PerspectiveCamera(40, W / H, 0.001, 8000), pv = V(0, 0, 0);
function motion(from, to) {
  var a = camAt(from), d = a.p.distanceTo(a.q), f = a.q.clone().sub(a.p).normalize();
  var side = f.clone().cross(YUP).normalize(), up = side.clone().cross(f);
  var pts = [V(0, 0, 0), side.clone().multiplyScalar(d * 0.4), up.clone().multiplyScalar(d * 0.3), f.clone().multiplyScalar(-d * 0.5)].map(function (o) { return a.q.clone().add(o); });
  placeCamera(probe, from); var A = pts.map(function (p) { return pv.copy(p).project(probe).clone(); });
  placeCamera(probe, to);
  var far = 0;
  pts.forEach(function (p, i) { var b = pv.copy(p).project(probe); far = Math.max(far, Math.hypot((b.x - A[i].x) * W / 2, (b.y - A[i].y) * H / 2)); });
  return far;
}
tl.frame(draw, { motion: motion });

// beats and sound moments
tl.label("hook", 0.32).label("prisoner", T.hook2In).label("zoom", T.zoomStart).label("core", T.coreLabel[0]).label("walk", T.walkStart)
  .label("convection", T.walkEnd).label("rest", T.convEnd).label("breakout", T.breakout).label("ride", T.rideStart)
  .label("approach", T.approach).label("landing", T.landing).label("tick", T.barTick).label("lockup", T.title);
COLL.slice(0, 6).forEach(function (c, i) { tl.hit("collide" + i, c, { kind: "click", pan: (i % 2 ? 0.25 : -0.25) }); });
tl.hit("zoom", T.zoomStart, { kind: "whoosh" }).hit("breakout", T.breakout, { kind: "impact" }).hit("ride", 15.2, { kind: "whoosh" })
  .hit("landing", T.landing, { kind: "impact" }).hit("tick", T.barTick, { kind: "click" }).hit("lockup", T.title, { kind: "land" });
