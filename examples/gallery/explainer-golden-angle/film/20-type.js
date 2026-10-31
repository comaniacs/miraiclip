// ---- the type, the dial, the counters and the Fibonacci row.
function capIO(id, span, t) { lineIO(id, span, t); }
function fracLabel(th) {
  var L = [[90, "¼ turn"], [120, "⅓ turn"], [144, "⅖ turn"], [137.0, "so close…"], [GOLDEN, "the golden angle"]];
  for (var k = 0; k < L.length; k++) if (Math.abs(th - L[k][0]) < 0.06) return L[k][1];
  return "";
}
function poseDial(t, th) {
  ["dial", "dnum", "dfrac"].forEach(function (id) { fadeIO(id, 3.6, 18.6, t, 20); });
  $("dneedle").setAttribute("transform", "rotate(" + th.toFixed(3) + " 190 190)");
  var a = (th - 90) * deg, x = 190 + 150 * Math.cos(a), y = 190 + 150 * Math.sin(a);
  $("darc").setAttribute("d", "M190 40 A150 150 0 " + (th > 180 ? 1 : 0) + " 1 " + x.toFixed(2) + " " + y.toFixed(2));
  setHtml($("dnum"), th.toFixed(1) + "°");
  setHtml($("dfrac"), fracLabel(th));
  var lock = t > T.lock ? Math.exp(-(t - T.lock) * 5) : 0;
  $("dnum").style.color = t > T.lock - 0.1 ? "#f2b33d" : "#f3e9d2";
  $("dnum").style.transform += " scale(" + (1 + 0.15 * lock).toFixed(3) + ")";
}
function poseType(t) {
  var th = thetaAt(t);
  capIO("h1", T.h1, t); capIO("h2", T.h2, t);
  capIO("r1", [T.rule[0] + 0.2, T.rule[1] - 0.6], t); capIO("r2", [T.rule[0] + 0.5, T.rule[1] - 0.6], t);
  capIO("a0", [T.angles[1][0] - 0.4, T.angles[5][0] - 0.3], t);
  capIO("a1", T.a1, t); capIO("a2", T.a2, t); capIO("a3", T.a3, t); capIO("a4", T.a4, t);
  capIO("g1", T.g1, t); capIO("g2", T.g2, t); capIO("g3", T.g3, t);
  poseDial(t, th);
  $("flash").style.opacity = (t > T.lock ? 0.9 * Math.exp(-(t - T.lock) * 3.5) : 0).toFixed(3);
  // the spirals: a big counter that ticks with the arms, and the Fibonacci row with the two counts lit
  capIO("f1", T.f1, t);
  var f34 = family(t, T.sp34, 34), f55 = family(t, T.sp55, 55), cur = t < T.sp55[0] ? f34 : f55;
  fadeIO("cnt", T.sp34[0], T.f1[1] - 0.3, t, 30); fadeIO("cntl", T.sp34[0] + 0.3, T.f1[1] - 0.3, t, 16);
  setHtml($("cnt"), String(cur.n));
  var tick = 1 + 0.06 * Math.abs(Math.sin(cur.n * 1.7)) * (cur.n < cur.F ? 1 : 0);
  $("cnt").style.transform += " scale(" + tick.toFixed(3) + ")"; $("cnt").style.transformOrigin = "0 50%";
  setHtml($("cntl"), t < T.sp55[0] ? "spirals one way" : "spirals the other way");
  fadeIO("fibrow", T.fib[0], T.fib[1], t, 20);
  [].forEach.call($("fibrow").children, function (s, k) { s.className = (k === 8 && t > T.sp34[0] + 1.9) || (k === 9 && t > T.sp55[0] + 1.9) ? "on" : ""; });
  // the payoff
  lineIO("p1", [T.p1, 99], t);
  fadeIO("big", T.p2, 99, t, 30);
}
