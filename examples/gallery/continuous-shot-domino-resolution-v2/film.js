// "Resolution" v2: one phone is one pixel, as a real 3D domino run in three.js.
// Every phone stands on a white studio floor, tips on its bottom edge into the next, and its screen lights as it
// lands, so the picture appears exactly where the wave has passed. Each frame is a pure function of t.
var W = 1920, H = 1080, DUR = 25.6, DROP = 13.74;
var BEAT = function (n) { return 0.029 + n * 60 / 140; };
var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
var c01 = function (x) { return clamp(x, 0, 1); };
var sm = function (x) { x = c01(x); return x * x * (3 - 2 * x); };
var mix = function (a, b, u) { return a + (b - a) * u; };

// ---- the picture: a smiling classic computer, (u, v) in 0..1 with v down (the same drawing as v1)
function pic(u, v, wink) {
  var rr = function (x0, y0, x1, y1, r) { var cx = clamp(u, x0 + r, x1 - r), cy = clamp(v, y0 + r, y1 - r); return (u - cx) * (u - cx) + (v - cy) * (v - cy) <= r * r; };
  var col = [36, 92 + 30 * v, 190 - 30 * v];
  if (rr(0.12, 0.88, 0.88, 0.94, 0.02)) col = [190, 182, 160];
  if (rr(0.19, 0.07, 0.81, 0.88, 0.05)) col = [232, 224, 204];
  if (rr(0.26, 0.14, 0.74, 0.60, 0.04)) {
    col = [16, 26, 44];
    var e = function (cx, ry, rx) { return ((u - cx) / rx) * ((u - cx) / rx) + ((v - 0.30) / ry) * ((v - 0.30) / ry) <= 1; };
    if (e(0.405, 0.055, 0.026)) col = [245, 248, 255];
    if (wink ? e(0.595, 0.014, 0.040) : e(0.595, 0.055, 0.026)) col = [245, 248, 255];
    var q = ((u - 0.5) / 0.17) * ((u - 0.5) / 0.17) + ((v - 0.37) / 0.13) * ((v - 0.37) / 0.13);
    if (v > 0.41 && q > 0.70 && q < 1.15) col = [245, 248, 255];
  }
  if (rr(0.33, 0.69, 0.67, 0.725, 0.01)) col = [110, 102, 88];
  if (rr(0.62, 0.77, 0.70, 0.80, 0.01)) col = [140, 132, 114];
  return col;
}
function sample(n, wink) {
  var a = [], s = 3;
  for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
    var r = 0, g = 0, b = 0;
    for (var a1 = 0; a1 < s; a1++) for (var b1 = 0; b1 < s; b1++) { var c = pic((j + (b1 + 0.5) / s) / n, (i + (a1 + 0.5) / s) / n, wink); r += c[0]; g += c[1]; b += c[2]; }
    a.push([r / (s * s), g / (s * s), b / (s * s)]);
  }
  return a;
}
var tmpC = new THREE.Color();
function lin(rgb) { tmpC.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace); return [tmpC.r, tmpC.g, tmpC.b]; }
var BLUE = lin([70, 130, 255]), OFF = [0.006, 0.007, 0.009];

