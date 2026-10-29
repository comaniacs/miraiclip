// ---- the frame: the camera, the dial, the world and the type, all from t alone
function paint(t) {
  var c = camAt(t);
  $("view").style.transform = "translate(" + f2(c.ox) + "px," + f2(c.oy) + "px)";
  world.style.transform = ground.style.transform = camTransform(c);
  var L = poseDial(t, c);
  poseWorld(t, c, L);
  poseCards(t, c);
}
// the 3D picture, with motion blur and the rest told how far it moves; the type is held to the frame grid so blur
// samples of one frame show the same words and digits
tl.frame(paint, { motion: motionOf });
tl.frame(function (t) { poseOverlay(t, camAt(t)); }, { hold: true });

// the subject the shot check keeps in frame: the dial (its centre and on-screen radius)
tl.subject("the dial", function (t) {
  var c = camAt(t), s = project([0, -60 - 60 * explodeAmt(t), 0], c);
  return { x: s.x, y: s.y, r: 205 * s.k };
}, { minPx: 60 });
tl.rest(28.7, T.DUR);

// beats and sound moments
tl.label("hook", T.drawStart).label("ring", T.ringFull).label("reveal", T.revealIn).label("macro", T.macro[0])
  .label("explode", T.explode[0]).label("assemble", T.assemble[0]).label("turn", T.turnIn).label("keep", T.keepIn)
  .label("noise", T.pings[0]).label("wave", T.wave).label("calm", T.calmIn).label("lockup", T.title);
tl.hit("ring", T.ringFull, { kind: "land" }).hit("light", T.lightOn[0], { kind: "whoosh" }).hit("macro", T.macro[0], { kind: "whoosh" })
  .hit("click", T.click, { kind: "impact" }).hit("set", T.turn[1], { kind: "click" }).hit("wave", T.wave, { kind: "impact" })
  .hit("lockup", T.title, { kind: "land" });
