// ---- the product: STILL, a focus dial. Four stacked cylinders built from shaded DOM strips:
//   base   walnut, R 214, y 0 → -30            band   the light slit, R 200, y -30 → -40
//   crown  knurled aluminium, R 210, -40 → -104  glass  frosted glass face, R 188, -104 → -110, with 60 segments
// Every strip is shaded each frame from its world normal, the lights and the camera, so highlights stay put in the
// world while the camera orbits, the way a turned metal part reads on a product shoot.
var DIAL = {
  base: { R: 214, y0: 0, y1: -30, n: 72, rgb: [74, 45, 28], ks: 0.16, p: 10, kd: 0.95 },
  band: { R: 200, y0: -30, y1: -40, n: 48 },
  crown: { R: 210, y0: -40, y1: -104, n: 84, rgb: [62, 64, 69], ks: 1.05, p: 46, ks2: 0.22, p2: 5, kd: 0.7 },
  glass: { R: 188, y0: -104, y1: -110, n: 72, rgb: [18, 19, 22], ks: 0.9, p: 70, kd: 0.25 },
};
var TOP_Y = -110, SEG_R = 168;
var world = $("world");
var dialEl = document.createElement("div"); dialEl.className = "g3"; world.appendChild(dialEl);

function el(cls, parent, css) { var e = document.createElement("div"); e.className = cls; if (css) e.style.cssText = css; parent.appendChild(e); return e; }
function cylinder(name) {
  var d = DIAL[name], g = el("g3", dialEl), h = d.y0 - d.y1, w = 2 * Math.PI * d.R / d.n + 0.8, strips = [];
  for (var i = 0; i < d.n; i++) {
    var th = (i / d.n) * 360;
    var s = el("strip s-" + name, g, "left:" + f2(-w / 2) + "px;top:" + f2(-h / 2) + "px;width:" + f2(w) + "px;height:" + h + "px;transform:translateY(" + f2((d.y0 + d.y1) / 2) + "px) rotateY(" + th.toFixed(3) + "deg) translateZ(" + d.R + "px);background-position:" + f2(-i * (w - 0.8)) + "px 0");
    strips.push({ el: s, th: th * deg });
  }
  var top = el("top t-" + name, g, "left:" + -d.R + "px;top:" + -d.R + "px;width:" + 2 * d.R + "px;height:" + 2 * d.R + "px;transform:translateY(" + d.y1 + "px) rotateX(90deg)");
  return { g: g, d: d, strips: strips, top: top };
}
var base = cylinder("base"), band = cylinder("band"), crown = cylinder("crown"), glass = cylinder("glass");

// the crown's top: brushed aluminium, with the index mark that turns with the dial
var marker = el("marker", crown.top);
// the glass face: 60 segments, one per minute, and a soft glow under the glass
var faceGlow = el("faceglow", glass.top), segs = [];
for (var i = 0; i < 60; i++) segs.push(el("seg", glass.top, "transform:rotate(" + i * 6 + "deg) translateY(" + -SEG_R + "px)"));
el("dot", glass.top);

// ---- lights, all fixed in the world: a key from the front left (it sweeps in during the reveal), a cool rim from
// behind right, and a blue spill from the notification cards in the payoff
function keyDir(t) {
  var phi = mix(-205, -48, smoother((t - T.lightOn[0]) / (T.lightOn[1] - T.lightOn[0]))) * deg, el_ = 42 * deg;
  return V.norm([Math.sin(phi) * Math.cos(el_), -Math.sin(el_), Math.cos(phi) * Math.cos(el_)]);
}
function keyAmt(t) { return mix(0.05, 1, smr(t, T.lightOn[0], T.lightOn[0] + 0.9)); }
var RIM = V.norm([0.75, -0.35, -0.6]);
function rimAmt(t) { return 0.55 * smr(t, 3.9, 5.6); }
function blueAmt(t) { return smr(t, T.pings[0] - 0.2, T.pings[4]) * (1 - smr(t, T.wave, T.wave + 1.1)); }

