// ---- the renderer, the scene and the frame: everything drawn from t alone
var cv = document.getElementById("c");
var renderer = K.renderer(cv, W, H);

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
}

// the 3D picture, with the motion blur and the rest check told how far it moves; the type is held to the frame grid
// so blur samples of one frame show the same words and digits
tl.frame(draw, { motion: K.motionOf(camAt) });
var labelCam = new THREE.PerspectiveCamera(40, W / H, 0.001, 8000);
tl.frame(function (t) { placeCamera(labelCam, t); poseOverlay(t, labelCam); }, { hold: true });

// the subject the shot check keeps in frame: the photon, then the thread's head, the beam's head, and Earth
function subjectAt(t) {
  if (t < T.walkStart) return photonLocal(t).multiplyScalar(MICRO_SCALE).add(MC);
  if (t < T.breakout) return threadPoint(t).p;
  if (t < T.landing) return beamPoint(t);
  return PE;
}
tl.subject("the photon", K.subjectOf(camAt, subjectAt, { w: W, h: H }), { to: T.landing });
tl.subject("Earth", K.subjectOf(camAt, function () { return PE; }, { w: W, h: H, radius: RE }), { from: T.landing, minPx: 40 });
tl.rest(T.convEnd, T.restEnd);

// beats and sound moments
tl.label("hook", 0.32).label("prisoner", T.hook2In).label("zoom", T.zoomStart).label("core", T.coreLabel[0]).label("walk", T.walkStart)
  .label("convection", T.walkEnd).label("rest", T.convEnd).label("breakout", T.breakout).label("ride", T.rideStart)
  .label("approach", T.approach).label("landing", T.landing).label("tick", T.barTick).label("lockup", T.title);
COLL.slice(0, 6).forEach(function (c, i) { tl.hit("collide" + i, c, { kind: "click", pan: (i % 2 ? 0.25 : -0.25) }); });
tl.hit("zoom", T.zoomStart, { kind: "whoosh" }).hit("breakout", T.breakout, { kind: "impact" }).hit("ride", 15.2, { kind: "whoosh" })
  .hit("landing", T.landing, { kind: "impact" }).hit("tick", T.barTick, { kind: "click" }).hit("lockup", T.title, { kind: "land" });
