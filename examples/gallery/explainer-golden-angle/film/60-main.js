// ---- the frame: the canvas painter reports its own motion (from probe seeds); the DOM painter holds.
tl.frame(paintFlower, { motion: seedMotion });
tl.frame(poseType, { hold: true });
tl.subject("the flower", function (t) { return { x: CX + MOVE(t), y: CY, r: 450 * ZOOM(t) }; }, { minPx: 30 });
tl.rest(T.rest[0], T.rest[1]);
tl.label("hook", 0).label("rule", T.rule[0]).label("seeds", T.seeds[0]).label("quarter", T.angles[1][0]).label("third", T.angles[2][0]).label("fifths", T.angles[3][0])
  .label("close", T.angles[4][0]).label("golden", T.lock).label("why", T.g3[0]).label("spirals34", T.sp34[0]).label("spirals55", T.sp55[0]).label("petals", T.petals[0]).label("payoff", T.p2);
tl.hit("lock", T.lock, { kind: "impact" }).hit("payoff", T.p2, { kind: "land" });