// ---- the dial's state over the film
function explodeAmt(t) { return smoother((t - T.explode[0]) / (T.explode[1] - T.explode[0])) * (1 - Math.pow(c01((t - T.assemble[0]) / (T.assemble[1] - T.assemble[0])), 2.4)); }
function turnU(t) { return turnEase((t - T.turn[0]) / (T.turn[1] - T.turn[0])); }
function minutesSet(t) { return T.minutes * turnU(t); }
function crownSpin(t) { return 6 * minutesSet(t) + 4 * smr(t, T.turnIn, T.turn[0]) * (1 - turnU(t)); } // a small grip twist before the turn
// segment i's light, 0..1.4 (above 1 is the hot leading edge)
function segLevel(i, t) {
  if (t < T.ringFull) {
    var drawn = 3 + 57 * drawEase((t - T.drawStart) / (T.drawEnd - T.drawStart));
    if (i >= drawn) return 0;
    var age = drawn - i;
    return 0.75 + 0.65 * Math.exp(-age / 2.2);
  }
  var idle = mix(1, 0.1, smr(t, 3.9, 6.2)); // the full ring flashes, then settles to an idle glow
  var flash = 0.5 * Math.exp(-Math.max(0, t - T.ringFull) * 4) * (t >= T.ringFull ? 1 : 0);
  if (t < T.turn[0]) return idle + flash;
  var m = minutesSet(t);
  if (i >= Math.ceil(m - 1e-6)) return 0.1;
  var lv = i < m - 1 ? 1 : 0.4 + 0.6 * c01(m - i);
  if (t < T.turn[1] + 0.05 && m - i < 1.5) lv += 0.45; // the newest segment is hot while the dial turns
  if (i === T.minutes - 1 && t > T.countdown) lv = 0.55 + 0.45 * Math.cos(2 * Math.PI * (t - T.countdown) / 2.2); // counting down
  return lv + 0.35 * Math.exp(-Math.abs(t - T.wave) * 3);
}
function litShare(t) { var s = 0; for (var i = 0; i < 60; i++) s += Math.min(1, segLevel(i, t)); return s / 60; }
function bandGlow(t) {
  var g = t < T.ringFull ? 0.12 * litShare(t) : mix(1.3, 0.42, smr(t, T.ringFull, 5.8));
  g += 0.35 * c01(minutesSet(t) / T.minutes) * smr(t, T.turn[0], T.turn[1]);
  g += 0.9 * Math.exp(-Math.max(0, t - T.wave) * 2.2) * smr(t, T.wave - 0.25, T.wave);
  return g;
}

var AMBER = [255, 168, 72], HOT = [255, 236, 200];
function rgb(c, k) { return "rgb(" + Math.round(clamp(c[0] * k, 0, 255)) + "," + Math.round(clamp(c[1] * k, 0, 255)) + "," + Math.round(clamp(c[2] * k, 0, 255)) + ")"; }
function shadeStrip(s, cyl, lift, cam, L) {
  var d = cyl.d, n = [Math.sin(s.th), 0, Math.cos(s.th)], p = [n[0] * d.R, (d.y0 + d.y1) / 2 - lift, n[2] * d.R];
  var v = V.norm(V.sub(cam, p));
  if (V.dot(n, v) < -0.05) return; // facing away: hidden by backface-visibility anyway
  var dif = Math.max(0, V.dot(n, L.key)) * L.ka, hk = V.norm(V.add(L.key, v)), hr = V.norm(V.add(RIM, v));
  var spec = Math.pow(Math.max(0, V.dot(n, hk)), d.p) * d.ks * L.ka + Math.pow(Math.max(0, V.dot(n, hr)), d.p) * d.ks * 0.7 * L.ra;
  if (d.ks2) spec += Math.pow(Math.max(0, V.dot(n, hk)), d.p2) * d.ks2 * L.ka;
  var rim = Math.pow(Math.max(0, V.dot(n, RIM)), 2) * L.ra * 0.5, blue = Math.max(0, 0.5 + 0.5 * n[2]) * L.ba;
  var amb = 0.07 + 0.25 * L.glow * (cyl === base ? 1 : 0.35); // the band's glow lights the walnut just below it
  var k = amb + d.kd * dif + rim;
  var c = [d.rgb[0] * k + 255 * spec + 40 * blue, d.rgb[1] * k + 245 * spec + 70 * blue, d.rgb[2] * k + 235 * spec + 130 * blue];
  s.el.style.backgroundColor = "rgb(" + Math.round(clamp(c[0], 0, 255)) + "," + Math.round(clamp(c[1], 0, 255)) + "," + Math.round(clamp(c[2], 0, 255)) + ")";
}
// conic angle (CSS: 0deg = face-up = world -z, clockwise toward world +x) of a horizontal world direction
function faceAngle(dir) { return Math.atan2(dir[0], -dir[2]) / deg; }

