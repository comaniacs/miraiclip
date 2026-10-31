// ---- the teacup on the table, and below it the mind: clue cards hung at random depths that line up into a pattern
// from exactly one viewpoint (an anamorphic arrangement). px, y down; the table top is y = 0.
var world = $("world");
function el(cls, parent, css, html) { var e = document.createElement("div"); e.className = cls; if (css) e.style.cssText = css; if (html) e.innerHTML = html; parent.appendChild(e); return e; }
function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ---- the cup: porcelain strips, a saucer, a handle, and tea with trembling rings
var cupG = el("g3", world), CR = 95, CH = 90, strips = [];
for (var i = 0; i < 40; i++) {
  var th = i * 9, w = 2 * Math.PI * CR / 40 + 0.8;
  strips.push({ el: el("cup", cupG, "left:" + f2(-w / 2) + "px;top:" + -CH / 2 + "px;width:" + f2(w) + "px;height:" + CH + "px;transform:translateY(" + -CH / 2 + "px) rotateY(" + th + "deg) translateZ(" + CR + "px)"), th: th * deg });
}
el("saucer", cupG, "left:-180px;top:-180px;width:360px;height:360px;transform:translateY(-1px) rotateX(90deg)");
var handle = el("handle", cupG, "left:-34px;top:-38px;width:68px;height:76px;transform:translate3d(" + (CR + 26) + "px,-48px,0px) rotateY(90deg)");
var tea = el("tea", cupG, "left:-88px;top:-88px;width:176px;height:176px;transform:translateY(-76px) rotateX(90deg)");
// the table lives in its own 3D context (#ground) so it can never sort in front of the cup
var table = el("table", $("ground"), "left:-2400px;top:-2400px;width:4800px;height:4800px;transform:rotateX(90deg)");

// ---- the mind: the pattern (two eyes and a nine-point smile) and decoys. Each card's pin is placed so that from the
// true viewpoint (yaw 0, elev 0, dist = PERSP, target C) it projects to its point of the pattern, whatever its depth.
var C = [0, 1400, 0];
function anamorph(sx, sy, z) { var k = (PERSP - z) / PERSP; return [C[0] + sx * k, C[1] + sy * k, C[2] + z]; }
var PATTERN = [[-165, -150], [165, -150]].concat([0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (m) { // eyes, then the smile left to right
  var a = (25 + m * 16.25) * deg; return [-300 * Math.cos(a), 70 + 190 * Math.sin(a)];
}));
var CLUES = [
  ["💍", "Ring finger"], ["⌚", "Right wrist"], ["🎟️", "Ticket stub"], ["👞", "Muddy heel"], ["🔑", "Spare key"], ["🖋️", "The note"],
  ["🃏", "Queen of hearts"], ["☕", "Cold tea"], ["📷", "Photograph"], ["🕯️", "Candle wax"], ["🧾", "Receipt, 9:42 pm"],
  ["🌹", "Florist"], ["📞", "Missed call"], ["🧳", "Packed bag"], ["🧤", "One glove"], ["🗝️", "Old lock"], ["📰", "Page 6"], ["🍷", "Two glasses"],
];
var cards = CLUES.map(function (cl, i) {
  var pat = i < PATTERN.length, z = pat ? -950 + 1350 * hash(i + 7) : -1200 + 1700 * hash(i + 31);
  var pin = pat ? anamorph(PATTERN[i][0], PATTERN[i][1], z) : [C[0] + (hash(i + 3) - 0.5) * 2200, C[1] + (hash(i + 5) - 0.5) * 900, C[2] + z];
  var e = el("card", world, "left:-85px;top:-14px;width:170px;height:206px", '<i class="pin"></i><b>' + cl[0] + "</b><span>" + cl[1] + "</span>");
  return { el: e, pin: pin, pat: pat, i: i, ry: (hash(i + 11) - 0.5) * 40, rz: (hash(i + 13) - 0.5) * 14, bob: hash(i + 17) * 6.28 };
});
// the three deductions: which cards, and what they reveal
var DEDS = [{ card: 0, k: "Pale band on the ring finger", v: "Newly divorced." }, { card: 3, k: "Red clay on the heel", v: "He was at the quarry." }, { card: 1, k: "Watch on the right wrist", v: "Left-handed. The note wasn't." }];

function align(t) { return smoother((t - T.align[0]) / (T.align[1] - T.align[0])); }
function poseMind(t, c) {
  var al = align(t), field = smr(t, 5.2, 7.0);
  cards.forEach(function (cd) {
    var bob = 14 * Math.sin(t * 0.7 + cd.bob) * (1 - al), p = cd.pin;
    var ry = cd.ry * (1 - al) - c.yaw * 0.55 * (1 - al), rz = cd.rz * (1 - 0.5 * al);
    var gone = cd.pat ? 0 : smr(t, T.align[0], T.align[0] + 1.2); // the decoys fall away into the dark
    cd.el.style.transform = "translate3d(" + f2(p[0]) + "px," + f2(p[1] + bob + 900 * gone * gone) + "px," + f2(p[2]) + "px) rotateY(" + ry.toFixed(2) + "deg) rotateZ(" + rz.toFixed(2) + "deg)";
    var dim = cd.pat ? 1 - 0.55 * smr(t, T.title - 0.4, T.title + 0.6) : 1 - gone;
    cd.el.style.opacity = (field * dim).toFixed(3);
    cd.el.style.display = field * dim <= 0.002 ? "none" : "block";
  });
}
function pinOf(i, t) { var cd = cards[i], al = align(t); return [cd.pin[0], cd.pin[1] + 14 * Math.sin(t * 0.7 + cd.bob) * (1 - al), cd.pin[2]]; }

// ---- the cup's light, ripples, and the moment the camera goes through the tea
var KEY = V.norm([-0.5, -0.7, 0.5]);
function poseCup(t, c) {
  var cp = camPos(c), under = cp[1] > -165;
  cupG.style.display = table.style.display = under ? "none" : "block";
  if (under) return;
  strips.forEach(function (s) {
    var n = [Math.sin(s.th), 0, Math.cos(s.th)], v = V.norm(V.sub(cp, [n[0] * CR, -45, n[2] * CR]));
    if (V.dot(n, v) <= 0) { s.el.style.visibility = "hidden"; return; }
    s.el.style.visibility = "visible";
    var d = Math.max(0, V.dot(n, KEY)), h = Math.pow(Math.max(0, V.dot(n, V.norm(V.add(KEY, v)))), 30), k = 0.42 + 0.55 * d + 0.5 * h;
    s.el.style.backgroundColor = "rgb(" + [246, 242, 236].map(function (x) { return Math.round(clamp(x * k, 0, 255)); }).join(",") + ")";
  });
  var ph = (t * 34) % 26;
  tea.style.background = "repeating-radial-gradient(circle, rgba(255,210,150,0) 0 " + f2(ph) + "px, rgba(255,214,160," + (0.14 * (0.6 + 0.4 * Math.sin(t * 3))).toFixed(3) + ") " + f2(ph + 2) + "px, rgba(255,210,150,0) " + f2(ph + 6) + "px 26px), radial-gradient(circle at 40% 38%, #8a4b1f, #4a220b 70%)";
}
