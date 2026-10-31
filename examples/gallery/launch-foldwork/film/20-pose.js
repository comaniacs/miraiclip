// ---- light, shading, drawing, birds and the closing book, all as functions of t
Array.prototype.forEach.call(document.querySelectorAll(".creases path,.creases line,.plan rect,.plan .mark,.plan line"), function (p) { p.setAttribute("pathLength", "1"); });
function draw(elm, u) { elm.style.strokeDasharray = "1 1.02"; elm.style.strokeDashoffset = (1 - c01(u)).toFixed(4); }

// the light: a warm-white key high front-left by day; at dusk it swings low from the right and turns amber
var PAPER = [242, 237, 227];
function duskAt(t) { return smoother((t - T.dusk[0]) / (T.dusk[1] - T.dusk[0])) * (1 - smr(t, T.fold[0] + 0.4, T.close[1])); }
function light(t) {
  var k = duskAt(t), key = V.norm([mix(-0.45, 0.8, k), mix(-0.82, -0.32, k), mix(0.38, 0.3, k)]);
  return { key: key, kd: mix(0.62, 0.5, k), amb: mix(0.4, 0.2, k), tint: [1, mix(1, 0.8, k), mix(1, 0.58, k)], fill: V.norm([0.6, -0.4, -0.6]), dusk: k };
}
function shade(n, L) {
  var d = Math.max(0, V.dot(n, L.key)), f = Math.max(0, V.dot(n, L.fill)) * 0.14;
  var k = L.amb + L.kd * d;
  return "rgb(" + Math.round(Math.min(255, PAPER[0] * k * L.tint[0] + 40 * f)) + "," + Math.round(Math.min(255, PAPER[1] * k * L.tint[1] + 60 * f)) + "," + Math.round(Math.min(255, PAPER[2] * k * L.tint[2] + 110 * f)) + ")";
}

function poseCity(t) {
  var L = light(t);
  buildings.forEach(function (b, i) {
    var appear = smr(t, b.t0 - 0.35, b.t0 - 0.05), gone = t > T.close[0] + 0.6;
    if (appear <= 0 || gone) { b.g.style.display = "none"; b.shadow.style.opacity = 0; return; }
    b.g.style.display = "block";
    var a = foldAngle(b, t) * deg, s = Math.sin(a), c = Math.cos(a);
    b.g.style.transform = "matrix3d(1,0,0,0,0," + c.toFixed(5) + "," + s.toFixed(5) + ",0,0,0,1,0," + b.c[0] + ",-1," + b.c[1] + ",1)";
    b.g.style.opacity = appear.toFixed(3);
    b.f.front.style.backgroundColor = shade([0, -s, c], L);
    b.f.back.style.backgroundColor = shade([0, s, -c], L);
    b.f.left.style.backgroundColor = shade([-1, 0, 0], L);
    b.f.right.style.backgroundColor = shade([1, 0, 0], L);
    b.f.roof.style.backgroundColor = shade([0, -1, 0], L);
    // windows glow in a wave from the river side as the light goes
    var glow = smr(t, T.dusk[0] + 0.6 + 0.12 * ((i * 7) % 16), T.dusk[0] + 1.4 + 0.12 * ((i * 7) % 16)) * (1 - smr(t, T.fold[0], T.fold[0] + 0.8));
    b.g.style.setProperty("--glow", glow.toFixed(3));
    b.shadow.style.opacity = (0.5 * appear * c * (1 - 0.5 * L.dusk)).toFixed(3); // a standing fold casts more contact shadow
  });
  $("dim").style.opacity = $("dimL").style.opacity = (0.62 * L.dusk).toFixed(3);
  rightPage.querySelector(".pool").style.opacity = (1 - 0.6 * L.dusk).toFixed(3);
  return L;
}