function poseDial(t, c) {
  var cam = camPos(c), e = explodeAmt(t);
  var L = { key: keyDir(t), ka: keyAmt(t), ra: rimAmt(t), ba: blueAmt(t), glow: bandGlow(t) };
  var lifts = { base: 0, band: 34 * e, crown: 78 * e, glass: 168 * e };
  [base, band, crown, glass].forEach(function (cyl) {
    var name = cyl === base ? "base" : cyl === band ? "band" : cyl === crown ? "crown" : "glass";
    cyl.g.style.transform = "translateY(" + f2(-lifts[name]) + "px)";
    if (cyl !== band) cyl.strips.forEach(function (s) { shadeStrip(s, cyl, lifts[name], cam, L); });
  });
  // the light slit: emissive, brighter at its centre line
  var gl = L.glow, bandCss = "linear-gradient(180deg," + rgb(AMBER, 0.35 * gl) + "," + rgb(HOT, Math.min(1, 0.95 * gl)) + " 50%," + rgb(AMBER, 0.35 * gl) + ")";
  band.strips.forEach(function (s) { s.el.style.background = bandCss; });
  band.top.style.background = "radial-gradient(circle,transparent 0 86%," + rgb(AMBER, 0.6 * gl) + " 88% 100%)";
  // knurl slides round as the crown turns; the index mark turns with it
  var spin = crownSpin(t), shift = -spin * deg * DIAL.crown.R;
  crown.strips.forEach(function (s, i) { s.el.style.backgroundPosition = f2(shift - i * 2 * Math.PI * DIAL.crown.R / DIAL.crown.n) + "px 0"; });
  marker.style.transform = "rotate(" + spin.toFixed(2) + "deg) translateY(-200px)";
  // brushed tops: a conic highlight along the half vector, like light on a lathe-turned face
  var top = [0, -1, 0], hv = V.norm(V.add(L.key, V.norm(V.sub(cam, [0, -104, 0]))));
  var a = faceAngle(hv), hi = 0.18 + 0.55 * L.ka * Math.pow(Math.max(0, V.dot(top, hv)), 2), lo = 0.06 + 0.08 * L.ka;
  var g = function (k) { return rgb([92, 95, 101], k / 0.35); };
  crown.top.style.background = "repeating-radial-gradient(circle,rgba(255,255,255,0.035) 0 1px,rgba(0,0,0,0.05) 1px 3px),conic-gradient(from " + a.toFixed(1) + "deg," + g(hi) + "," + g(lo) + " 35deg," + g(lo * 1.6) + " 90deg," + g(lo) + " 145deg," + g(hi) + " 180deg," + g(lo) + " 215deg," + g(lo * 1.6) + " 270deg," + g(lo) + " 325deg," + g(hi) + ")";
  base.top.style.background = "repeating-radial-gradient(circle at 46% 54%,rgba(0,0,0,0.12) 0 2px,transparent 2px 9px)," + rgb(DIAL.base.rgb, 0.12 + 0.6 * L.ka * Math.max(0, -L.key[1]) + 0.35 * L.glow);
  // the glass: a dark frosted face with a sheen that slides with the view
  var sheen = 0.04 + 0.1 * L.ka;
  glass.top.style.background = "linear-gradient(" + (a + 90).toFixed(1) + "deg,rgba(255,255,255,0) 30%,rgba(255,246,236," + sheen.toFixed(3) + ") 48%,rgba(255,255,255,0) 66%),radial-gradient(circle,#17181b 0 62%,#101114 100%)";
  var share = 0;
  for (var i = 0; i < 60; i++) {
    var lv = segLevel(i, t), u = Math.min(1, lv), hot = c01(lv - 1) / 0.4, s = segs[i].style;
    share += u;
    s.background = lv < 0.12 ? "rgba(255,190,120," + (0.08 + 0.6 * lv).toFixed(3) + ")" : rgb([mix(AMBER[0], HOT[0], hot), mix(AMBER[1], HOT[1], hot), mix(AMBER[2], HOT[2], hot)], 0.35 + 0.65 * u);
    s.boxShadow = lv < 0.12 ? "none" : "0 0 " + f2(6 + 10 * u) + "px rgba(255,150,50," + (0.55 * u).toFixed(3) + ")";
  }
  faceGlow.style.opacity = (0.15 + 0.85 * share / 60).toFixed(3);
  return L;
}
