// ---- camera, type and the frame. Keys: [t, yaw, elev, dist, tx, ty, ox, oy] through the kit's monotone curves,
// which keep velocity continuous across every key: the camera never stops between beats, it flows.
var CAM = filmCamera([
  [0.0, 0, 30, 900, -300, -380, 0, 0], //      with the falling drop
  [1.5, 4, 52, 950, -300, 0, 0, 0], //         at the landing, looking down onto the paper
  [4.4, 14, 62, 1500, -120, 0, 0, 0], //       rising over the bloom
  [7.4, 26, 24, 1350, 220, -150, 300, 30], //  gliding to the bottle as it rises; name on the left
  [9.4, 16, 30, 1300, 120, -100, 300, 30],
  [11.6, -6, 58, 1200, -180, 0, 0, 0], //      drifting over the page as it writes
  [14.4, -18, 54, 1300, -60, 0, 0, 0],
  [17.2, -52, 36, 1550, 220, -80, 0, 0], //    circling with the ribbons
  [20.6, -112, 30, 1500, 250, -80, 0, 0],
  [23.2, -160, 18, 1150, 250, -150, 0, 0], //  rising round to the bottle as it fills
  [25.6, -190, 14, 1300, 250, -150, 330, 10], // hero: bottle right, lockup left
  [28.6, -194, 13, 1290, 250, -150, 330, 10],
  [30.0, -194, 13, 1290, 250, -150, 330, 10],
], [[0, 0, 0], [250, -150, -50], [-300, 0, 100], [600, 0, 400]]);
var camAt = CAM.camAt;
function spinAt(t, c) { return -c.yaw - 24; } // the label faces the camera at a flattering three-quarter angle

function paint(t) {
  var c = camAt(t);
  $("view").style.transform = "translate(" + f2(c.ox) + "px," + f2(c.oy) + "px)";
  world.style.transform = $("ground").style.transform = camTransform(c);
  poseInk(t); poseDrop(t, c); poseBottle(t, c, spinAt(t, c));
}
function poseType(t) {
  lineIO("i1", T.intro, t); lineIO("i2", [T.intro[0] + 0.2, T.intro[1] + 0.05], t); lineIO("i3", T.word, t);
  lineIO("d1", [T.disc[0], 12.2], t); lineIO("d2", [12.4, T.disc[1]], t);
  lineIO("e1", T.exp, t); lineIO("e2", [T.exp[0] + 0.2, T.exp[1] + 0.05], t);
  var u = smoother((t - T.title) / 0.9);
  $("lock").style.opacity = u.toFixed(3); $("lock").style.letterSpacing = mix(0.45, 0.16, u).toFixed(3) + "em";
  lineIO("tag", [T.tag, 99], t);
  fadeIO("cta", T.cta, 99, t, 10);
}
tl.frame(paint, { motion: CAM.motionOf });
tl.frame(poseType, { hold: true });
tl.subject("the ink / the bottle", function (t) {
  var c = camAt(t), p = t < 6.6 ? toWorld(D[0], D[1], t < T.hit ? mix(-760, 0, c01(t / T.hit)) : 0) : [bw[0], -140, bw[2]], s = project(p, c);
  return { x: s.x, y: s.y, r: 120 * s.k };
}, { minPx: 20 });
tl.rest(T.rest[0], T.rest[1]);
tl.label("drop", 0.2).label("hit", T.hit).label("vortex", T.vortex[0]).label("rise", T.rise[0]).label("write", T.write[0])
  .label("ribbons", T.ribbons[0]).label("pour", T.pour[0]).label("fill", T.fill[0]).label("lockup", T.title);
tl.hit("hit", T.hit, { kind: "impact" }).hit("rise", T.rise[1], { kind: "land" }).hit("fill", T.fill[1], { kind: "impact" });
