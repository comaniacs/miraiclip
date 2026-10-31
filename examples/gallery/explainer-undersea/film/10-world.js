// ---- the world: sky over sea over seabed, one tall column the camera dives down. Ambient motion (fish, bubbles,
// weeds, waves, light pulses in the cable) freezes at the final rest so the closing frame holds still.
function show(id, on) { $(id).style.display = on ? "block" : "none"; }
var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(17);
var CAM = curve([[0, 0], [6.6, 0], [7.4, 600], [8.3, 1350], [10.8, 3100], [30, 3100]]);
var SURF = 1080, CABLE_Y = 3922; // the cable's centre line

var PUFFS = [[200, 220, 260], [700, 140, 200], [1150, 300, 240], [420, 560, 180], [1500, 520, 220]].map(function (p) { var e = mk("puff", $("puffs")); e.style.position = "absolute"; e.style.width = p[2] + "px"; return [e].concat(p); });
var FISH = []; for (var i = 0; i < 12; i++) { var f = mk("fish", $("fishes"), FISH_SVG[i % 5]); f.style.position = "absolute"; FISH.push({ el: f, y: 1300 + rnd() * 2450, x0: rnd() * 2200, v: (60 + rnd() * 90) * (i % 2 ? 1 : -1), s: 0.6 + rnd() * 0.7, ph: rnd() * 6 }); }
var BUBS = []; for (i = 0; i < 34; i++) { var b = mk("bub", $("bubs")); b.style.position = "absolute"; BUBS.push({ el: b, x: rnd() * W, y0: 1300 + rnd() * 2800, v: 60 + rnd() * 110, s: 0.5 + rnd() }); }
var WEEDS = []; for (i = 0; i < 16; i++) { var w = mk("weed", $("weeds")); w.style.position = "absolute"; var h = 60 + rnd() * 120; w.style.height = h + "px"; w.style.left = (40 + i * 120 + rnd() * 50).toFixed(0) + "px"; w.style.top = (3895 - h).toFixed(0) + "px"; WEEDS.push([w, rnd() * 6]); }
var PULSES = []; for (i = 0; i < 14; i++) PULSES.push(mk("", $("pulses")));

function poseWorld(t) {
  var ta = Math.min(t, T.rest[0]), cy = CAM(t);
  $("world").style.transform = "translateY(" + f2(-cy) + "px)";
  PUFFS.forEach(function (p) { p[0].style.left = f2(((p[1] + ta * 25) % 2100) - 200) + "px"; p[0].style.top = p[2] + "px"; });
  var d = "M0 40"; for (var x = 0; x <= W + 200; x += 40) d += "L" + x + " " + f2(40 + 14 * Math.sin(x / 90 + ta * 3)); $("wavep").setAttribute("d", d + "V80H0Z");
  FISH.forEach(function (f) {
    var span = 2400, x = ((f.x0 + f.v * ta) % span + span) % span - 240;
    f.el.style.transform = "translate(" + f2(x) + "px," + f2(f.y + 18 * Math.sin(ta * 2 + f.ph)) + "px) scale(" + (f.v > 0 ? -f.s : f.s).toFixed(3) + "," + f.s.toFixed(3) + ")";
  });
  BUBS.forEach(function (b) { var y = b.y0 - ((b.v * ta) % 2800); if (y < 1120) y += 2800; b.el.style.transform = "translate(" + f2(b.x + 12 * Math.sin(ta * 2 + b.y0)) + "px," + f2(y) + "px) scale(" + b.s.toFixed(2) + ")"; });
  WEEDS.forEach(function (w) { w[0].style.transform = "rotate(" + (8 * Math.sin(ta * 1.6 + w[1])).toFixed(2) + "deg)"; });
  // light rides the cable; the anchor cuts it at the hit, and the repair brings it back
  var cut = t >= T.hit && t < T.outro[0];
  PULSES.forEach(function (p, k) { var x = ((k * 150 + ta * 520) % 2100) - 120; p.style.left = f2(x) + "px"; p.style.opacity = cut && x > 1080 ? 0 : 1; });
  $("cable").style.boxShadow = cut ? "0 0 30px rgba(255,107,107," + (0.5 + 0.4 * Math.sin(t * 20)).toFixed(2) + ")" : "0 6px 0 rgba(0,0,0,0.25)";
  return cy;
}
