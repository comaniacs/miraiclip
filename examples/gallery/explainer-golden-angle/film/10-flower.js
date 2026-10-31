// ---- the flower: N seeds by Vogel's model, r = c·√n and angle = n·θ, drawn on a canvas every frame. θ sweeps
// through simple fractions of a turn (spokes) to the golden angle (perfect packing); then the hidden Fibonacci
// spiral families light up arm by arm, and petals grow round the rim.
var cv = $("cv"), ctx = cv.getContext("2d"), N = T.N, C = 14.2, CX = 1240, CY = 540;
function show(id, on) { $(id).style.display = on ? "block" : "none"; }
function hexmix(a, b, u) { return [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * u); }); }
var BASE = []; for (var i = 0; i < N; i++) { var j = 0.85 + 0.3 * ((i * 7919) % 97) / 97; BASE.push(hexmix([70, 40, 16], [242, 179, 61], Math.pow(i / N, 0.8)).map(function (v) { return Math.min(255, Math.round(v * j)); })); }

function thetaAt(t) {
  var A = T.angles, th = A[0][1];
  for (var k = 1; k < A.length; k++) { var d = k === 1 ? 0.8 : k === A.length - 1 ? 1.3 : 0.6; th = mix(th, A[k][1], smoother((t - (A[k][0] - d)) / d)); }
  return th;
}
var ZOOM = curve([[0, 1], [3.2, 1], [4.0, 4.2], [6.0, 4.2], [6.8, 1], [25.0, 1], [26.3, 0.8], [30, 0.8]]);
var MOVE = curve([[0, 0], [25.0, 0], [26.3, 70], [30, 70]]);
function grow(i, t) { var a = -0.45 + 1.7 * Math.pow(i / N, 0.7); // the burst is already under way on frame 0
  return expOut((t - a) / 0.35); }
function rot(t) { return Math.min(t, T.rest[0]) * 3; } // a slow turn, frozen for the final rest
function seedXY(i, t, th) {
  var z = ZOOM(t), r = C * Math.sqrt(i + 0.5) * grow(i, t) * z, a = (i * th + rot(t)) * deg;
  return [CX + MOVE(t) + r * Math.cos(a), CY + r * Math.sin(a)];
}
function seedMotion(from, to) {
  return [5, 200, 600, 999].reduce(function (m, i) { var a = seedXY(i, from, thetaAt(from)), b = seedXY(i, to, thetaAt(to)); return Math.max(m, Math.hypot(b[0] - a[0], b[1] - a[1])); }, 0);
}
// the spiral families: arm = n mod F; arms light up one by one as they're counted
function family(t, sp, F) { var on = smr(t, sp[0], sp[0] + 0.4) * (1 - smr(t, sp[1] - 0.3, sp[1])), n = Math.floor(F * smr(t, sp[0] + 0.2, sp[0] + 1.9) + 1e-6); return { on: on, n: n, F: F }; }

function drawPetals(t, z) {
  var u0 = T.petals[0]; if (t < u0) return;
  var R = C * Math.sqrt(N) * z, rt = rot(t) * deg;
  for (var ring = 0; ring < 2; ring++) for (var k = 0; k < 34; k++) {
    var g = expOut((t - u0 - 0.025 * k - 0.15 * ring) / 0.6); if (g <= 0) continue;
    var a = (k + ring * 0.5) / 34 * Math.PI * 2 + rt, len = (ring ? 125 : 150) * g, wid = 26 * g;
    ctx.save(); ctx.translate(CX + MOVE(t) + Math.cos(a) * (R - 10), CY + Math.sin(a) * (R - 10)); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(len / 2, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = ring ? "#d99a1e" : "#f5c242"; ctx.fill(); ctx.strokeStyle = "rgba(90,50,10,0.5)"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
}
function paintFlower(t) {
  ctx.clearRect(0, 0, W, H);
  var th = thetaAt(t), z = ZOOM(t), f34 = family(t, T.sp34, 34), f55 = family(t, T.sp55, 55);
  var dim = smr(t, 3.5, 4.0) * (1 - smr(t, 6.0, 6.6)); // the rule close-up dims all but the first seeds
  drawPetals(t, z);
  for (var i = 0; i < N; i++) {
    var g = grow(i, t); if (g <= 0.001) continue;
    var p = seedXY(i, t, th), rgb = BASE[i], s = C * 0.5 * z * (0.85 + 0.3 * i / N) * Math.min(1, g * 1.3);
    [f34, f55].forEach(function (f) {
      if (f.on <= 0) return;
      var arm = i % f.F, lit = arm < f.n ? (arm % 2 ? [255, 228, 160] : [255, 150, 60]) : [40, 28, 14];
      rgb = hexmix(rgb, lit, f.on * (arm < f.n ? 0.95 : 0.7));
    });
    var a = i < 7 ? 1 : 1 - 0.85 * dim;
    ctx.fillStyle = "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a.toFixed(3) + ")";
    ctx.beginPath(); ctx.arc(p[0], p[1], s, 0, Math.PI * 2); ctx.fill();
  }
  if (dim > 0.01) drawRule(t, th, z, dim);
}
// the close-up: the first seeds numbered, with the turn between each and the next drawn as an arc
function drawRule(t, th, z, dim) {
  ctx.save(); ctx.globalAlpha = dim; ctx.font = "600 22px 'SF Mono',Menlo,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (var k = 1; k < 7; k++) {
    var u = c01((t - T.seeds[0] - T.seeds[1] * k) / 0.25); if (u <= 0) continue;
    var a0 = ((k - 1) * th + rot(t)) * deg, a1 = a0 + th * deg * u, rr = C * Math.sqrt(k + 0.5) * z;
    ctx.strokeStyle = "rgba(243,233,210,0.75)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(CX, CY, rr * 0.55 + 18, a0, a1); ctx.stroke();
    var p = seedXY(k, t, th);
    ctx.fillStyle = "#f3e9d2"; ctx.fillText(String(k), p[0] + 26 * Math.cos(a1), p[1] + 26 * Math.sin(a1));
  }
  ctx.restore();
}