// ---- the phones. Each one: where it stands (x, z), the way it falls (heading), when it starts, how far it leans
// at rest, its lit colour and how it lights (0 as it lands, 1 at the drop, 2 as it lands with the field's wink).
var PH = { x: [], z: [], h: [], t: [], d: [], rest: [], col: [], colW: [], mode: [] };
function add(x, z, h, t, d, rest, col, mode, colW) {
  PH.x.push(x); PH.z.push(z); PH.h.push(h); PH.t.push(t); PH.d.push(d); PH.rest.push(rest); PH.col.push(col); PH.mode.push(mode || 0); PH.colW.push(colW || col);
}
var GAP = 0.9, LGAP = 0.72, PITCH = 0.85; // fields keep square pixels; lines are packed tighter so they fall into a stack
// A line of phones along a smooth curve through the points, falling from t0 at dt per phone. Returns its front.
function line(pts, t0, dt, col, opts) {
  opts = opts || {};
  var curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); }), false, "centripetal");
  var n = Math.max(2, Math.round(curve.getLength() / LGAP));
  if (opts.span) dt = opts.span / (n - 1); // the whole line takes exactly `span` seconds, whatever its length
  var fr = { p: [], t: [] };
  for (var k = opts.skipFirst ? 1 : 0; k < n; k++) {
    var u = k / (n - 1), p = curve.getPointAt(u), tg = curve.getTangentAt(u), tk = t0 + (k - (opts.skipFirst ? 1 : 0)) * dt;
    if (!(opts.skipLast && k === n - 1)) add(p.x, p.z, Math.atan2(tg.x, tg.z), tk, opts.d || 0.24, k === n - 1 ? 1.45 : 1.27, col || BLUE, 0);
    fr.p.push([p.x, p.z]); fr.t.push(tk);
  }
  fr.end = fr.t[fr.t.length - 1];
  return fr;
}
// A field of n x n phones in columns running +z from z0; picture row 0 is the far row, so it reads upright from
// the entrance. start(i, j) gives each phone's start; the last row lies flatter.
var picCols = {};
function field(n, z0, start, mode, skip) {
  var col = sample(n, false), colW = mode === 2 ? sample(n, true) : null;
  for (var r = 0; r < n; r++) for (var j = 0; j < n; j++) {
    if (skip && skip(r, j)) continue;
    var i = n - 1 - r; // picture row
    var x = -(j - (n - 1) / 2) * PITCH, z = z0 + r * GAP;
    add(x, z, 0, start(r, j, x, z), 0.26, r === n - 1 ? 1.45 : 1.18, lin(col[i * n + j]), mode, colW ? lin(colW[i * n + j]) : null);
  }
}

// the hero phone, then the 3x3
add(0, -0.45, 0, 1.74, 0.86, 1.18, BLUE, 0);
field(3, 1.0, function (r, j) { return 2.60 + Math.abs(j - 1) * 0.14 + r * 0.26; }, 0);
// the S-line to the 10x10
var S1 = line([[0, 3.9], [0, 6], [6, 13], [-6, 25], [5, 37], [0, 45], [0, 47]], BEAT(8), 0, BLUE, { span: 3.35 });
var tC = S1.end + 0.05;
// the 10x10: a header row struck in the middle, spreading both ways, each header phone starting its column
for (var hj = 0; hj < 10; hj++) { var hx = -(hj - 4.5) * PITCH; add(hx, 48, hx < 0 ? -Math.PI / 2 : Math.PI / 2, tC + Math.abs(hx) * 0.06, 0.2, 1.3, BLUE, 0); }
field(10, 49.2, function (r, j, x) { return tC + 0.12 + Math.abs(x) * 0.06 + r * 0.055; }, 0);
var cEnd = tC + 0.12 + 4 * 0.06 + 9 * 0.055;
// the exit to the trunk, then five generations of splits into 32 lines: one generation a beat-pair
var zRoot = 66, LV = 12, splitT = function (l) { return 8.60 + l * 0.686; };
var EX = line([[0, 58.5], [0, 62], [0, zRoot]], cEnd + 0.1, 0, BLUE, { span: 8.60 - cEnd - 0.1 });
var colX = function (j) { return -(j - 15.5) * PITCH; };
var HERO = { p: [], t: [] };
function branch(l, lo, hi) {
  var x0 = 0; for (var j = lo; j < hi; j++) x0 += colX(j); x0 /= hi - lo;
  if (l === 5) return;
  var mid = (lo + hi) / 2;
  [[lo, mid], [mid, hi]].forEach(function (g, gi) {
    var x1 = 0; for (var j = g[0]; j < g[1]; j++) x1 += colX(j); x1 /= g[1] - g[0];
    var za = zRoot + l * LV, zb = za + LV, n = LV / GAP;
    var fr = line([[x0, za], [x0, za + 2.5], [x1, zb - 2.5], [x1, zb]], splitT(l), 0, BLUE, { skipFirst: true, skipLast: l < 4, span: 0.686 });
    if (lo === 0 && gi === 0) { HERO.p = HERO.p.concat(fr.p); HERO.t = HERO.t.concat(fr.t); }
    branch(l + 1, g[0], g[1]);
  });
}
branch(0, 0, 32);
// the 32x32: each line's column runs on; screens stay dark until the drop
var zD = zRoot + 5 * LV + 1.0;
field(32, zD, function (r) { return splitT(5) + 0.1 + r * 0.045; }, 1);
var dEnd = splitT(5) + 0.1 + 31 * 0.045;
// the chase line, then the 100x100 struck at its entrance: a circular front through 10,000
var zE = zD + 31 * GAP + 48;
var CH = line([[0, zD + 31 * GAP + 1.4], [0, zD + 31 * GAP + 6], [9, zD + 31 * GAP + 18], [-9, zD + 31 * GAP + 32], [0, zE - 4], [0, zE - 1]], 13.6, 0, BLUE, { span: 16.74 - 13.6 });
var SURV = { r: 40, j: 50 };
field(100, zE, function (r, j, x, z) { return 16.74 + Math.hypot(x, z - zE) * 0.034; }, 2, function (r, j) { return j === SURV.j && (r === SURV.r || r === SURV.r - 1); });
var survX = -(SURV.j - 49.5) * PITCH, survZ = zE + SURV.r * GAP;
var N = PH.x.length;
document.getElementById("c").setAttribute("data-phones", String(N + 1)); // with the survivor

