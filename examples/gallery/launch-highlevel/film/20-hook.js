// ---- 0–8.75 s: a lead calls at 2:14 AM, the AI Employee picks up, and we meet it.
function poseHook(t) {
  show("s-hook", t < T.reveal[0] + 0.5);
  if (t >= T.reveal[0] + 0.5) return;
  var answered = t >= T.answer, ring = 0;
  T.ring.forEach(function (r) { if (t >= r && !answered) ring = Math.max(ring, Math.exp(-(t - r) * 3.2)); });
  // the phone buzzes on each ring, then flies into the AI orb
  var fly = smoother((t - 4.75) / 0.6), cx = mix(1380, 960, fly), cy = mix(550, 380, fly);
  $("phone").style.transform = "translate(" + f2(cx - 1380 + Math.sin(t * 70) * 7 * ring) + "px," + f2(cy - 550) + "px) rotate(" + (Math.sin(t * 55) * 3 * ring).toFixed(2) + "deg) scale(" + mix(1, 0.15, fly).toFixed(3) + ")";
  $("phone").style.opacity = (1 - smr(t, 5.0, 5.35)).toFixed(3);
  [].forEach.call(document.querySelectorAll(".ringw i"), function (e, k) {
    var ph = ((t / 1.25) + k / 3) % 1;
    e.style.transform = "scale(" + mix(0.7, 1.9, ph).toFixed(3) + ")"; e.style.opacity = (answered ? 0 : (1 - ph) * 0.8).toFixed(3);
  });
  var a = expOut((t - T.answer) / 0.35);
  $("accept").style.transform = "scale(" + (1 + 0.25 * a * Math.exp(-(t - T.answer) * 4)).toFixed(3) + ")";
  $("accept").style.boxShadow = "0 0 " + (60 * a).toFixed(0) + "px rgba(55,202,55," + (0.9 * a).toFixed(2) + ")";
  $("answered").style.opacity = (a * (1 - smr(t, 4.75, 5.0))).toFixed(3);
  lineIO("hk1", T.hk1, t); lineIO("hk2", T.hk2, t);
}

var MODS = [["Voice AI", "#188BF6"], ["Conversation AI", "#37CA37"], ["Reviews AI", "#FFBC00"], ["Content AI", "#188BF6"], ["Funnel AI", "#37CA37"], ["Workflow AI", "#FFBC00"]];
var CHIPS = MODS.map(function (m) { var c = mk("mchip", $("chips"), '<i style="background:' + m[1] + '"></i>' + m[0]); return c; });
var ORB = [960, 380];
function poseReveal(t) {
  var on = t >= T.reveal[0] - 0.1 && t < T.reveal[1] + 0.1;
  show("s-reveal", on);
  if (!on) return;
  var o = expOut((t - T.reveal[0] + 0.1) / 0.7), out = smoother((t - 8.2) / 0.5);
  $("orb").style.transform = "scale(" + (o * (1 - 0.4 * out)).toFixed(4) + ") rotate(" + (t * 50).toFixed(1) + "deg)";
  $("orbi").style.transform = "scale(" + (o * (1 - 0.4 * out)).toFixed(4) + ")";
  $("orb").style.opacity = $("orbi").style.opacity = (1 - out).toFixed(3);
  CHIPS.forEach(function (c, k) {
    var a = (-150 + 60 * k) * deg, u = expOut((t - 5.7 - 0.12 * k) / 0.6) * (1 - out);
    var x = ORB[0] + Math.cos(a) * 640 * u, y = ORB[1] + Math.sin(a) * 200 * u + 6 * Math.sin(t * 2 + k);
    c.style.transform = "translate(" + f2(x - c.offsetWidth / 2) + "px," + f2(y - 31) + "px) scale(" + mix(0.3, 1, u).toFixed(3) + ")";
    c.style.opacity = c01(u * 2).toFixed(3);
  });
  fadeIO("rv1", 6.1, 8.2, t, 20); fadeIO("rv2", 6.4, 8.2, t, 30);
}
