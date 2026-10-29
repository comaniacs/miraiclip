// ---- the renderer, the scene and the frame: everything drawn from t alone
var renderer = K.renderer(document.getElementById("c"), W, H, { exposure: 1.05 });
var scene = new THREE.Scene();
scene.background = GROUND;
var pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture; // reflections for the foil and glass
scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x0a0c14, 0.16));
var key = new THREE.DirectionalLight(0xdfe8ff, 1.6); key.position.copy(earthU.uKey.value).multiplyScalar(100); scene.add(key);
var moon = new THREE.DirectionalLight(0x9fb8ff, 0.65); moon.position.copy(N).add(E.clone().multiplyScalar(0.6)).multiplyScalar(50); scene.add(moon);
scene.add(earth); scene.add(atmo); scene.add(city); scene.add(satGroup);
THREADS.forEach(function (l) { scene.add(l); });
PACKETS.forEach(function (p) { scene.add(p); });
SPHERES.forEach(function (m) { scene.add(m); });
scene.add(circle); scene.add(youPoint); scene.add(ghostPoint);

var cam = new THREE.PerspectiveCamera(40, W / H, 0.001, 3000);
var LINES = [streets, avenues, circle].concat(THREADS);
function draw(t) {
  placeCamera(cam, t);
  poseCity(t); poseEarth(t, cam.position); poseSats(t); posePackets(t); poseSpheres(t);
  LINES.forEach(function (l) { l.userData.update(cam); });
  renderer.render(scene, cam);
}
tl.frame(draw, { motion: K.motionOf(camAt) });
var labelCam = new THREE.PerspectiveCamera(40, W / H, 0.001, 3000);
tl.frame(function (t) { placeCamera(labelCam, t); poseOverlay(t, labelCam); }, { hold: true });

// what the shot check keeps in frame: you at both ends, satellite 1 while it speaks, then the meeting point
tl.subject("you (the blue dot)", K.subjectOf(camAt, function (t) { return t < 5 || t > 25.8 ? P : null; }, { w: W, h: H, radius: 0.6 * CITY_SCALE }), { minPx: 6 });
tl.subject("you, on the way up", K.subjectOf(camAt, function (t) { return t >= 5 && t < 9.6 ? P : null; }, { w: W, h: H }));
tl.subject("satellite 1", K.subjectOf(camAt, function (t) { return t > 9.6 && t < 15 ? SATS[0] : null; }, { w: W, h: H, radius: 2 }), { minPx: 8 });
tl.subject("the meeting point", K.subjectOf(camAt, function (t) { return t >= 15 && t <= 25.8 ? P : null; }, { w: W, h: H }));
tl.rest(T.restFrom, T.restTo);

tl.label("hook", 0.4).label("listens", T.hook2In).label("rise", T.zoomStart).label("orbit", 7.4).label("delay", T.focus)
  .label("sphere", T.sphere1[0]).label("circle", T.sphere2[0]).label("points", T.sphere3[0]).label("rest", T.restFrom)
  .label("dive", T.dive[0]).label("home", 25.0).label("lockup", T.title);
T.pulseLands.forEach(function (x, i) { tl.hit("pulse" + i, x, { kind: "click", pan: (i % 3 - 1) * 0.3 }); });
tl.hit("rise", T.zoomStart, { kind: "whoosh" }).hit("received", T.packet[1], { kind: "click" }).hit("sphere1", T.sphere1[1], { kind: "land" })
  .hit("circle", T.circle[1], { kind: "click" }).hit("points", T.points, { kind: "impact" }).hit("dive", T.dive[0], { kind: "whoosh" }).hit("home", 25.6, { kind: "land" });
