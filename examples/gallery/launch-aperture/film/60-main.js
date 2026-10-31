// ---- the frame: one painter, the subject, the rest and the beats.
function paint(t) {
  poseHook(t); poseAperture(t); poseThemes(t); poseTour(t); poseProof(t); poseEnd(t);
  $("credit").style.display = t >= T.ap[0] && t < T.proof[0] + 0.5 ? "block" : "none";
}
tl.frame(paint, { hold: true });
tl.subject("the product", function (t) {
  if (t < T.ap[0]) return { x: W / 2, y: H / 2, r: 400 };
  if (t >= T.wipe) return { x: MC[0], y: MC[1], r: 90 };
  return { x: W / 2, y: 600, r: 500 };
}, { minPx: 30 });
tl.rest(T.rest[0], T.rest[1]);
tl.label("hook", 0).label("aperture", T.ap[0]).label("themes", T.themes[0]).label("tour", T.tour[0]).label("proof", T.proof[0])
  .label("home", T.end[0]).label("close", T.close[0]).label("lockup", T.wipe);
T.words.forEach(function (w, k) { tl.hit("word" + k, w, { kind: "impact" }); });
tl.hit("aperture", T.ap[0], { kind: "impact" }).hit("wipe", T.wipe, { kind: "impact" }).hit("url", T.url, { kind: "land" });
