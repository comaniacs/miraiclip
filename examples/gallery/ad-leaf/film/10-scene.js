// ---- LEAF: the device, its screen, and 40 pages whose pose is a blend of four states (falling, swirl, docked in
// the device, the orbiting ring), so every hand-over between scenes is continuous by construction. px, y down.
var world = $("world");
function el(cls, parent, css, html) { var e = document.createElement("div"); e.className = cls; if (css) e.style.cssText = css; if (html) e.innerHTML = html; parent.appendChild(e); return e; }
function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
var DW = 300, DH = 420, DD = 14, SW = 260, SH = 360;

// the device: a graphite slab; the front is a bezel around the paper-like screen
var dev = el("g3", world);
var PAGE_HTML = '<div class="pg"><small>CHAPTER ONE</small><b>The Lighthouse Keeper</b><p>The lamp had burned for forty years before anyone thought to ask who kept it. She climbed the stair each evening with a book under her arm, and each evening the sea grew a little quieter, as if it, too, were listening.</p><p>Nobody in the village remembered the first night she read aloud.</p></div>';
var front = el("face front", dev, "left:" + -DW / 2 + "px;top:" + -DH / 2 + "px;width:" + DW + "px;height:" + DH + "px;transform:translateZ(" + DD / 2 + "px)",
  '<div class="screen">' + PAGE_HTML + '<i class="warm"></i><div class="cover"><i class="leafmark"></i><b>LEAF</b><span>your library</span></div><i class="flash"></i></div><div class="slider"><i></i></div>');
var back = el("face back", dev, "left:" + -DW / 2 + "px;top:" + -DH / 2 + "px;width:" + DW + "px;height:" + DH + "px;transform:translateZ(" + -DD / 2 + "px) rotateY(180deg)", '<i class="leafmark big"></i>');
el("face side", dev, "left:" + -DD / 2 + "px;top:" + -DH / 2 + "px;width:" + DD + "px;height:" + DH + "px;transform:translateX(" + DW / 2 + "px) rotateY(90deg)");
el("face side", dev, "left:" + -DD / 2 + "px;top:" + -DH / 2 + "px;width:" + DD + "px;height:" + DH + "px;transform:translateX(" + -DW / 2 + "px) rotateY(-90deg)");
el("face side", dev, "left:" + -DW / 2 + "px;top:" + -DD / 2 + "px;width:" + DW + "px;height:" + DD + "px;transform:translateY(" + -DH / 2 + "px) rotateX(90deg)");
el("face side", dev, "left:" + -DW / 2 + "px;top:" + -DD / 2 + "px;width:" + DW + "px;height:" + DD + "px;transform:translateY(" + DH / 2 + "px) rotateX(-90deg)");
var screen = front.querySelector(".screen");

// the pages: the first carries the chapter; the rest are pages of other books (titles only, text as lines)
var TITLES = ["Chapter One", "Part II", "Prologue", "Chapter 7", "Interlude", "Book Three", "Epilogue", "Chapter 12"];
var pages = [];
for (var k = 0; k < 40; k++) {
  var e = el("page", world, "left:" + -SW / 2 + "px;top:" + -SH / 2 + "px;width:" + SW + "px;height:" + SH + "px", k === 0 ? PAGE_HTML : '<div class="pg"><small>' + TITLES[k % TITLES.length].toUpperCase() + '</small><i class="lines"></i></div>');
  pages.push({ el: e, k: k, a: hash(k) * 2 * Math.PI, r: 520 + 300 * hash(k + 40), y: -500 + 900 * hash(k + 80), tumble: hash(k + 120) * 360, born: 1.6 + 1.8 * hash(k + 160) });
}

