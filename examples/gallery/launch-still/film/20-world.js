// ---- the world around the dial: a dark desk that falls away into the ground colour, the dial's own light on it,
// and the noise: notification cards that pop in around it and are swept away by the ring of light.
// The floor's decorations are flat children of the floor plane, so they never sort against each other.
var FLOOR = 9000, FC = FLOOR / 2;
// the floor lives in its own 3D context (#ground, drawn first with the same camera), so it can never sort in front of
// the dial: Chrome splits and orders planes of one context by depth, and a 9000 px plane under a small object loses that
var ground = $("ground");
var floor = el("floor", ground, "left:" + -FC + "px;top:" + -FC + "px;width:" + FLOOR + "px;height:" + FLOOR + "px;transform:rotateX(90deg)");
function fl(cls, size) { return el(cls, floor, "left:" + (FC - size / 2) + "px;top:" + (FC - size / 2) + "px;width:" + size + "px;height:" + size + "px"); }
var pool = fl("pool", 3200), cool = fl("cool", 3600), halo = fl("halo", 1300), shadow = fl("shadow", 520);
var waves = [fl("wave", 100), fl("wave w2", 100)];

function waveR(t, lag) { var u = (t - T.wave - lag) / 2.1; return u <= 0 ? 0 : 230 + 3000 * (1 - Math.pow(1 - c01(u), 2.6)); }
function poseWorld(t, c, L) {
  pool.style.opacity = (0.25 + 0.75 * L.ka).toFixed(3);
  pool.style.transform = "scale(" + (1 + 0.55 * smr(t, T.wave, T.waveEnd)).toFixed(3) + ")"; // the warm light spreads with the wave
  cool.style.opacity = (0.9 * L.ba).toFixed(3);
  halo.style.opacity = Math.min(1, 0.55 * L.glow).toFixed(3);
  halo.style.transform = "scale(" + (0.8 + 0.25 * Math.min(1.4, L.glow)).toFixed(3) + ")";
  shadow.style.opacity = (0.35 + 0.6 * L.ka).toFixed(3);
  waves.forEach(function (w, k) {
    var r = waveR(t, k * 0.32), u = c01((t - T.wave - k * 0.32) / 2.1);
    w.style.opacity = r === 0 ? 0 : ((1 - Math.pow(u, 0.8)) * (k ? 0.5 : 0.95)).toFixed(3);
    w.style.transform = "scale(" + (r / 50).toFixed(3) + ")";
    w.style.borderWidth = f2(Math.max(0.6, 3.4 - 2.6 * u) * 50 / Math.max(50, r) * 2) + "px";
  });
}

// ---- the cards: where each floats (angle round the dial, distance, height), and what it says. Generic apps only.
var CARDS = [
  { a: -58, r: 760, y: -250, k: "Mail", v: "12 new messages", c: "#4d8dff" },
  { a: 128, r: 700, y: -330, k: "Team chat", v: "You were mentioned in #launch", c: "#8f6bff" },
  { a: 38, r: 880, y: -210, k: "Calendar", v: "Standup moved to 10:30", c: "#ff6b6b" },
  { a: -122, r: 820, y: -360, k: "Shop", v: "Sale ends tonight", c: "#ffb648" },
  { a: 170, r: 1020, y: -250, k: "Social", v: "38 people liked your post", c: "#ff5fa8" },
  { a: -88, r: 1240, y: -300, k: "News", v: "5 stories picked for you", c: "#3fc7c9" },
  { a: 84, r: 1180, y: -380, k: "Updates", v: "Restart to finish installing", c: "#9aa3b2" },
  { a: -160, r: 1150, y: -230, k: "Reminder", v: "Reply to Sam", c: "#ffd34d" },
];
var cardsEl = el("g3", world);
CARDS.forEach(function (cd, i) {
  cd.x = Math.sin(cd.a * deg) * cd.r; cd.z = Math.cos(cd.a * deg) * cd.r; cd.t = T.pings[i];
  cd.el = el("card", cardsEl);
  cd.el.innerHTML = '<i class="ic" style="background:' + cd.c + '"></i><div class="ct"><b>' + cd.k + '</b><span>' + cd.v + '</span></div><em>now</em>';
});
// when the wave's front reaches a card (its distance on the floor), the card tips back and falls out of the light
function cardHit(cd) { var a = 0, b = 2.1; for (var i = 0; i < 30; i++) { var m = (a + b) / 2; if (waveR(T.wave + m, 0) < cd.r) a = m; else b = m; } return T.wave + (a + b) / 2; }
CARDS.forEach(function (cd) { cd.hit = cardHit(cd); });

function poseCards(t, c) {
  CARDS.forEach(function (cd, i) {
    var u = smoother((t - cd.t) / 0.38), pop = expOut((t - cd.t) / 0.3), f = c01((t - cd.hit) / 0.6), fe = f * f;
    if (t < cd.t - 0.01 || f >= 1) { cd.el.style.display = "none"; return; }
    cd.el.style.display = "block";
    var bob = 8 * Math.sin(2 * Math.PI * (t - cd.t) / (2.6 + i * 0.17) + i);
    var y = cd.y + (1 - u) * 50 + bob + fe * 120;
    // face the camera, tipped a little so they read as objects in the space, and tipping back as the light hits
    cd.el.style.transform = "translate3d(" + f2(cd.x) + "px," + f2(y) + "px," + f2(cd.z) + "px) rotateY(" + (-c.yaw + (i % 2 ? 7 : -7)).toFixed(2) + "deg) rotateX(" + (c.elev - 10 + 75 * fe).toFixed(2) + "deg) scale(" + (mix(0.7, 1, pop) * (1 - 0.15 * f)).toFixed(3) + ")";
    cd.el.style.opacity = (u * (1 - f)).toFixed(3);
    cd.el.style.setProperty("--warm", (Math.exp(-Math.abs(t - cd.hit) * 8)).toFixed(3)); // a flash of amber as the ring passes through
  });
}
