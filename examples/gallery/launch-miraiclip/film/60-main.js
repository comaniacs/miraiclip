// ---- camera, type and the frame. Keys: [t, yaw, elev, dist, tx, ty, ox, oy] through the kit's monotone curves.
var CAM = filmCamera([
  [0.0, 0, 0, 1400, 0, 0, 0, 0], //          flat and 1:1 while the hook words become clips
  [3.4, 0, 0, 1400, 0, 0, 0, 0],
  [4.8, -18, 36, 2050, 0, 0, 260, 150], //   tilt into 3D as the timeline fills
  [8.2, -8, 30, 2150, 0, 0, 240, 150],
  [9.4, -28, 24, 1500, 300, 0, 380, 140], // close on the right half, where the commands land
  [13.0, -20, 22, 1450, 330, 0, 380, 140],
  [14.4, 0, 60, 2400, 0, 0, 0, 440], //      the timeline becomes a floor under the monitor
  [18.4, 8, 58, 2350, 0, 0, 0, 440],
  [19.6, 22, 28, 1600, -200, 0, 380, 140], // the intro, where the agent trims
  [23.4, 16, 26, 1650, -150, 0, 380, 140],
  [24.6, 0, 14, 2400, 0, 0, -120, 200], //   wide: the playhead runs the whole cut
  [26.3, 0, 12, 2700, 0, 0, -120, 200],
  [30.0, 0, 12, 2700, 0, 0, -120, 200],
], [[-780, -290, 0], [780, -290, 0], [-780, 266, 0], [780, 266, 0]]);
var camAt = CAM.camAt;

function paint(t) {
  var c = camAt(t);
  $("view").style.transform = "translate(" + f2(c.ox) + "px," + f2(c.oy) + "px)";
  poseWorld(t, c);
  poseBg(t);
}
function poseType(t) {
  var flash = poseHook(t);
  lineIO("b1", T.b1, t); lineIO("b2", T.b2, t); fadeIO("proof", T.proof[0], T.proof[1], t, 16);
  lineIO("c1", T.c1, t); poseCode(t);
  poseFx(t);
  lineIO("a1", T.a1, t); poseAi(t);
  lineIO("e1", T.e1, t); poseExport(t);
  poseEnd(t); poseHud(t);
  var f = T.flash, end = t < f - 0.12 ? 0 : t < f ? 0.9 * smr(t, f - 0.12, f) : 0.9 * Math.exp(-(t - f) * 7);
  $("flash").style.opacity = Math.max(flash, end).toFixed(3);
}
tl.frame(paint, { motion: CAM.motionOf });
tl.frame(poseType, { hold: true });
tl.subject("the timeline / the mark", function (t) {
  if (t < 2.4) return { x: W / 2, y: H / 2, r: 360 };
  if (t >= T.flash) return { x: W / 2, y: 285, r: 95 };
  var c = camAt(t), s = project([0, 0, 0], c);
  return { x: s.x, y: s.y, r: 600 * s.k };
}, { minPx: 30 });
tl.rest(T.rest[0], T.rest[1]);
tl.label("hook", 0).label("morph", T.morph[0]).label("build", T.build[0]).label("commands", T.cmd[0]).label("undo", T.lines[3])
  .label("effects", T.fx[0]).label("agent", T.ai[0]).label("export", T.exp[0]).label("flash", T.flash).label("lockup", T.logo);
T.slams.forEach(function (s, k) { tl.hit("word" + k, s, { kind: "impact" }); });
tl.hit("command", T.cmdAt[0], { kind: "impact" }).hit("flash", T.flash, { kind: "impact" }).hit("url", T.url, { kind: "land" });