// ---- the scene
var cv = document.getElementById("c");
var R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
R.setPixelRatio(1); R.setSize(W, H, false);
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.outputColorSpace = THREE.SRGBColorSpace;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
var scene = new THREE.Scene(), BG = new THREE.Color(0xe9eaec);
scene.background = BG; scene.fog = new THREE.Fog(BG, 70, 230);
var pmrem = new THREE.PMREMGenerator(R);
scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8dce4, 0.9));
var sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun); scene.add(sun.target);
var floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0xf3f3f4, roughness: 0.92, metalness: 0 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// a generic phone: a rounded slab, a plain square camera bump on the back (the +z side), a screen on the front
var PW = 0.75, PHH = 1.6, PT = 0.085;
var body = new THREE.RoundedBoxGeometry(PW, PHH, PT, 2, 0.04); body.translate(0, PHH / 2, 0);
var bump = new THREE.RoundedBoxGeometry(0.27, 0.27, 0.03, 2, 0.04); bump.translate(-0.17, PHH - 0.24, PT / 2 + 0.012);
var bodyGeo = THREE.mergeGeometries([body, bump]);
function roundRect(w, h, r) {
  var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, 4);
}
var scrGeo = roundRect(PW - 0.06, PHH - 0.06, 0.06); scrGeo.rotateY(Math.PI); scrGeo.translate(0, PHH / 2, -PT / 2 - 0.002);
var bodyMat = new THREE.MeshStandardMaterial({ color: 0x24262b, metalness: 0.55, roughness: 0.32, envMapIntensity: 1.0 });
var scrMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.22, metalness: 0.0, envMapIntensity: 0.45, emissive: 0xffffff, toneMapped: false });
var bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, N), screens = new THREE.InstancedMesh(scrGeo, scrMat, N);
bodies.castShadow = true; bodies.receiveShadow = true; bodies.frustumCulled = false; screens.frustumCulled = false;
screens.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
// screens glow with their own colour: the per-instance colour drives the emissive, the diffuse stays black for a glossy reflection
scrMat.onBeforeCompile = function (sh) {
  sh.fragmentShader = sh.fragmentShader.replace("vec3 totalEmissiveRadiance = emissive;", "vec3 totalEmissiveRadiance = emissive * vColor;").replace("#include <color_fragment>", "");
};
scene.add(bodies); scene.add(screens);

