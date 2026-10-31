// ---- the book and the city. Coordinates: px, y down; the book lies on y = 0 with the spine on the z axis.
// Right page x 0…1600, left page x −1600…0, both z −550…550. Everything is set from t; nothing is carried over.
var world = $("world");
function el(cls, parent, css, html) { var e = document.createElement("div"); e.className = cls; if (css) e.style.cssText = css; if (html) e.innerHTML = html; (parent || world).appendChild(e); return e; }
var PW = 1600, PH = 1100, BLOCK = 30;

// ---- the right half: page (with the crease lines) and the edge of the book block under it
var rightPage = el("page right", world, "left:0;top:" + -PH / 2 + "px;width:" + PW + "px;height:" + PH + "px;transform:rotateX(90deg)");
var creaseSvg = '<svg class="creases" width="' + PW + '" height="' + PH + '" viewBox="0 0 ' + PW + " " + PH + '">';
CITY.forEach(function (c, i) { // each building's fold lines: its base front edge and back edge, then the roof line
  var x0 = c[0] - c[2] / 2, x1 = c[0] + c[2] / 2, zf = c[1] + PH / 2 + c[3] / 2, zb = c[1] + PH / 2 - c[3] / 2;
  creaseSvg += '<path class="cr" data-i="' + i + '" d="M' + x0 + " " + zf + "H" + x1 + "M" + x0 + " " + zb + "H" + x1 + '"/>';
});
// the streets: a few long creases the city stands between
var STREETS = [[0, 470, PW, 470], [0, 690, PW, 690], [470, 0, 470, PH], [880, 0, 880, PH], [1330, 0, 1330, PH]];
STREETS.forEach(function (s, k) { creaseSvg += '<line class="st" data-k="' + k + '" x1="' + s[0] + '" y1="' + s[1] + '" x2="' + s[2] + '" y2="' + s[3] + '"/>'; });
creaseSvg += '<path class="first" d="M' + (CITY[0][0] - 260) + " " + (CITY[0][1] + PH / 2 + CITY[0][3] / 2) + "H" + (CITY[0][0] + 260) + '"/></svg>';
rightPage.innerHTML = '<div class="pool"></div>' + creaseSvg + '<div class="dim" id="dim"></div>';
function blockFace(parent, x, z, w, rotY) { return el("edge", parent, "left:" + -w / 2 + "px;top:0;width:" + w + "px;height:" + BLOCK + "px;transform:translate3d(" + x + "px,0px," + z + "px) rotateY(" + rotY + "deg)"); }
blockFace(world, PW / 2, PH / 2, PW, 0); blockFace(world, PW, 0, PH, 90); blockFace(world, PW / 2, -PH / 2, PW, 180);

// ---- the left half, hinged on the spine: the plan on its page, the cover underneath, the block's edges
var leftHalf = el("g3 lefthalf", world, "transform-origin:0 0");
var plan = '<svg class="plan" width="' + PW + '" height="' + PH + '" viewBox="0 0 ' + PW + " " + PH + '">';
plan += '<g class="grid">' + STREETS.map(function (s) { return '<line x1="' + s[0] + '" y1="' + s[1] + '" x2="' + s[2] + '" y2="' + s[3] + '"/>'; }).join("") + "</g>";
CITY.forEach(function (c, i) { plan += '<rect data-i="' + i + '" x="' + (c[0] - c[2] / 2) + '" y="' + (c[1] + PH / 2 - c[3] / 2) + '" width="' + c[2] + '" height="' + c[3] + '"/>'; });
// the Foldwork mark: a square whose top-right corner is folded down along the diagonal
var MARK = "M690 410H860L910 460V640H690Z", MARK_FOLD = "M860 410V460H910";
plan += '<path class="mark" d="' + MARK + '"/><path class="mark fold" d="' + MARK_FOLD + '"/><text class="plan-label" x="80" y="1040">FOLDWORK · PLAN 01 · RIVERSIDE</text></svg>';
var leftPage = el("page left", leftHalf, "left:" + -PW + "px;top:" + -PH / 2 + "px;width:" + PW + "px;height:" + PH + "px;transform:rotateX(90deg)", plan + '<div class="dim" id="dimL"></div>');
var cover = el("cover", leftHalf, "left:" + -PW + "px;top:" + -PH / 2 + "px;width:" + PW + "px;height:" + PH + "px;transform:translateY(" + BLOCK + "px) rotateX(-90deg)",
  '<div class="cover-in"><svg class="foil" width="300" height="300" viewBox="660 380 280 290"><path d="' + MARK + '"/><path class="fold" d="' + MARK_FOLD + 'Z"/></svg><b>FOLDWORK</b><span>Every world starts flat.</span></div>');
blockFace(leftHalf, -PW / 2, PH / 2, PW, 0); blockFace(leftHalf, -PW, 0, PH, -90); blockFace(leftHalf, -PW / 2, -PH / 2, PW, 180);

// ---- the buildings: a pop-up box shears flat like the real mechanism. Front and back hinge on their base edges,
// the roof stays level and slides back, the sides become parallelograms. One matrix3d does it:
//   x' = x;  y' = y·cos a;  z' = z + y·sin a   (a = 0 standing, a → 90° flat; y is up-negative)
var POP = popTimes();
var buildings = CITY.map(function (c, i) {
  var g = el("g3 bld"), w = c[2], d = c[3], h = c[4], f = {};
  var win = function (len) { return '<i class="wins" style="background-size:' + (len > 120 ? 26 : 22) + 'px 30px"></i><i class="glow"></i>'; };
  f.front = el("face", g, "left:" + -w / 2 + "px;top:" + -h + "px;width:" + w + "px;height:" + h + "px;transform:translateZ(" + d / 2 + "px)", win(w));
  f.back = el("face", g, "left:" + -w / 2 + "px;top:" + -h + "px;width:" + w + "px;height:" + h + "px;transform:translateZ(" + -d / 2 + "px) rotateY(180deg)", win(w));
  f.left = el("face", g, "left:" + -d / 2 + "px;top:" + -h + "px;width:" + d + "px;height:" + h + "px;transform:translateX(" + -w / 2 + "px) rotateY(-90deg)", win(d));
  f.right = el("face", g, "left:" + -d / 2 + "px;top:" + -h + "px;width:" + d + "px;height:" + h + "px;transform:translateX(" + w / 2 + "px) rotateY(90deg)", win(d));
  f.roof = el("face roof", g, "left:" + -w / 2 + "px;top:" + -d / 2 + "px;width:" + w + "px;height:" + d + "px;transform:translateY(" + -h + "px) rotateX(90deg)");
  var shadow = el("shadow", rightPage, "left:" + (c[0] - w / 2 - 10) + "px;top:" + (c[1] + PH / 2 - d / 2 - 10) + "px;width:" + (w + 20) + "px;height:" + (d + 20) + "px");
  return { g: g, f: f, c: c, t0: POP[i], shadow: shadow, slow: i === 1 };
});
/** a paper spring: 0 → 1 with one soft overshoot */
function spring(u) { u = Math.max(0, u); return u >= 2.5 ? 1 : 1 - Math.exp(-6 * u) * Math.cos(7.5 * u); }
function foldAngle(b, t) { // 88° flat → 0° standing, and back down at the end in a wave from the far side
  var dur = b.slow ? T.tower[1] - T.tower[0] : 0.9, up = spring((t - b.t0) / dur * (b.slow ? 1.4 : 2.2));
  var a = mix(88, 0, up), down = smoother((t - T.fold[0] - (1 - b.c[0] / PW) * 0.7) / 0.7);
  return mix(a, 88, down);
}
