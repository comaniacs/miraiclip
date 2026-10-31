// ---- the frame: camera, book, city, birds, overlay, all from t
function paint(t) {
  var c = camAt(t);
  $("view").style.transform = "translate(" + f2(c.ox) + "px," + f2(c.oy) + "px)";
  world.style.transform = $("ground").style.transform = camTransform(c);
  poseCity(t); poseLines(t); poseBirds(t); poseBook(t);
  poseAnnotation(t, c); poseLine(t, c);
}
tl.frame(paint, { motion: CAM.motionOf });
tl.frame(poseType, { hold: true });

// the subject the shot check keeps in frame: the first fold, then the tower, then the book
tl.subject("the city", function (t) {
  var c = camAt(t), p = t < 9.6 ? [CITY[0][0], -80, CITY[0][1]] : t < 14.8 ? [CITY[1][0], -120, CITY[1][1]] : [t < 26 ? 400 : 800, -40, 0];
  var s = project(p, c); return { x: s.x, y: s.y, r: 120 * s.k };
}, { minPx: 30 });
tl.rest(28.8, T.DUR);
tl.label("crease", T.crease[0]).label("first", T.first[0]).label("grid", T.grid[0]).label("wave", T.wave[0]).label("dive", 9.4).label("tower", T.tower[0])
  .label("dusk", T.dusk[0]).label("birds", T.birds[0]).label("mark", T.mark[0]).label("reveal", T.reveal[0]).label("fold", T.fold[0]).label("close", T.close[0]);
POP.forEach(function (p, i) { tl.hit("fold" + i, p, { kind: "click" }); });
tl.hit("close", T.close[1], { kind: "impact" });
