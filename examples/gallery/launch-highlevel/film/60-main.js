// ---- the frame: one painter, the subject, the rest and the beats.
function paint(t) {
  poseSky(t); poseHook(t); poseReveal(t);
  poseVoice(t); poseConv(t); poseRev(t); poseContent(t); poseFunnel(t); poseFlow(t);
  poseRecap(t); poseEnd(t); poseClock(t);
}
tl.frame(paint, { hold: true });
tl.subject("the moment", function (t) {
  if (t < T.reveal[0]) return { x: 1380, y: 550, r: 300 };
  if (t < T.scenes[0]) return { x: 960, y: 380, r: 300 };
  if (t < T.recap[0]) return { x: 1360, y: 560, r: 420 };
  return { x: 960, y: 560, r: 400 };
}, { minPx: 30 });
tl.rest(T.rest[0], T.rest[1]);
tl.label("hook", 0).label("answer", T.answer).label("reveal", T.reveal[0]);
SCENES.forEach(function (s) { tl.label(s[0], s[1]).label(s[0] + "-ui", s[1] + 0.9).label(s[0] + "-result", s[1] + 3.6); });
tl.label("chips", 5.7).label("recap", T.recap[0]).label("recap-cards", T.recap[0] + 1.8).label("end", T.end[0]).label("url", T.url);
T.ring.forEach(function (r, k) { tl.hit("ring" + k, r, { kind: "impact" }); });
tl.hit("answer", T.answer, { kind: "impact" }).hit("url", T.url, { kind: "land" });