// the survivor: one phone standing, its screen the whole picture
function picTex(wink) {
  var c = document.createElement("canvas"); c.width = 360; c.height = 768;
  var x = c.getContext("2d"), im = x.createImageData(360, 768);
  for (var i = 0; i < 768; i++) for (var j = 0; j < 360; j++) {
    var v = (i - 204) / 360, u = j / 360, k = (i * 360 + j) * 4;
    var p = v < 0 ? pic(u, 0, wink) : v > 1 ? [36, 122, 160] : pic(u, v, wink);
    im.data[k] = p[0]; im.data[k + 1] = p[1]; im.data[k + 2] = p[2]; im.data[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
var TEX = picTex(false), TEXW = picTex(true);
var survBody = new THREE.Mesh(bodyGeo, bodyMat); survBody.castShadow = true;
var sGeo = roundRect(PW - 0.06, PHH - 0.06, 0.06); sGeo.rotateY(Math.PI); sGeo.translate(0, PHH / 2, -PT / 2 - 0.002);
// ShapeGeometry uvs are in shape units: map them to 0..1
var uv = sGeo.attributes.uv; for (var q = 0; q < uv.count; q++) uv.setXY(q, 1 - (uv.getX(q) + (PW - 0.06) / 2) / (PW - 0.06), (uv.getY(q) + (PHH - 0.06) / 2) / (PHH - 0.06));
var survMat = new THREE.MeshBasicMaterial({ map: TEX, toneMapped: false });
var survScr = new THREE.Mesh(sGeo, survMat);
var surv = new THREE.Group(); surv.add(survBody); surv.add(survScr); surv.position.set(survX, 0, survZ); scene.add(surv);

// ---- the fall: tip on the bottom edge on the travel side, accelerating, then rest leaning on the next
var E = bodies.instanceMatrix.array, E2 = screens.instanceMatrix.array, SC = screens.instanceColor.array;
function lean(i, t) {
  var u = (t - PH.t[i]) / PH.d[i];
  if (u <= 0) return 0;
  if (i === 0 && t < PH.t[0] + PH.d[0]) return PH.rest[0] * Math.pow(c01(u), 2.6); // the hero tips slowly
  return u >= 1 ? PH.rest[i] : PH.rest[i] * Math.pow(u, 1.7);
}
function pose(t) {
  var c = PT / 2, winkOn = (t > BEAT(48) && t < BEAT(48) + 0.22) || (t > BEAT(50) && t < BEAT(50) + 0.22);
  var dropL = sm((t - DROP) / 0.05);
  for (var i = 0; i < N; i++) {
    var th = lean(i, t), st = Math.sin(th), ct = Math.cos(th), sh = Math.sin(PH.h[i]), ch = Math.cos(PH.h[i]);
    var oy = c * st, oz = c * (1 - ct), k = i * 16;
    E[k] = ch; E[k + 1] = 0; E[k + 2] = -sh; E[k + 3] = 0;
    E[k + 4] = sh * st; E[k + 5] = ct; E[k + 6] = ch * st; E[k + 7] = 0;
    E[k + 8] = sh * ct; E[k + 9] = -st; E[k + 10] = ch * ct; E[k + 11] = 0;
    E[k + 12] = PH.x[i] + sh * oz; E[k + 13] = oy; E[k + 14] = PH.z[i] + ch * oz; E[k + 15] = 1;
    for (var m = 0; m < 16; m++) E2[k + m] = E[k + m];
    var L = i === 0 ? sm((t - 1.5) / 0.6) : sm((th / PH.rest[i] - 0.55) / 0.45), col = PH.col[i];
    if (PH.mode[i] === 1) L *= dropL;
    if (PH.mode[i] === 2 && winkOn) col = PH.colW[i];
    var o = i * 3;
    SC[o] = mix(OFF[0], col[0], L); SC[o + 1] = mix(OFF[1], col[1], L); SC[o + 2] = mix(OFF[2], col[2], L);
  }
  bodies.instanceMatrix.needsUpdate = true; screens.instanceMatrix.needsUpdate = true; screens.instanceColor.needsUpdate = true;
  var L2 = sm((t - 23.0) / 0.45) * (1 - sm((t - 24.89) / 0.06));
  var sw = (t > 23.6 && t < 23.95) || (t > 24.25 && t < 24.45);
  survMat.map = sw ? TEXW : TEX; survMat.color.setScalar(Math.max(0.012, L2));
}

// ---- the camera: segments, each a function of t, blended over half a second
function front(fr, t) {
  var n = fr.t.length;
  if (t <= fr.t[0]) return { x: fr.p[0][0], z: fr.p[0][1] };
  if (t >= fr.t[n - 1]) return { x: fr.p[n - 1][0], z: fr.p[n - 1][1] };
  var k = 0; while (fr.t[k + 1] < t) k++;
  var u = (t - fr.t[k]) / (fr.t[k + 1] - fr.t[k]);
  return { x: mix(fr.p[k][0], fr.p[k + 1][0], u), z: mix(fr.p[k][1], fr.p[k + 1][1], u) };
}
function heading(fr, t) { var a = front(fr, t - 0.2), b = front(fr, t + 0.2), l = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: (b.x - a.x) / l, z: (b.z - a.z) / l }; }
function ride(fr, t, back, up, side, ahead, lag) {
  var f = front(fr, t - (lag || 0)), d = heading(fr, t), s = { x: d.z, z: -d.x }, f2 = front(fr, t);
  return { p: [f.x - d.x * back + s.x * side, up, f.z - d.z * back + s.z * side], q: [f2.x + d.x * ahead, 0.35, f2.z + d.z * ahead] };
}
function bank(fr, t) { var a = heading(fr, t - 0.15), b = heading(fr, t + 0.15); return clamp((a.x * b.z - a.z * b.x) * 0.9, -0.12, 0.12); }
var stepK = function (t) { var k = 0; [splitT(3), splitT(4), splitT(5)].forEach(function (s) { k += sm((t - s + 0.15) / 0.4); }); return k; };
var SEG = [
  [0, function (t) { var a = mix(0.5, 1.05, sm(t / 1.9)); return { p: [Math.sin(a) * 2.4, mix(1.15, 1.35, t / 1.74), Math.cos(a) * 2.4 - 0.45], q: [0, 0.95, -0.45], fov: 26 }; }],
  [1.74, function (t) { var u = sm((t - 1.74) / 0.86); return { p: [mix(2.1, 2.7, u), mix(1.35, 1.9, u), mix(0.75, -0.2, u)], q: [0, mix(0.9, 0.3, u), mix(-0.3, 1.2, u)], fov: mix(26, 32, u) }; }],
  [2.6, function (t) { var u = sm((t - 2.6) / 0.9); return { p: [mix(2.7, 2.2, u), mix(1.9, 3.6, u), mix(-0.2, -1.9, u)], q: [0, 0, mix(1.2, 3.6, u)], fov: mix(32, 36, u) }; }],
  [3.46, function (t) { var r = ride(S1, t, -0.4, 2.5, 2.2, -2.8); r.fov = 46; return r; }],
  [6.89, function (t) { var u = sm((t - 6.89) / 0.9); return { p: [mix(7, 9, u), mix(7, 11, u), mix(44, 46, u)], q: [0, 0, 53], fov: 40 }; }],
  [7.8, function (t) { var r = ride(HERO, t, -0.6, 2.4, 2.0, -3.2); r.fov = 50; r.roll = bank(HERO, t); return r; }],
  [10.3, function (t) { var k = stepK(t) / 3, r = ride(HERO, t, mix(-0.6, 12, k), mix(2.4, 12, k), mix(2.0, 4, k), mix(-3.2, 8, k)); r.fov = 48; return r; }],
  [12.2, function (t) { var u = sm((t - 12.2) / 2.0); return { p: [mix(-8, -6, u), mix(20, 22, u), mix(108, 112, u)], q: [0, 0, zD + 15], fov: 40 }; }],
  [14.3, function (t) { var r = ride(CH, t, 3.0, 1.25, 1.8, 2.5, 0.08); r.fov = 46; r.roll = bank(CH, t) * 0.6; return r; }],
  [16.74, function (t) {
    var rr = (t - 16.74) / 0.034, c = sm((t - 18.0) / 3.4);
    return { p: [mix(2.2, 0, c), mix(2.6, 46, c), mix(zE + rr - 10, zE - 20, c)], q: [0, 0, mix(zE + rr + 5, zE + 50, c)], fov: mix(48, 40, c) };
  }],
  [22.31, function (t) { var u = sm((t - 22.31) / 1.25); var e = sm((t - 23.6) / 2.0);
    return { p: [mix(0, survX, u), mix(46, 1.75, u), mix(zE - 20, survZ - 4.4 + 0.35 * e, u)], q: [mix(0, survX, u), mix(0, 0.95, u), mix(zE + 50, survZ, u)], fov: mix(40, 26, u) }; }],
];
function segAt(t) { var i = 0; while (i < SEG.length - 1 && t >= SEG[i + 1][0]) i++; return i; }
function camAt(t) {
  var i = segAt(t), a = SEG[i][1](t);
  var w = i > 0 ? sm((t - SEG[i][0]) / 0.5) : 1;
  if (w < 1) {
    var b = SEG[i - 1][1](t);
    a = { p: a.p.map(function (v, k) { return mix(b.p[k], v, w); }), q: a.q.map(function (v, k) { return mix(b.q[k], v, w); }), fov: mix(b.fov, a.fov, w), roll: mix(b.roll || 0, a.roll || 0, w) };
  }
  return a;
}
var cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 600);
var SHAKES = [[2.60, 0.02], [tC, 0.025], [DROP, 0.06], [16.74, 0.035], [24.89, 0.012]];
function place(k, t) {
  var c = camAt(t), sx = 0, sy = 0;
  SHAKES.forEach(function (s) { var d = t - s[0]; if (d > 0 && d < 0.6) { var a = s[1] * Math.exp(-d * 8); sx += a * Math.sin(d * 63); sy += a * Math.cos(d * 51); } });
  k.fov = c.fov; k.updateProjectionMatrix();
  k.position.set(c.p[0], c.p[1], c.p[2]); k.up.set(0, 1, 0); k.lookAt(c.q[0], c.q[1], c.q[2]);
  k.rotateZ(c.roll || 0); k.rotateX(sy); k.rotateY(sx); k.updateMatrixWorld();
  return c;
}
// how far the picture moves on screen between two times, for the exporter's motion blur: the camera's own move
// (world points round what it looks at, seen from both poses) plus a phone tipping near the subject
var probe = new THREE.PerspectiveCamera(40, W / H, 0.05, 600), v3 = new THREE.Vector3();
function motion(from, to) {
  var a = place(probe, from), pts = [[0, 0, 0], [2, 0, 0], [0, 0, 2], [0, 1.2, 0]].map(function (o) { return new THREE.Vector3(a.q[0] + o[0], o[1], a.q[2] + o[2]); });
  var A = pts.map(function (p) { return v3.copy(p).project(probe).clone(); });
  place(probe, to);
  var far = 0;
  pts.forEach(function (p, i) { var b = v3.copy(p).project(probe); far = Math.max(far, Math.hypot((b.x - A[i].x) * W / 2, (b.y - A[i].y) * H / 2)); });
  var dist = Math.hypot(a.p[0] - a.q[0], a.p[1] - a.q[1], a.p[2] - a.q[2]) || 1;
  return far + 7.9 * Math.abs(to - from) * (H / 2) / (Math.tan(a.fov * Math.PI / 360) * dist);
}
function draw(t) {
  pose(t);
  var c = place(cam, t);
  // the sun's shadow box follows what the camera looks at, sized to the view
  var dist = Math.hypot(c.p[0] - c.q[0], c.p[1] - c.q[1], c.p[2] - c.q[2]), half = clamp(dist * 0.9, 6, 70);
  sun.target.position.set(c.q[0], 0, c.q[2]); sun.position.set(c.q[0] - 18, 40, c.q[2] - 26);
  var sc = sun.shadow.camera; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 140; sc.updateProjectionMatrix();
  scene.fog.near = Math.max(30, dist * 1.4); scene.fog.far = scene.fog.near + 95;
  R.render(scene, cam);
}
tl.frame(draw, { motion: motion });

// beats: labels and the sound hits a score is cut to
tl.label("tip", 1.74).label("land", 2.60).label("launch", BEAT(8)).label("struck", tC).label("split", splitT(0)).label("drop", DROP).label("front", 16.74).label("dive", 22.31).label("wink", 23.6).label("dark", 24.89);
tl.hit("tip", 1.74, { kind: "whoosh" }).hit("land", 2.60, { kind: "land" }).hit("launch", BEAT(8), { kind: "impact" }).hit("struck", tC, { kind: "impact" })
  .hit("drop", DROP, { kind: "impact" }).hit("front", 16.74, { kind: "impact" }).hit("dive", 22.31, { kind: "whoosh" }).hit("wink", 23.6, { kind: "click" }).hit("dark", 24.89, { kind: "land" });
for (var gi = 0; gi < 6; gi++) tl.hit("split" + gi, splitT(gi), { kind: "click", pan: gi % 2 ? 0.3 : -0.3 });
for (var ci = 0; ci < 24; ci++) tl.hit("tick" + ci, BEAT(8) + ci * 0.14, { kind: "click", pan: Math.sin(ci) * 0.4 });
for (var ri = 0; ri < 20; ri++) tl.hit("ring" + ri, 16.74 + ri * 0.17, { kind: "click", pan: Math.sin(ri * 1.7) * 0.5 });