// the creases: the first line of light, the streets, and each building's fold lines just before it stands
var firstLine = rightPage.querySelector(".first"), streetEls = rightPage.querySelectorAll(".st"), creaseEls = rightPage.querySelectorAll(".cr");
var planRects = leftPage.querySelectorAll(".plan rect"), planGrid = leftPage.querySelectorAll(".plan .grid line"), markEls = leftPage.querySelectorAll(".plan .mark");
function poseLines(t) {
  draw(firstLine, smoother((t - T.crease[0]) / (T.crease[1] - T.crease[0])));
  firstLine.style.opacity = (1 - smr(t, T.first[1], T.first[1] + 1.2)).toFixed(3);
  Array.prototype.forEach.call(streetEls, function (e, k) { draw(e, smoother((t - T.grid[0] - 0.25 * k) / 1.0)); });
  Array.prototype.forEach.call(planGrid, function (e, k) { draw(e, smoother((t - T.grid[0] - 0.25 * k) / 1.0)); });
  Array.prototype.forEach.call(creaseEls, function (e, i) { draw(e, smoother((t - POP[i] + 0.7) / 0.5)); });
  Array.prototype.forEach.call(planRects, function (e, i) {
    draw(e, smoother((t - POP[i] + 0.5) / 0.6));
    e.classList.toggle("hot", i === 1 && t > T.disc[0] && t < T.disc[1] + 0.3);
  });
  var m = smoother((t - T.mark[0]) / (T.mark[1] - T.mark[0]));
  Array.prototype.forEach.call(markEls, function (e) { draw(e, m); e.style.fillOpacity = (0.9 * smr(t, T.mark[1] - 0.4, T.mark[1] + 0.3)).toFixed(3); });
}

// ---- the paper birds: they lie folded on the left page, lift, and fly through the city along one path
var BIRD_PATH = [[-1380, -3, 380], [-1100, -160, 260], [-500, -300, 80], [300, -380, -60], [900, -330, 120], [1400, -460, -80], [2100, -760, -320]];
var birds = [0, 1, 2].map(function (k) {
  var g = el("g3 bird");
  el("wing", g, "transform:rotateX(90deg)"); el("wing l", g, "transform:rotateX(-90deg)");
  return { g: g, k: k, t0: T.birds[0] + 0.45 * k, off: [k * -70, k * 34, (k - 1) * 120] };
});
var bx = curve(BIRD_PATH.map(function (p, i) { return [i, p[0]]; })), by = curve(BIRD_PATH.map(function (p, i) { return [i, p[1]]; })), bz = curve(BIRD_PATH.map(function (p, i) { return [i, p[2]]; }));
function birdAt(b, t) { // position along the path; before take-off it rests on its spot of the left page
  var u = c01((t - b.t0) / 5.0) * (BIRD_PATH.length - 1), lift = smr(t, b.t0, b.t0 + 0.5);
  return [bx(u) + b.off[0], by(u) + b.off[1] * lift, bz(u) + b.off[2]];
}
function poseBirds(t) {
  birds.forEach(function (b) {
    var p = birdAt(b, t), q = birdAt(b, t + 0.05), v = V.sub(q, p), flying = t > b.t0;
    var gone = t > b.t0 + 5.0 || t > T.fold[0];
    b.g.style.display = gone ? "none" : "block";
    if (gone) return;
    var head = flying && Math.hypot(v[0], v[2]) > 0.01 ? Math.atan2(-v[2], v[0]) : 0.4, pitch = flying ? Math.atan2(v[1], Math.hypot(v[0], v[2]) + 1e-6) : 0;
    var flap = flying ? 34 * Math.sin(2 * Math.PI * 3.1 * (t - b.t0) + b.k) * smr(t, b.t0, b.t0 + 0.4) : 0;
    b.g.style.transform = "translate3d(" + f2(p[0]) + "px," + f2(p[1]) + "px," + f2(p[2]) + "px) rotateY(" + (head / deg).toFixed(2) + "deg) rotateZ(" + (pitch / deg).toFixed(2) + "deg)";
    var w = b.g.children;
    w[0].style.transform = "rotateX(" + (90 + flap).toFixed(2) + "deg)";
    w[1].style.transform = "rotateX(" + (-90 - flap).toFixed(2) + "deg)";
    b.g.style.opacity = (1 - smr(t, b.t0 + 4.4, b.t0 + 5.0)).toFixed(3);
  });
}

// ---- the book closes: the left half swings over the spine, its cover comes up with the mark
function poseBook(t) {
  var u = smoother((t - T.close[0]) / (T.close[1] - T.close[0]));
  var ang = 180 * u - 3 * Math.sin(Math.PI * c01((t - T.close[1]) / 0.35)) * (t > T.close[1] ? 1 : 0); // a small settle as it lands
  leftHalf.style.transform = "rotateZ(" + ang.toFixed(3) + "deg)";
  // whichever side faces up is the one drawn: Chrome doesn't cull the cover's back face reliably (its rotated
  // content escapes backface-visibility), so the swap is explicit, at the moment the half stands on edge
  cover.style.visibility = ang > 90 ? "visible" : "hidden";
  leftPage.style.visibility = ang > 90 ? "hidden" : "visible";
}
