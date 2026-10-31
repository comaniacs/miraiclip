// ---- motion graphics: headlines, the ingredient card's counters, the tilde wave round the can, and the lockup
var wave = $("kline");
function poseWave(t, c) { // a coral tilde wave circling the can at its waist, drawn once round, then letting go
  var u = smoother((t - T.wave[0]) / (T.wave[1] - T.wave[0])), out = smr(t, T.wave[1] - 0.2, T.wave[1] + 0.6);
  if (u <= 0 || out >= 1) { wave.style.opacity = 0; return; }
  var pts = [];
  for (var k = 0; k <= 72; k++) { var a = k / 72 * 2 * Math.PI + 0.5; pts.push([Math.cos(a) * 250, -230 + 34 * Math.sin(3 * a + 2 * t), Math.sin(a) * 250]); }
  drawLine(wave, pts, c, u, 1 - out);
}
function poseType(t) {
  lineIO("i1", T.intro, t); lineIO("i2", [T.word[0], T.word[1]], t);
  lineIO("f0", T.facts, t);
  ["f1", "f2", "f3", "f4"].forEach(function (id, k) { fadeIO(id, T.facts[0] + 0.45 + 0.35 * k, T.facts[1], t, 18); });
  $("f1n").textContent = Math.round(3 * smoother((t - T.facts[0] - 0.45) / 0.7));
  lineIO("e1", T.exp, t);
  var u = smoother((t - T.title) / 0.9);
  $("lock").style.opacity = u.toFixed(3); $("lock").style.letterSpacing = mix(0.5, 0.16, u).toFixed(3) + "em";
  $("lockwave").style.strokeDashoffset = (1 - smoother((t - T.title - 0.2) / 1.0)).toFixed(3);
  lineIO("tag", [T.tag, 99], t);
  fadeIO("cta", T.cta, 99, t, 10);
}
