// ---- the frame: replay the app to t, then pose the camera, the 3D layer and the overlay around it
function paint(t) {
  var c = camAt(t);
  $("view").style.transform = "translate(" + f2(c.ox) + "px," + f2(c.oy) + "px)";
  world.style.transform = $("ground").style.transform = camTransform(c);
  var rec = replay(t);
  winEl.style.opacity = smr(t, T.appIn[0], T.appIn[1]).toFixed(3);
  $("winShadow").style.opacity = (0.15 + 0.85 * smr(t, T.appIn[0], T.appIn[1])).toFixed(3);
  var ideaPts = poseIdeas(t).map(function (p) { return w2w(p[0], p[1], p[2]); });
  poseTiles(t);
  poseCarry(t, rec);
  var planPts = poseLifts(t);
  poseHero(t, rec);
  poseCursor(t, rec);
  poseReveal(t);
  poseHighlight(t);
  poseLanding(t);
  poseLine(t, c, ideaPts, planPts);
}
// the picture moves with the camera (motion blur sizes its samples from it); the type is held to the frame grid
tl.frame(paint, { motion: motionOf });
tl.frame(poseType, { hold: true });

// the subject the shot check keeps in frame: the app window
tl.subject("the app window", function (t) { var c = camAt(t), s = project([0, 0, 0], c); return { x: s.x, y: s.y, r: 300 * s.k }; }, { minPx: 120 });
tl.rest(28.8, T.DUR);

tl.label("ideas", T.thread[0]).label("land", T.land[0]).label("app", T.appIn[0]).label("week", 4.9).label("select", 5.9).label("create", 8.3)
  .label("type", 9.25).label("generate", 11.85).label("write", 13.9).label("edit", 15.2).label("platform", 17.45).label("schedule", 19.6)
  .label("month", 21.4).label("plan", T.chipsUp[0]).label("hero", T.heroIn[0]).label("lockup", T.title);
ACTIONS.forEach(function (a, i) { if (a.kind === "click") tl.hit("click" + i, a.t, { kind: "click" }); });
tl.hit("land", T.previewFly[1], { kind: "land" }).hit("lockup", T.title, { kind: "land" });
