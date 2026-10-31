// ---- camera: [t, yaw, elev, dist, tx, ty, ox, oy]. The deduction push-ins aim at the real cards; the climax ends
// at exactly the true viewpoint (yaw 0, elev 0, dist = PERSP, target C), where the clues line up.
function at(i, oy) { return [cards[i].pin[0], cards[i].pin[1] + (oy || 90)]; }
var D0 = at(DEDS[0].card), D1 = at(DEDS[1].card), D2 = at(DEDS[2].card);
var CAM = filmCamera([
  [0.0, 25, 22, 1000, 0, -60, 0, 0], //        the cup in its spotlight
  [3.2, 10, 60, 620, 0, -80, 0, 0],
  [4.4, 0, 88, 380, 0, -80, 0, 0], //          top-down over the tea
  [5.4, 0, 89, 320, 0, 320, 0, 0], //          down through the surface
  [7.0, 14, 46, 1400, 0, 1250, 0, 0], //       into the mind, looking down on the clues
  [9.0, 28, 16, 1350, D0[0] * 0.6, D0[1], 0, 0],
  [10.2, 22, 6, 640, D0[0], D0[1], -280, 0], // deduction 1
  [12.0, -18, 6, 640, D1[0], D1[1], -280, 0], // deduction 2
  [13.9, -30, 4, 640, D2[0], D2[1], -280, 0], // deduction 3
  [15.6, 40, 14, 1650, 0, C[1], 0, 0], //      along the red string
  [18.6, 110, 20, 1900, 0, C[1], 0, 0],
  [21.0, 40, 8, 1700, 0, C[1], 0, 0], //       the swing back toward the one viewpoint
  [23.0, 0, 0, PERSP, 0, C[1], 0, 0], //       the true viewpoint: the pattern resolves
  [25.8, 0, 0, PERSP, 0, C[1], 0, 0],
  [28.6, 0, 0, PERSP - 60, 0, C[1], 0, 0], //  a slow push as the title lands
  [30.0, 0, 0, PERSP - 60, 0, C[1], 0, 0],
], [[0, -60, 0], C, [C[0] + 600, C[1], 0], [C[0], C[1] + 400, 300]]);
var camAt = CAM.camAt;

// ---- overlay: the leader line for each deduction, the red string, and the painted pattern
var lead = $("lead"), line = $("kline"), eyeL = $("eyeL"), eyeR = $("eyeR"), ring = $("ring");
function poseMarks(t, c) {
  var d = -1;
  T.deds.forEach(function (s, k) { if (t >= s[0] && t < s[1] + 0.3) d = k; });
  if (d >= 0) {
    var s = T.deds[d], p = project(pinOf(DEDS[d].card, t), c), u = smoother((t - s[0] - 0.3) / 0.5), v = 1 - smr(t, s[1] - 0.2, s[1] + 0.2);
    lead.setAttribute("d", "M" + f2(p.x) + " " + f2(p.y) + " L" + f2(p.x + 140) + " " + f2(p.y - 70) + " L1080 " + f2(p.y - 70));
    lead.style.strokeDashoffset = (1 - u).toFixed(3); lead.style.opacity = v.toFixed(3);
    $("dk").textContent = DEDS[d].k; $("dv").textContent = DEDS[d].v;
    var box = $("ded"); box.style.top = f2(p.y - 70 - 46) + "px"; box.style.opacity = (smoother((t - s[0] - 0.55) / 0.4) * v).toFixed(3);
  } else { lead.style.opacity = 0; $("ded").style.opacity = 0; }
  // the string: through the smile's pins left to right, drawn while the camera tracks it, then repainted as the smile
  var smilePts = [2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (i) { return pinOf(i, t); });
  var share = smoother((t - T.string[0]) / (T.string[1] - T.string[0] - 1.2)), painted = smr(t, T.smile[0], T.smile[0] + 0.6);
  drawLine(line, smilePts, c, share, smr(t, T.string[0], T.string[0] + 0.3) * (1 - 0.6 * smr(t, T.title - 0.4, T.title + 0.6)));
  line.style.strokeWidth = f2(mix(3, 16, painted));
  [[eyeL, 0], [eyeR, 1]].forEach(function (e) {
    var p = project(pinOf(e[1], t), c), u = smoother((t - T.smile[0] - 0.3 - 0.2 * e[1]) / 0.6);
    e[0].setAttribute("cx", f2(p.x)); e[0].setAttribute("cy", f2(p.y)); e[0].setAttribute("rx", f2(30 * u)); e[0].setAttribute("ry", f2(46 * u));
    e[0].style.opacity = (1 - 0.6 * smr(t, T.title - 0.4, T.title + 0.6)).toFixed(3);
  });
  var cc = project(C, c), r = 470 * cc.k, ru = smoother((t - T.smile[0] - 0.8) / 1.4);
  ring.setAttribute("cx", f2(cc.x)); ring.setAttribute("cy", f2(cc.y)); ring.setAttribute("r", f2(r));
  ring.style.strokeDashoffset = (1 - ru).toFixed(3); ring.style.opacity = (ru > 0 ? 1 - 0.6 * smr(t, T.title - 0.4, T.title + 0.6) : 0).toFixed(3);
}

function paint(t) {
  var c = camAt(t);
  $("view").style.transform = "translate(" + f2(c.ox) + "px," + f2(c.oy) + "px)";
  world.style.transform = $("ground").style.transform = camTransform(c);
  poseCup(t, c); poseMind(t, c); poseMarks(t, c);
  var y = camPos(c)[1]; // the tea fills the frame as the camera goes through it, then the dark of the mind
  $("teafill").style.opacity = (smr(y, -300, -175) * (1 - smr(y, -60, 260))).toFixed(3);
  $("spot").style.opacity = (1 - smr(y, -200, -120)).toFixed(3);
}
function poseType(t) {
  lineIO("h1", T.look, t); lineIO("h2", T.intro, t); lineIO("h3", T.exp, t); lineIO("h4", T.warn, t);
  var u = smoother((t - T.title) / 1.0);
  $("title").style.opacity = u.toFixed(3); $("title").style.letterSpacing = mix(0.5, 0.22, u).toFixed(3) + "em";
  lineIO("tag", [T.tag, 99], t); fadeIO("cta", T.cta, 99, t, 10); fadeIO("fan", T.cta + 0.3, 99, t, 6);
}
tl.frame(paint, { motion: CAM.motionOf });
tl.frame(poseType, { hold: true });
tl.subject("the cup / the clues", function (t) { var c = camAt(t), s = project(t < 5.2 ? [0, -60, 0] : C, c); return { x: s.x, y: s.y, r: 200 * s.k }; }, { minPx: 30 });
tl.rest(T.rest[0], T.rest[1]);
tl.label("look", T.look[0]).label("dive", T.dive[0]).label("mind", T.intro[0]).label("ded1", T.deds[0][0]).label("ded2", T.deds[1][0]).label("ded3", T.deds[2][0])
  .label("string", T.string[0]).label("align", T.align[0]).label("smile", T.smile[0]).label("title", T.title);
tl.hit("smile", T.smile[0], { kind: "impact" }).hit("title", T.title, { kind: "land" });