function lerpPose(a, b, u) { return { p: [mix(a.p[0], b.p[0], u), mix(a.p[1], b.p[1], u), mix(a.p[2], b.p[2], u)], ry: mix(a.ry, b.ry, u), rx: mix(a.rx, b.rx, u), rz: mix(a.rz, b.rz, u) }; }
function fallPose(t) { return { p: [60 * Math.sin(t * 1.4), mix(-760, -120, smoother(t / 3.6)), 120 * Math.cos(t * 0.9)], ry: 30 * Math.sin(t * 1.8), rx: 18 * Math.sin(t * 2.3), rz: 12 * Math.sin(t * 1.1) }; }
function swirlPose(pg, t) {
  var a = pg.a + 0.9 * t, r = pg.r * mix(1, 0.62, smr(t, 3.4, 6.6)), y = pg.y * mix(1, 0.3, smr(t, 3.4, 6.6));
  return { p: [Math.cos(a) * r, y, Math.sin(a) * r], ry: -a / deg + 90, rx: 20 * Math.sin(t + pg.k), rz: pg.tumble + 40 * t };
}
function dockPose(pg) { return { p: [0, 0, DD / 2 + 1 + pg.k * 0.5], ry: 0, rx: 0, rz: 0 }; }
function ringPose(pg, t, spin) {
  var a = pg.k / 40 * 2 * Math.PI + 0.35 * (t - T.ring[0]) - spin * deg, r = 600 + 40 * Math.sin(pg.k * 1.7);
  return { p: [Math.sin(a) * r, -40 + 120 * Math.sin(pg.k * 2.3 + t * 0.6), Math.cos(a) * r], ry: a / deg, rx: 0, rz: 6 * Math.sin(t + pg.k) };
}
function posePages(t, c, spin) {
  var dock = smoother((t - T.stack[0]) / (T.stack[1] - T.stack[0]));
  pages.forEach(function (pg) {
    var pose, op;
    if (t < T.stack[1]) {
      var sw = swirlPose(pg, t);
      if (pg.k === 0) sw = lerpPose(fallPose(t), sw, smoother((t - 2.9) / 1.3));
      pose = lerpPose(sw, dockPose(pg), dock);
      op = (pg.k === 0 ? 1 : smr(t, pg.born, pg.born + 0.8)) * (1 - smr(t, T.stack[1] - 0.35, T.stack[1]));
    } else {
      // the ring: each page turns off the screen in turn (hinged at its left edge), flies out, orbits, then dives back
      var lag = pg.k * 0.05, out = smoother((t - T.ring[0] - lag) / 1.4), back = smoother((t - T.dive[0] - (40 - pg.k) * 0.03) / (T.dive[1] - T.dive[0] - 1.2));
      // in the device's own space the page hinges on the screen's left edge like a real page turn ...
      var th = -170 * smoother((t - T.turn[0] - lag) / 0.9) * deg;
      var lx = -SW / 2 + SW / 2 * Math.cos(th), lz = DD / 2 + 2 - SW / 2 * Math.sin(th);
      // ... then goes into world space with the device's turn, and blends into its place in the ring
      var s = spin * deg, docked = { p: [lx * Math.cos(s) + lz * Math.sin(s), 0, -lx * Math.sin(s) + lz * Math.cos(s)], ry: th / deg + spin, rx: 0, rz: 0 };
      pose = lerpPose(docked, ringPose(pg, t, spin), out * (1 - back));
      op = smr(t, T.turn[0] + lag, T.turn[0] + lag + 0.15) * (1 - smr(t, T.dive[1] - 0.5, T.dive[1]));
    }
    pg.el.style.display = op <= 0.002 ? "none" : "block";
    pg.el.style.opacity = op.toFixed(3);
    pg.el.style.transform = "translate3d(" + f2(pose.p[0]) + "px," + f2(pose.p[1]) + "px," + f2(pose.p[2]) + "px) rotateY(" + pose.ry.toFixed(2) + "deg) rotateX(" + pose.rx.toFixed(2) + "deg) rotateZ(" + pose.rz.toFixed(2) + "deg)";
  });
}

function poseDevice(t, c, spin) {
  var born = smoother((t - T.stack[0] - 0.6) / 0.9);
  dev.style.transform = "rotateY(" + spin.toFixed(3) + "deg) rotateX(" + (4 * Math.sin(t * 0.5)).toFixed(2) + "deg) scale(" + mix(0.94, 1, born).toFixed(4) + ")";
  // opacity < 1 flattens a preserve-3d group (its back face would paint over its front): fade only while being born
  dev.style.opacity = born >= 0.999 ? "" : born.toFixed(3);
  dev.style.display = born <= 0.001 ? "none" : "block";
  // show only the side that faces the camera: Chrome lets face content escape backface-visibility (see the kit notes)
  var cp = camPos(c), sp = spin * deg, facing = Math.sin(sp) * cp[0] + Math.cos(sp) * cp[2] > 0;
  front.style.visibility = facing ? "visible" : "hidden"; back.style.visibility = facing ? "hidden" : "visible";
  var w = smoother((t - T.warm[0]) / (T.warm[1] - T.warm[0]));
  screen.style.setProperty("--warm", w.toFixed(3));
  front.querySelector(".slider i").style.width = (20 + 80 * w).toFixed(1) + "%";
  front.querySelector(".slider").style.opacity = (smr(t, T.warm[0] - 0.4, T.warm[0]) * (1 - smr(t, T.disc2[1], T.disc2[1] + 0.4))).toFixed(3);
  var fl = Math.exp(-Math.pow((t - T.flash) / 0.18, 2));
  screen.querySelector(".flash").style.opacity = fl.toFixed(3);
  screen.querySelector(".cover").style.opacity = smr(t, T.flash - 0.05, T.flash + 0.1).toFixed(3);
}
