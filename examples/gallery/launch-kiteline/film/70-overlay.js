// ---- motion graphics specific to this film: the cursor's visible span, the prompt reveal, the preview highlight,
// the landing glow, the three uses of the coral line, the headlines and the lockup. The mechanics are the kit's.
var cursor = $("cursor"), ripple = $("ripple"), line = $("kline");
function poseMarks(t, rec) {
  poseCursor(cursor, ripple, t, rec, R, ACTIONS, { home: { x: 1180, y: 760 }, visible: [4.45, 21.7] });
  // the generated prompt is revealed top to bottom (the app shows it all at once; this is the film's wipe over it)
  revealMask($("rmask"), rectOf(".kl-prompt"), t < T.reveal[0] ? 0 : smoother((t - T.reveal[0]) / (T.reveal[1] - T.reveal[0])));
  // a coral bar under the preview's first line while it is being rewritten
  underline($("hl"), rectOf(".kl-pv-text .kl-l1"), smr(t, 15.25, 15.5) * (1 - smr(t, 17.3, 17.6)));
  // the scheduled card is revealed as the flying preview lands on it, with a short coral glow
  var card = host.querySelector('.kl-col[data-date="2026-11-12"] .kl-card');
  if (card && t < T.previewFly[1] - 0.12) card.style.visibility = "hidden";
  else if (card) { var g = Math.exp(-(t - T.previewFly[1]) * 2); card.style.boxShadow = "0 0 0 2px rgba(255,106,77," + (0.9 * g).toFixed(3) + "), 0 8px 24px rgba(255,106,77," + (0.35 * g).toFixed(3) + ")"; }
}

// the coral line: threads the ideas in the hook, runs from Generate into the prompt, then ties the plan together
function poseLine(t, c, ideaPts, planPts) {
  if (t < T.appIn[1]) {
    drawLine(line, [[-1700, 900, 300]].concat(ideaPts), c, smoother((t - T.thread[0]) / (T.thread[1] - T.thread[0])), 1 - smr(t, 3.1, 3.7)); // in from below the frame, like a kite string
  } else if (t < T.reveal[1] + 0.6) {
    var a = rectOf('[data-act="generate"]'), b = rectOf(".kl-prompt");
    if (!a || !b || t < T.reveal[0] - 0.1) { line.style.opacity = 0; return; }
    drawLine(line, [w2w(a.x + a.w - 30, a.y + a.h / 2, 0), w2w(a.x + a.w + 40, a.y - 60, 60), w2w(b.x + 30, b.y + 40, 30), w2w(b.x + 30, b.y + b.h * 0.6, 0)], c,
      smoother((t - T.reveal[0] + 0.1) / 0.55), 1 - smr(t, T.reveal[1] + 0.1, T.reveal[1] + 0.5));
  } else if (planPts.length > 1) {
    drawLine(line, planPts, c, smoother((t - T.planLine[0]) / (T.planLine[1] - T.planLine[0])), 1 - smr(t, T.settle[0], T.settle[0] + 0.6));
  } else line.style.opacity = 0;
}

var HEADS = [["h1a", T.hook1], ["h1b", T.hook2], ["h2a", T.head2], ["h2b", [T.head2[0] + 0.12, T.head2[1] + 0.05]], ["h3a", T.head3], ["h3b", [T.head3[0] + 0.12, T.head3[1] + 0.05]],
  ["h4a", T.head4], ["h5a", T.head5], ["h5b", [T.head5[0] + 0.25, T.head5[1] + 0.05]], ["tag", [T.tag, 99]]];
function poseType(t) {
  HEADS.forEach(function (h) { lineIO(h[0], h[1], t); });
  $("scrim").style.opacity = scrimAt(t, [T.head2, T.head3, T.head4]).toFixed(3); // only where a headline sits over the UI
  var u = smoother((t - T.title) / 0.9);
  $("lock").style.opacity = u.toFixed(3);
  $("lock").style.transform = "translateY(" + f2((1 - u) * 26) + "px)";
  $("lockMark").style.transform = "rotate(" + f2(45 - 30 * (1 - u)) + "deg) scale(" + (0.6 + 0.4 * u).toFixed(3) + ")";
  fadeIO("cta", T.cta, 99, t, 10);
}
