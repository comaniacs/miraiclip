// ---- motion graphics: the fold annotation (an angle arc and a counter pinned to the tower's hinge), the coral line
// (plan → tower in the discovery, the birds' trail in the transformation), and the type. lineIO / fadeIO / drawLine
// come from the kit.
var line = $("kline"), arcPath = $("arc"), arcLab = $("arclab");
function poseAnnotation(t, c) {
  var b = buildings[1], on = smr(t, T.tower[0] - 0.2, T.tower[0] + 0.3) * (1 - smr(t, T.disc[1] - 0.3, T.disc[1] + 0.2));
  if (on <= 0) { arcPath.style.opacity = 0; arcLab.style.opacity = 0; return; }
  var a = foldAngle(b, t) * deg, open = Math.PI / 2 - a, R = 110, H = [b.c[0] + b.c[2] / 2, 0, b.c[1] - b.c[3] / 2];
  var pts = [];
  for (var k = 0; k <= 16; k++) { var th = open * k / 16; pts.push(project([H[0], -R * Math.sin(th), H[2] - R * Math.cos(th)], c)); }
  arcPath.setAttribute("d", "M" + pts.map(function (p) { return f2(p.x) + " " + f2(p.y); }).join(" L"));
  arcPath.style.opacity = on.toFixed(3);
  var mid = project([H[0] + 30, -R * 1.25 * Math.sin(open / 2), H[2] - R * 1.25 * Math.cos(open / 2)], c);
  arcLab.style.transform = "translate(" + f2(mid.x + 14) + "px," + f2(mid.y - 30) + "px)";
  arcLab.style.opacity = on.toFixed(3);
  $("arcv").textContent = Math.round(clamp(open / deg, 0, 99)) + "°";
}
function poseLine(t, c) {
  var tw = buildings[1], a = foldAngle(tw, t) * deg;
  if (t > T.tower[0] && t < T.disc[1] + 0.5) { // from the tower's rectangle on the plan to the real tower's roof
    var from = [tw.c[0] - PW, 0, tw.c[1]], top = [tw.c[0], -tw.c[4] * Math.cos(a), tw.c[1] - tw.c[4] * Math.sin(a)];
    drawLine(line, [from, [(from[0] + top[0]) / 2, -520, tw.c[1]], top], c, smoother((t - T.tower[0] - 0.4) / 1.2), 1 - smr(t, T.disc[1] - 0.2, T.disc[1] + 0.4));
  } else if (t > T.birds[0] && t < T.birds[1]) { // the lead bird's trail
    var pts = [];
    for (var k = 12; k >= 0; k--) pts.push(birdAt(birds[0], Math.max(T.birds[0], t - k * 0.11)));
    drawLine(line, pts, c, 1, smr(t, T.birds[0] + 0.3, T.birds[0] + 0.8) * (1 - smr(t, T.birds[1] - 0.8, T.birds[1])));
  } else line.style.opacity = 0;
}
function poseType(t) {
  lineIO("h1a", T.hook, t); lineIO("h1b", [T.hook[0] + 0.2, T.hook[1] + 0.05], t);
  lineIO("h2a", T.intro, t); lineIO("h2b", [T.intro[0] + 0.2, T.intro[1] + 0.05], t);
  lineIO("h3a", T.disc, t); lineIO("h3b", [T.disc[0] + 0.2, T.disc[1] + 0.05], t);
  lineIO("h4a", T.trans, t); lineIO("h4b", [T.trans[0] + 0.2, T.trans[1] + 0.05], t);
  lineIO("h5a", T.reveal, t); lineIO("h5b", [T.reveal[0] + 0.2, T.reveal[1] + 0.05], t);
  lineIO("tag", [T.tag, 99], t);
  fadeIO("cta", T.cta, 99, t, 10);
}
