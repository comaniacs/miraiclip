// ---- the cast: Nimbus (the little cloud), the satellite, the NOPE stamp, the splash, the shark, the anchor, the
// cable's cross-section and the hose it's compared to.
var NX = curve([[0, 960], [6.3, 960], [7.5, 960], [8.6, 820], [10.8, 340], [25.5, 340], [26.4, 960], [30, 960]]);
var NY = curve([[0, 640], [3.2, 660], [6.3, 640], [7.5, 700], [8.6, 560], [10.8, 520], [25.5, 520], [26.4, 600], [30, 600]]);
var NS = curve([[0, 1], [6.3, 0.95], [8.6, 0.8], [10.8, 0.7], [25.5, 0.7], [26.4, 0.95], [30, 0.95]]);
function nimbusAt(t) {
  var ta = Math.min(t, T.rest[0]), jump = t > T.jump && t < T.splash ? -Math.sin(Math.PI * (t - T.jump) / (T.splash - T.jump)) * 260 : 0;
  var bob = 10 * Math.sin(ta * 2.4);
  return { x: NX(t), y: NY(t) + jump + bob, s: NS(t) };
}
function poseNimbus(t) {
  var n = nimbusAt(t), ta = Math.min(t, T.rest[0]);
  var land = t > T.splash ? Math.exp(-(t - T.splash) * 6) : 0, hop = Math.exp(-Math.abs(t - 0.15) * 5);
  var sx = n.s * (1 + 0.12 * land + 0.04 * Math.sin(ta * 4.8)), sy = n.s * (1 - 0.14 * land - 0.04 * Math.sin(ta * 4.8) + 0.15 * hop);
  $("nimbus").style.transform = "translate(" + f2(n.x - 200) + "px," + f2(n.y - 140) + "px) scale(" + sx.toFixed(4) + "," + sy.toFixed(4) + ")";
  $("nimbus").style.display = t >= T.globe[0] + 0.5 && t < T.globe[1] - 0.3 ? "none" : "block";
  // where Nimbus looks
  var look = [0, 0];
  if (t < 3.2) look = t > 1.0 && t < 1.6 ? [-11, 0] : t >= 1.6 && t < 2.2 ? [11, 0] : [0, 0];
  else if (t < T.sat[1]) { var s = satAt(t); look = [clamp((s.x - n.x) / 60, -11, 11), clamp((s.y - n.y) / 60, -11, 11)]; }
  else if (t < T.seabed) look = t > T.mask ? [0, 11] : [8, 0];
  else if (t < T.shark[0]) look = [10, 8];
  else if (t < T.outro[0]) look = [11, 4];
  $("nb-pupils").setAttribute("transform", "translate(" + look[0].toFixed(1) + "," + look[1].toFixed(1) + ")");
  var blink = [2.4, 9.4, 14.9, 19.0, 27.9].reduce(function (m, b) { return Math.max(m, 1 - Math.abs(t - b) / 0.08); }, 0);
  $("nb-lids").setAttribute("height", (70 * c01(blink)).toFixed(1));
  var oh = (t > T.nope && t < T.nope + 0.8) || (t > T.hit && t < T.hit + 0.9) || (t > T.splash - 0.4 && t < T.splash + 0.3);
  $("nb-mouth").setAttribute("d", oh ? "M199 214 a12 14 0 1 0 24 0 a12 14 0 1 0 -24 0" : "M196 210 Q211 228 226 210");
  $("nb-sweat").setAttribute("opacity", (smr(t, 1.3, 1.6) * (1 - smr(t, 2.9, 3.2))).toFixed(3));
  $("nb-sweat").setAttribute("transform", "translate(0," + (6 * Math.sin(t * 6)).toFixed(1) + ")");
  var m = expOut((t - T.mask) / 0.35);
  $("nb-mask").setAttribute("opacity", c01(m * 2).toFixed(3));
  $("nb-mask").setAttribute("transform", "translate(211 160) scale(" + mix(1.6, 1, m).toFixed(3) + ") translate(-211 -160)");
  var wave = t > T.outro[0] ? Math.sin(Math.min(t, T.rest[0]) * 9) * 28 : 0;
  $("nb-armr").setAttribute("transform", "rotate(" + (-wave - (t > T.outro[0] ? 30 : 0)).toFixed(1) + " 310 200)");
}

function satAt(t) { var u = c01((t - T.sat[0]) / (T.sat[1] - T.sat[0])); return { x: mix(2150, -300, u), y: mix(260, 120, u) - 40 * Math.sin(Math.PI * u) }; }
function poseSky(t) {
  var on = t >= T.sat[0] && t < T.sat[1]; show("sat", on);
  if (on) { var s = satAt(t); $("sat").style.transform = "translate(" + f2(s.x - 130) + "px," + f2(s.y - 60) + "px) rotate(" + (-8 + 4 * Math.sin(t * 6)).toFixed(2) + "deg)"; }
  var u = expOut((t - T.nope) / 0.25), out = smr(t, T.s1[1] - 0.25, T.s1[1]);
  $("stamp").style.opacity = (t >= T.nope ? 1 - out : 0).toFixed(3);
  $("stamp").style.transform = "rotate(-14deg) scale(" + (mix(3, 1, u) * (1 - 0.3 * out)).toFixed(4) + ")";
}

