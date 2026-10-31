// ---- the can: brushed aluminium cylinders of shaded strips, and a printed label of 48 strips that each show one
// slice of the same label design, so the print wraps seamlessly and can peel off, flatten into a card and wrap back.
// Coordinates: px, y down; the can stands on y = 0, its axis on the y axis, 440 px tall.
var world = $("world");
function el(cls, parent, css, html) { var e = document.createElement("div"); e.className = cls; if (css) e.style.cssText = css; if (html) e.innerHTML = html; parent.appendChild(e); return e; }
var can = el("g3", world), N = 48, R = 150;
function cylinder(R, y0, y1, n, cls) {
  var h = y0 - y1, w = 2 * Math.PI * R / n + 0.8, out = [];
  for (var i = 0; i < n; i++) {
    var th = i * 360 / n;
    out.push({ el: el("strip " + cls, can, "left:" + f2(-w / 2) + "px;top:" + f2(-h / 2) + "px;width:" + f2(w) + "px;height:" + h + "px;transform:translateY(" + f2((y0 + y1) / 2) + "px) rotateY(" + th + "deg) translateZ(" + R + "px)"), th: th * deg, R: R, y: (y0 + y1) / 2 });
  }
  return out;
}
var metal = [].concat(cylinder(138, 0, -12, 40, "al"), cylinder(R, -12, -404, N, "al"), cylinder(140, -404, -424, 40, "al"), cylinder(128, -424, -440, 40, "al rim"));
var lid = el("lid", can, "left:-128px;top:-128px;width:256px;height:256px;transform:translateY(-440px) rotateX(90deg)", '<i class="tab"></i><i class="hole"></i>');

// the label: one design, sliced into strips. Strip i (i = −N/2 … N/2−1) sits at angle i·360/N and shows the design
// from x = (i + N/2)·w, so the design's centre (the wordmark) faces +z.
var LW = 2 * Math.PI * (R + 1), SW = LW / N, LY0 = -40, LY1 = -380, LH = LY0 - LY1;
var LABEL = '<div class="label" style="width:' + f2(LW) + 'px;height:' + LH + 'px">' +
  '<i class="sun"></i><i class="wave w1"></i><i class="wave w2"></i>' +
  '<b class="lw" style="left:' + f2(LW / 2) + 'px">TILDE</b><span class="ls" style="left:' + f2(LW / 2) + 'px">SPARKLING CITRUS</span>' +
  '<span class="lm" style="left:' + f2(LW / 2) + 'px">lemon · lime · spring water</span>' +
  '<span class="lb" style="left:' + f2(LW * 0.04) + 'px">330 ml · 0 g sugar</span><span class="lb" style="left:' + f2(LW * 0.96) + 'px">NOTHING TO HIDE</span></div>';
var labelGroup = el("g3", can), label = [];
for (var i = -N / 2; i < N / 2; i++) {
  var s = el("lstrip", labelGroup, "left:" + f2(-SW / 2 - 0.4) + "px;top:" + f2(-LH / 2) + "px;width:" + f2(SW + 0.8) + "px;height:" + LH + "px", LABEL + '<i class="shade"></i>');
  s.firstChild.style.left = f2(-(i + N / 2) * SW) + "px";
  label.push({ el: s, i: i, th: i * 360 / N * deg, shade: s.lastChild });
}

// ---- light: the key comes on with the pop and sweeps from above-left to the front; a cool rim stays behind right
function keyAmt(t) { return mix(0.04, 1, smr(t, T.light[0], T.light[0] + 1.3)); } // a sweep, not a switch: faster reads as a cut
// the key travels with the camera, like a product-shoot key on the camera rig: always 35° to camera-left once lit
function keyDir(t, c) { var a = (mix(-160, -35, smoother((t - T.light[0]) / (T.light[1] - T.light[0]))) - c.yaw) * deg; return V.norm([Math.sin(a) * 0.75, -0.55, Math.cos(a) * 0.75]); }
var RIM = V.norm([0.7, -0.3, -0.65]);

// the label's peel: each strip's progress, the seam (back) first, the front last; it slides left once flat
function peelAt(lb, t) {
  var off = (N / 2 - Math.abs(lb.i)) / (N / 2) * 0.55;
  var out = smoother((t - T.peel[0] - off) / (T.peel[1] - T.peel[0] - 0.55)), back = smoother((t - T.wrap[0] - (0.55 - off)) / (T.wrap[1] - T.wrap[0] - 0.55));
  return out * (1 - back);
}
function slideAt(t) { return smoother((t - T.slide[0]) / (T.slide[1] - T.slide[0])) * (1 - smoother((t - T.wrap[0] + 0.3) / 0.8)); }

function poseCan(t, c, spin) {
  can.style.transform = "rotateY(" + spin.toFixed(3) + "deg)";
  var cam = camPos(c), ka = keyAmt(t), kd = keyDir(t, c), sp = spin * deg;
  metal.forEach(function (s) {
    var a = s.th + sp, n = [Math.sin(a), 0, Math.cos(a)], p = [n[0] * s.R, s.y, n[2] * s.R], v = V.norm(V.sub(cam, p));
    if (V.dot(n, v) < -0.1) return;
    var dif = Math.max(0, V.dot(n, kd)) * ka, h = V.norm(V.add(kd, v)), hr = V.norm(V.add(RIM, v));
    var spec = Math.pow(Math.max(0, V.dot(n, h)), 40) * 1.1 * ka + Math.pow(Math.max(0, V.dot(n, hr)), 30) * 0.6 * ka + Math.pow(Math.max(0, V.dot(n, h)), 4) * 0.2 * ka;
    var k = 0.08 + 0.55 * dif, g = [150 * k + 255 * spec, 160 * k + 250 * spec, 165 * k + 245 * spec];
    s.el.style.backgroundColor = "rgb(" + g.map(function (x) { return Math.round(clamp(x, 0, 255)); }).join(",") + ")";
  });
  lid.style.opacity = 1;
  lid.style.filter = "brightness(" + (0.25 + 0.85 * ka).toFixed(3) + ")";
  var sl = slideAt(t);
  labelGroup.style.transform = "translateX(" + f2(-720 * sl) + "px) translateZ(" + f2(40 * sl) + "px)";
  label.forEach(function (lb) {
    var u = peelAt(lb, t), x = lb.i * SW, th = (1 - u) * lb.th, rz = (R + 1) + u * 30;
    lb.el.style.transform = "translateY(" + (LY0 + LY1) / 2 + "px) translateX(" + f2(u * x) + "px) rotateY(" + (th / deg).toFixed(3) + "deg) translateZ(" + f2(rz) + "px)";
    var a = th + sp, n = [Math.sin(a), 0, Math.cos(a)], dif = Math.max(0, V.dot(n, kd)) * ka;
    // Chrome lets the printed design inside a strip escape backface-visibility, so a strip facing away from the
    // camera is hidden explicitly (its centre, rotated and slid like the strip, seen from the camera)
    var ctr = [Math.cos(sp) * (u * x - 720 * sl) + Math.sin(a) * rz, (LY0 + LY1) / 2, -Math.sin(sp) * (u * x - 720 * sl) + Math.cos(a) * rz];
    lb.el.style.visibility = V.dot(n, V.sub(cam, ctr)) > 0 ? "visible" : "hidden";
    lb.shade.style.opacity = clamp(0.9 - 0.95 * (0.18 + 0.82 * dif), 0, 0.92).toFixed(3);
  });
}
