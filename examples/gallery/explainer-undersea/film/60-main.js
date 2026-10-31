// ---- the frame: one painter, the subject, the rest and the beats.
function paint(t) { poseWorld(t); poseNimbus(t); poseSky(t); poseSplash(t); poseCloseup(t); poseBreak(t); poseGlobe(t); poseType(t); }
tl.frame(paint, { hold: true });
tl.subject("Nimbus / the Earth", function (t) {
  if (t >= T.globe[0] + 0.5 && t < T.globe[1] - 0.3) return { x: 960, y: 550, r: 300 };
  var n = nimbusAt(t); return { x: n.x, y: n.y, r: 140 * n.s };
}, { minPx: 30 });
tl.rest(T.rest[0], T.rest[1]);
tl.label("hook", 0).label("question", T.q2[0]).label("sky", T.s1[0]).label("nope", T.nope).label("mask", T.mask).label("splash", T.splash)
  .label("down", T.d1[0]).label("seabed", T.seabed).label("cables", T.c2[0]).label("hose", T.xs[0]).label("globe", T.globe[0]).label("wraps", T.wraps[0])
  .label("break", T.brk[0]).label("shark", T.shark[0]).label("anchor", T.anchor).label("outro", T.outro[0]).label("fish", T.o3);
tl.hit("nope", T.nope, { kind: "impact" }).hit("splash", T.splash, { kind: "impact" }).hit("hit", T.hit, { kind: "impact" }).hit("underwater", T.o2, { kind: "land" });
