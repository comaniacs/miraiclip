// ---- camera, type and the frame. Keys: [t, yaw, elev, dist, tx, ty, ox, oy] through the kit's monotone curves.
var CAM = filmCamera([
  [0.0, 10, 6, 700, 0, -600, 0, 0], //       tracking the falling page
  [3.4, 20, 10, 1150, 0, -160, 0, 0],
  [6.4, 40, 14, 1750, 0, -40, 0, 0], //      wide on the swirl as it closes in
  [8.6, 8, 4, 1450, 0, 0, 330, 0], //        the device, right; the name, left
  [10.4, 0, 0, 760, 0, -40, 330, 0], //      macro on the screen
  [14.0, -8, 2, 700, 20, 30, 330, 0],
  [15.6, 0, 4, 1250, 0, 0, 0, 0], //         pull back as the page turns
  [18.6, 100, 16, 1750, 0, 0, 0, 0], //      orbit inside the ring of pages
  [21.2, 170, 22, 1850, 0, 0, 0, 0],
  [23.6, 196, 8, 1300, 0, 0, 0, 0], //       the dive back into the screen; the flash
  [25.6, 206, 8, 1500, 0, -10, 330, 0], //   hero: device right, lockup left
  [28.6, 210, 8, 1480, 0, -10, 330, 0],
  [30.0, 210, 8, 1480, 0, -10, 330, 0],
], [[0, 0, 0], [150, -210, 0], [-150, 210, 0], [0, 0, 300]]);
var camAt = CAM.camAt;
// the device keeps its screen to the camera (turning a little in the introduction) so the page is always readable
function spinAt(t, c) { return -c.yaw - 22 * Math.sin(Math.PI * c01((t - 7) / 2.6)) + 12; }

function paint(t) {
  var c = camAt(t), spin = spinAt(t, c);
  $("view").style.transform = "translate(" + f2(c.ox) + "px," + f2(c.oy) + "px)";
  world.style.transform = $("ground").style.transform = camTransform(c);
  poseDevice(t, c, spin);
  posePages(t, c, spin);
  $("pool").style.opacity = smr(t, 5.5, 7.5).toFixed(3);
}
function poseType(t) {
  lineIO("h1", T.hook, t);
  lineIO("h2", T.intro, t); lineIO("h3", T.word, t);
  lineIO("d1", T.disc1, t); lineIO("d2", T.disc2, t);
  lineIO("e1", T.exp, t); lineIO("e2", [T.exp[0] + 0.2, T.exp[1] + 0.05], t);
  var u = smoother((t - T.title) / 0.9);
  $("lock").style.opacity = u.toFixed(3); $("lock").style.letterSpacing = mix(0.5, 0.2, u).toFixed(3) + "em";
  lineIO("tag", [T.tag, 99], t);
  fadeIO("cta", T.cta, 99, t, 10);
}
tl.frame(paint, { motion: CAM.motionOf });
tl.frame(poseType, { hold: true });
tl.subject("the page / the device", function (t) {
  var c = camAt(t), p = t < 3.4 ? fallPose(t).p : [0, 0, 0], s = project(p, c);
  return { x: s.x, y: s.y, r: 150 * s.k };
}, { minPx: 30 });
tl.rest(T.rest[0], T.rest[1]);
tl.label("fall", 0.2).label("swirl", T.swirl[0]).label("stack", T.stack[0]).label("macro", T.macro[0]).label("warm", T.warm[0])
  .label("turn", T.turn[0]).label("ring", T.ring[0]).label("dive", T.dive[0]).label("flash", T.flash).label("lockup", T.title);
tl.hit("stack", T.stack[1], { kind: "impact" }).hit("flash", T.flash, { kind: "impact" }).hit("lockup", T.title, { kind: "land" });