// the splash: droplets thrown up where Nimbus hits the water
var DROPS = []; for (var k = 0; k < 16; k++) { var c = document.createElementNS("http://www.w3.org/2000/svg", "circle"); c.setAttribute("fill", "#bfeeff"); $("splash").appendChild(c); DROPS.push([c, -Math.PI * (0.1 + 0.8 * k / 15), 500 + 300 * ((k * 7) % 5) / 5]); }
function poseSplash(t) {
  var u = t - T.splash, on = u > 0 && u < 0.9; show("splash", on); if (!on) return;
  var sy = SURF - CAM(t), x0 = 960;
  DROPS.forEach(function (d) { var vx = Math.cos(d[1]) * d[2], vy = Math.sin(d[1]) * d[2]; d[0].setAttribute("cx", f2(x0 + vx * u)); d[0].setAttribute("cy", f2(sy + vy * u + 900 * u * u)); d[0].setAttribute("r", (14 * (1 - u / 0.9)).toFixed(1)); });
}

// the seabed close-up: the cable's cross-section and a garden hose for scale
var FIB = []; for (k = 0; k < 9; k++) { var fc = document.createElementNS("http://www.w3.org/2000/svg", "circle"); var a = k / 9 * Math.PI * 2; fc.setAttribute("cx", (180 + (k ? 26 : 0) * Math.cos(a)).toFixed(1)); fc.setAttribute("cy", (180 + (k ? 26 : 0) * Math.sin(a)).toFixed(1)); fc.setAttribute("r", "7"); fc.setAttribute("fill", "#5be3b5"); $("fibers").appendChild(fc); FIB.push(fc); }
function poseCloseup(t) {
  var on = t >= T.xs[0] && t < T.xs[1] + 0.3; show("xsec", on); show("hose", on); show("xlead", on); if (!on) return;
  var u = expOut((t - T.xs[0]) / 0.45), out = smr(t, T.xs[1] - 0.25, T.xs[1]);
  $("xsec").style.opacity = (c01(u * 2) * (1 - out)).toFixed(3); $("xsec").style.transform = "scale(" + mix(0.2, 1, u).toFixed(4) + ") rotate(" + mix(-30, 0, u).toFixed(2) + "deg)";
  FIB.forEach(function (f, k) { f.setAttribute("opacity", (0.5 + 0.5 * Math.sin(t * 8 + k)).toFixed(3)); });
  var v = expOut((t - T.xs[0] - 0.5) / 0.45);
  $("hose").style.opacity = (c01(v * 2) * (1 - out)).toFixed(3); $("hose").style.transform = "translate(" + f2(-400 + (1 - v) * -80) + "px,-280px) rotate(" + mix(-12, 0, v).toFixed(2) + "deg)";
  var L = c01((t - T.xs[0] - 0.2) / 0.4), p = $("xlead").firstElementChild;
  p.setAttribute("d", "M1050 " + (CABLE_Y - CAM(t)).toFixed(0) + " L" + f2(mix(1050, 1300, L)) + " " + f2(mix(CABLE_Y - CAM(t), 520, L)));
  p.style.opacity = (1 - out).toFixed(3);
}

// who breaks the cables: an innocent shark, then the real culprit, an anchor
function poseBreak(t) {
  var on = t >= T.shark[0] && t < T.shark[1] + 0.2; show("shark", on);
  if (on) {
    var tin = expOut((t - T.shark[0]) / 0.6), tout = smoother((t - (T.shark[1] - 0.6)) / 0.6);
    var x = mix(2000, 1150, tin) + tout * 1000, y = 600 + 10 * Math.sin(t * 5);
    $("shark").style.transform = "translate(" + f2(x) + "px," + f2(y) + "px) scaleX(" + (tout > 0.02 ? -1 : 1) + ")";
    var chomp = t > T.shark[0] + 0.45 && t < T.b2 ? Math.abs(Math.sin((t - T.shark[0]) * 14)) : 0;
    $("sh-mouth").setAttribute("d", chomp > 0.5 ? "M45 120 Q70 150 95 120" : "M45 125 Q70 132 95 124");
    $("halo").setAttribute("opacity", smr(t, T.b2 + 0.1, T.b2 + 0.3).toFixed(3));
    $("halo").setAttribute("transform", "translate(0," + (4 * Math.sin(t * 6)).toFixed(1) + ")");
  }
  var aon = t >= T.anchor && t < T.outro[0] + 1.0; show("anchor", aon);
  if (aon) {
    var g = c01((t - T.anchor) / (T.hit - T.anchor)), y0 = -300, y1 = CABLE_Y - CAM(t) - 225, bounce = t > T.hit ? -30 * Math.exp(-(t - T.hit) * 7) * Math.abs(Math.sin((t - T.hit) * 18)) : 0;
    var lift = smoother((t - T.outro[0]) / 0.9);
    $("anchor").style.transform = "translate(1000px," + f2(mix(y0, y1, g * g) + bounce - lift * 1400) + "px) rotate(" + (8 * (1 - g)).toFixed(2) + "deg)";
  }
  var sp = t - T.hit, son = sp > 0 && sp < 0.5; show("spark", son);
  if (son) $("spark").firstElementChild.setAttribute("transform", "translate(1100 " + (CABLE_Y - CAM(t)).toFixed(0) + ") scale(" + (0.4 + 2 * sp).toFixed(3) + ") rotate(" + (sp * 200).toFixed(1) + ")"), $("spark").style.opacity = (1 - sp / 0.5).toFixed(3);
}
