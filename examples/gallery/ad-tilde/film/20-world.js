// ---- bubbles (camera-facing glass discs), the hero bubble and its pop, and the citrus slices that orbit the can
function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function face(c) { return " rotateY(" + (-c.yaw).toFixed(2) + "deg) rotateX(" + c.elev.toFixed(2) + "deg)"; } // turn a plane to the camera

// the hero bubble: rises from below the frame, wobbling, and pops at the lid at T.pop
var hero = el("bubble hero", world, "left:-46px;top:-46px;width:92px;height:92px"), ring = el("popring", world, "left:-60px;top:-60px;width:120px;height:120px");
function heroAt(t) { var u = c01(t / T.pop); return [16 * Math.sin(t * 2.3), mix(260, -452, 1 - Math.pow(1 - u, 1.6)), 210 - 200 * smoother(u) + 10 * Math.cos(t * 1.7)]; }

// the stream: 46 small bubbles rising around the can on loops; they appear with the light
var stream = [];
for (var k = 0; k < 46; k++) {
  var sz = 10 + 26 * hash(k), b = el("bubble", world, "left:" + f2(-sz / 2) + "px;top:" + f2(-sz / 2) + "px;width:" + f2(sz) + "px;height:" + f2(sz) + "px");
  stream.push({ el: b, a: hash(k + 50) * 2 * Math.PI, r: 190 + 260 * hash(k + 90), speed: 120 + 160 * hash(k + 130), ph: hash(k + 170) * 700 });
}
function poseBubbles(t, c) {
  var f = face(c), p = heroAt(t), popU = c01((t - T.pop) / 0.5);
  hero.style.display = t < T.pop ? "block" : "none";
  hero.style.transform = "translate3d(" + f2(p[0]) + "px," + f2(p[1]) + "px," + f2(p[2]) + "px)" + f + " scale(" + (1 - 0.25 * smr(t, T.pop - 0.15, T.pop)).toFixed(3) + ")";
  ring.style.display = t >= T.pop && popU < 1 ? "block" : "none";
  ring.style.transform = "translate3d(0px,-452px,10px)" + f + " scale(" + (0.6 + 4.5 * expOut(popU)).toFixed(3) + ")";
  ring.style.opacity = (1 - popU).toFixed(3);
  var vis = smr(t, T.pop + 0.2, T.pop + 1.6) * (1 - 0.4 * smr(t, T.facts[0], T.facts[0] + 0.5) * (1 - smr(t, T.wrap[0], T.wrap[1]))), boost = 1 + 1.6 * Math.exp(-Math.pow((t - T.burst[0] - 0.6) / 0.7, 2));
  stream.forEach(function (s, i) {
    var y = 60 - ((s.ph + s.speed * t * boost) % 760), a = s.a + 0.12 * t;
    s.el.style.transform = "translate3d(" + f2(Math.cos(a) * s.r) + "px," + f2(y) + "px," + f2(Math.sin(a) * s.r) + "px)" + f;
    s.el.style.opacity = (vis * smr(-y, 0, 80) * (1 - smr(-y, 620, 700))).toFixed(3);
  });
}

// the citrus: three lemon and three lime slices drop in, orbit and tumble, then settle out of frame
var SLICES = [0, 1, 2, 3, 4, 5].map(function (k) {
  var lime = k % 2, sz = lime ? 130 : 160, e = el("slice " + (lime ? "lime" : "lemon"), world, "left:" + -sz / 2 + "px;top:" + -sz / 2 + "px;width:" + sz + "px;height:" + sz + "px");
  return { el: e, k: k, a0: k * 60 * deg, r: 330 + 50 * (k % 3), y: -110 - 60 * k, t0: T.citrus[0] + 0.18 * k };
});
function poseCitrus(t) {
  SLICES.forEach(function (s) {
    var din = smoother((t - s.t0) / 0.9), dout = smoother((t - T.citrus[1] - 0.1 * s.k) / 1.0);
    if (din <= 0 || dout >= 1) { s.el.style.display = "none"; return; }
    s.el.style.display = "block";
    var a = s.a0 + 0.55 * (t - s.t0), y = mix(-900, s.y, din) - 700 * dout * dout;
    s.el.style.transform = "translate3d(" + f2(Math.cos(a) * s.r) + "px," + f2(y) + "px," + f2(Math.sin(a) * s.r) + "px) rotateY(" + f2(-a / deg + 90) + "deg) rotateX(" + f2(25 * Math.sin(t * 1.3 + s.k)) + "deg) rotateZ(" + f2(40 * t + s.k * 30) + "deg)";
    s.el.style.opacity = (din * (1 - dout)).toFixed(3);
  });
}
