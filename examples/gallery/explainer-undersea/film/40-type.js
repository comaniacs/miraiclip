// ---- the stickers: every line of copy pops in with a little overshoot and tilt, and shrinks away.
var STK = [["q1", T.q1[0], T.q1[1], -2], ["q2", T.q2[0], T.q2[1], 2], ["s1", T.s1[0], T.s1[1], -2], ["s2", T.s2[0], T.s2[1], 1], ["d1", T.d1[0], T.d1[1], -3],
  ["c1", T.c1[0], T.c1[1], -1.5], ["c2", T.c2[0], T.c2[1], 1.5], ["c3", T.xs[0] + 0.7, T.xs[1], -3],
  ["g1", T.globe[0] + 0.5, T.globe[1] - 0.4, -2], ["g2", T.wraps[0], T.globe[1] - 0.4, 1.5],
  ["b1", T.b1[0], T.b1[1], -1.5], ["b2", T.b2, T.anchor + 0.1, 2], ["b3", T.b3, T.b1[1], -2],
  ["o1", T.o1, 99, -2], ["o2", T.o2, 99, 1.5], ["o3", T.o3, 99, -3]];
function backOut(x) { x = c01(x); var c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
function poseType(t) {
  STK.forEach(function (s) {
    var el = $(s[0]), u = c01((t - s[1]) / 0.38), v = smr(t, s[2] - 0.22, s[2]);
    el.style.opacity = (t < s[1] ? 0 : c01(u * 3) * (1 - v)).toFixed(3);
    el.style.transform = "scale(" + (t < s[1] ? 0 : backOut(u) * (1 - 0.4 * v)).toFixed(4) + ") rotate(" + (s[3] * (1 + (1 - u) * 4)).toFixed(2) + "deg)";
  });
  $("src").style.opacity = smr(t, T.o3 + 0.3, T.o3 + 0.8).toFixed(3);
}
