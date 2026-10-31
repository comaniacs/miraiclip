// ---- the frame
function paint(t) {
  var c = camAt(t);
  $("view").style.transform = "translate(" + f2(c.ox) + "px," + f2(c.oy) + "px)";
  world.style.transform = $("ground").style.transform = camTransform(c);
  poseCan(t, c, spinAt(t, c));
  poseBubbles(t, c); poseCitrus(t); poseWave(t, c);
  $("floorglow").style.opacity = keyAmt(t).toFixed(3);
}
tl.frame(paint, { motion: CAM.motionOf });
tl.frame(poseType, { hold: true });
tl.subject("the can", function (t) {
  var c = camAt(t), p = t < T.pop ? heroAt(t) : [0, -230, 0], s = project(p, c);
  return { x: s.x, y: s.y, r: (t < T.pop ? 46 : 150) * s.k };
}, { minPx: 20 });
tl.rest(T.rest[0], T.rest[1]);
tl.label("rise", 0.2).label("pop", T.pop).label("intro", T.intro[0]).label("peel", T.peel[0]).label("facts", T.facts[0]).label("wrap", T.wrap[0])
  .label("citrus", T.citrus[0]).label("burst", T.burst[0]).label("wave", T.wave[0]).label("lockup", T.title);
tl.hit("pop", T.pop, { kind: "impact" }).hit("burst", T.burst[0], { kind: "impact" }).hit("lockup", T.title, { kind: "land" });
