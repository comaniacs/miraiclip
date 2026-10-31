// "One Light-Day" — a 30 s photo-montage film about Voyager 1. Every pixel is a pure function of time:
// window.seek(t) paints frame t (seconds). No CSS animations or transitions, so any frame renders identically.
'use strict';

const T = globalThis.TIMING;
const IMG = 'assets/nasa/';
const LIGHT_DAY_KM = 25902068371; // 299,792.458 km/s × 86,400 s

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, p) => a + (b - a) * p;
const E = {
  lin: (x) => x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
  io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  back: (x) => { const c = 1.4, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
};
const prog = (t, a, b, e = E.out) => e(clamp((t - a) / (b - a)));
function keys(t, ks) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0] = ks[i], [t1, v1, e] = ks[i + 1];
    if (t <= t1) return mix(v0, v1, (e || E.io)((t - t0) / (t1 - t0)));
  }
  return ks[ks.length - 1][1];
}
// a fade-in/hold/fade-out envelope
const env = (t, a, b, inn = 0.35, out = 0.35) => Math.min(prog(t, a, a + inn, E.out), 1 - prog(t, b - out, b, E.in));
// deterministic noise
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// a decaying kick, used for camera shake and flashes after a hit
const kick = (t, at, decay = 9) => (t < at ? 0 : Math.exp(-(t - at) * decay));

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---------- the photographs ----------
// [file, natural w, natural h, caption, small note, date stamp]
const PHOTOS = {
  launch: ['PIA21747', 1833, 2304, 'Cape Canaveral', 'Titan IIIE', "'77 9 5"],
  record: ['PIA14113', 981, 552, 'The Golden Record', '116 images, 55 languages', "'77 8 —"],
  record2: ['PIA21741', 1760, 2227, 'Mounting the record', 'gold-plated copper', "'77 8 —"],
  portrait: ['PIA00451', 4000, 1200, 'Family Portrait — the last 60 frames', 'Voyager 1', "'90 2 14"],
};
const MONTAGE = [
  ['PIA00144', 820, 540, 'Jupiter, Io & Europa', 'V1', "'79 1 29", 1979],
  ['PIA00022', 1920, 1392, 'The Great Red Spot', 'V1', "'79 3 1", 1979],
  ['ARC-1979-A79-7073', 1920, 1280, 'Io — a moon on fire', 'V1', "'79 3 4", 1979],
  ['PIA00459', 704, 680, 'Europa', 'V2', "'79 7 9", 1979],
  ['PIA00030', 1000, 1000, 'Saturn', 'V1', "'80 11 3", 1980],
  ['PIA01364', 1200, 1500, 'Saturn, departing', 'V2', "'81 8 4", 1981],
  ['PIA18182', 1720, 1720, 'Uranus', 'V2', "'86 1 14", 1986],
  ['PIA00143', 794, 960, 'Uranus, last look', 'V2', "'86 1 25", 1986],
  ['PIA02210', 1000, 1000, 'Neptune', 'V2', "'89 8 20", 1989],
  ['PIA02215', 800, 600, 'Neptune & Triton', 'V2', "'89 8 28", 1989],
  ['PIA02247', 800, 800, 'Triton, goodbye', 'V2', "'89 8 29", 1989],
];

function printEl(p, long) {
  const [file, w, h, cap, note, stamp] = p;
  const k = long / Math.max(w, h);
  const el = document.createElement('div');
  el.className = 'print';
  el.innerHTML = `<div class="win" style="width:${Math.round(w * k)}px;height:${Math.round(h * k)}px">
      <img src="${IMG}${file}.jpg" alt=""><div class="gloss"></div><div class="stamp">${stamp}</div></div>
    <div class="cap">${cap}<small>${note}</small></div>`;
  el.dataset.w = Math.round(w * k) + 32;
  el.dataset.h = Math.round(h * k) + 86;
  return el;
}
// place a print by its centre
function place(el, x, y, rot, s = 1, op = 1) {
  el.style.transform = `translate(${x - el.dataset.w / 2}px, ${y - el.dataset.h / 2}px) rotate(${rot}deg) scale(${s})`;
  el.style.opacity = op;
}

// ---------- scenes ----------
const scenes = [];
function scene(a, b, paint) {
  const el = document.createElement('div');
  el.className = 'scene';
  $('#scenes').appendChild(el);
  scenes.push({ a, b, el, paint });
  return el;
}

// Launch: one print slams onto the table
const sLaunch = scene(T.launch, T.record, (t, el) => {
  const p = el.firstChild, lt = T.launch;
  const land = prog(t, lt, lt + 0.45, E.back);
  const drift = (t - lt) / 3;
  place(p, mix(1500, 640, land) + drift * 30, mix(-300, 560, land), mix(18, -4, land) + drift * 1.5, mix(1.4, 1, land) + drift * 0.04);
  $('img', p).style.transform = `scale(${1.04 + drift * 0.08}) translateY(${-drift * 20}px)`;
});
sLaunch.appendChild(printEl(PHOTOS.launch, 820));

// Golden Record: the record, then the hands that mounted it
const sRecord = scene(T.record, T.montage, (t, el) => {
  const [a, b] = el.children, r0 = T.record, r1 = T.recordSecond;
  const la = prog(t, r0, r0 + 0.45, E.back), lb = prog(t, r1, r1 + 0.42, E.back);
  const d = (t - r0) / 3;
  place(a, mix(-500, 800, la) - d * 40, mix(900, 530, la), mix(-25, 3, la) - d, mix(1.3, 1, la) + d * 0.05);
  place(b, mix(2400, 1450, lb), mix(200, 580, lb), mix(30, -6, lb), mix(1.3, 1, lb), lb > 0 ? 1 : 0);
  $('img', a).style.transform = `scale(${1.05 + d * 0.1})`;
});
sRecord.appendChild(printEl(PHOTOS.record, 880));
sRecord.appendChild(printEl(PHOTOS.record2, 640));

// Montage: prints rain onto a pile, faster and faster, then the pile is swept away
const sMontage = scene(T.montage, T.turn, (t, el) => {
  const pile = el.firstChild;
  let shake = 0;
  MONTAGE.forEach((m, i) => {
    const p = pile.children[i], at = T.lands[i];
    const fx = (hash(i) - 0.5) * 900, fy = (hash(i + 20) - 0.5) * 330, fr = (hash(i + 40) - 0.5) * 26;
    const ang = hash(i + 60) * Math.PI * 2, dist = 1700;
    const flyT = Math.max(0.24, 0.5 - i * 0.025);
    const k = prog(t, at - flyT, at, E.out);
    if (t < at - flyT) { p.style.opacity = 0; return; }
    const settle = kick(t, at, 7) * Math.sin((t - at) * 30) * 1.2;
    place(p, fx + Math.cos(ang) * dist * (1 - k), fy + Math.sin(ang) * dist * (1 - k), fr + (1 - k) * 60 + settle, mix(1.5, 1, k));
    $('img', p).style.transform = `scale(${1.02 + (t - at) * 0.03})`;
    shake += kick(t, at, 14);
  });
  // the camera slowly backs off the growing pile; at the end everything is flung toward the lens
  const back = keys(t, [[T.montage, 1.18], [15.0, 0.84, E.io], [15.8, 3.4, E.inExpo]]);
  const rot = keys(t, [[T.montage, -2], [15.0, 2], [15.8, 14, E.inExpo]]);
  const sx = (hash(Math.floor(t * 60)) - 0.5) * 16 * shake, sy = (hash(Math.floor(t * 60) + 7) - 0.5) * 16 * shake;
  pile.style.transform = `translate(${960 + sx}px, ${560 + sy}px) rotate(${rot}deg) scale(${back})`;
  pile.style.opacity = 1 - prog(t, 15.45, 15.8, E.in);
  pile.style.filter = `blur(${prog(t, 15.35, 15.8, E.in) * 14}px)`;
});
{
  const pile = document.createElement('div');
  pile.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;';
  MONTAGE.forEach((m) => pile.appendChild(printEl(m, 560)));
  sMontage.appendChild(pile);
}

// Family Portrait: the long mosaic strip pans past
const sPortrait = scene(T.portrait, T.dot, (t, el) => {
  const p = el.firstChild, a = T.portrait;
  const land = prog(t, a, a + 0.6, E.expo);
  const pan = keys(t, [[a, 260], [T.dot, -300, E.lin]]);
  place(p, 960 + pan, mix(760, 590, land), mix(-6, -1.5, land), mix(1.12, 1, land) + (t - a) * 0.012);
});
sPortrait.appendChild(printEl(PHOTOS.portrait, 1960));

// Pale Blue Dot: full bleed, pushing in on one pixel. Earth sits at (1142, 986) in PIA23645.
const sDot = scene(T.dot, 27.8, (t, el) => {
  const img = el.firstChild;
  const z = keys(t, [[T.dot, 1.3], [T.circle, 2.0, E.out], [T.home, 3.4, E.io], [27.6, 0.06, E.inExpo]]);
  img.style.transform = `scale(${z})`;
  img.style.opacity = 1 - prog(t, 27.0, 27.7, E.in);
  img.style.filter = `contrast(1.08) saturate(1.1) blur(${prog(t, 26.9, 27.6, E.in) * 4}px)`;
});
{
  const img = document.createElement('img');
  img.src = `${IMG}PIA23645.jpg`;
  img.style.cssText = 'position:absolute;left:-182px;top:-446px;width:1920px;height:1899px;transform-origin:1142px 986px;';
  sDot.appendChild(img);
}

// ---------- type ----------
// [in, out, html, size class, y (px from top)]
const CUES = [
  [0.35, 3.15, 'This month,', 's-md', 300],
  [0.95, 3.15, 'something we made crosses', 's-md', 380],
  [1.6, 3.15, '<em>one light-day</em> from home.', 's-lg', 640],
  [3.75, 6.25, 'In 1977 we launched', 's-md', 380, 1130],
  [4.15, 6.25, 'a camera — with a', 's-md', 460, 1130],
  [4.55, 6.25, '<em>photo album</em> on board.', 's-md', 540, 1130],
  [6.75, 9.25, '<em>116</em> pictures of us.', 's-lg', 840],
  [7.95, 9.25, 'Addressed to <em>anyone.</em>', 's-md', 90],
  [9.55, 11.3, 'And it sent pictures home.', 's-md', 110],
  [16.0, 19.0, 'Valentine’s Day, 1990. Six billion kilometres out.', 's-md', 330],
  [16.85, 19.0, 'Its cameras were about to go dark forever.', 's-md', 410],
  [17.75, 19.0, '<em>So it turned around.</em>', 's-lg', 640],
  [19.75, 22.25, 'And took one last picture of home.', 's-md', 85],
  [23.25, 26.3, '<em>That’s us.</em>', 's-lg', 320],
  [24.15, 26.3, 'Everyone who has ever lived —', 's-md', 760],
  [24.95, 26.3, 'on a tenth of a pixel.', 's-md', 840],
  [26.65, 29.95, 'It is still out there, carrying our pictures.', 's-md', 300],
  [T.hello, 29.95, '<em>Say hello.</em>', 's-lg', 640],
  [T.hello + 0.75, 29.95, 'It gets there tomorrow.', 's-sm', 790],
];
const words = (s) => s.replace(/(<[^>]+>)|([^\s<]+)/g, (m, tag, w) => (tag ? tag : `<span class="w"><span>${w}</span></span>`));
const cueEls = CUES.map(([, , html, cls, y, x]) => {
  const el = document.createElement('div');
  el.className = `line ${cls}`;
  el.style.top = `${y}px`;
  if (x) { el.style.left = `${x}px`; el.style.right = 'auto'; el.style.textAlign = 'left'; }
  el.innerHTML = words(html);
  $('#type').appendChild(el);
  return el;
});
function paintType(t) {
  CUES.forEach(([a, b], i) => {
    const el = cueEls[i];
    if (t < a || t > b) { el.style.display = 'none'; return; }
    el.style.display = '';
    const out = prog(t, b - 0.3, b, E.in);
    el.style.opacity = 1 - out;
    el.style.filter = out > 0 ? `blur(${out * 10}px)` : '';
    $$('.w > span', el).forEach((s, j) => {
      const p = prog(t, a + j * 0.06, a + j * 0.06 + 0.6, E.expo);
      s.style.transform = `translateY(${(1 - p) * 110}%)`;
    });
  });
}

// ---------- the sky ----------
const STARS = Array.from({ length: 900 }, (_, i) => ({
  x: hash(i * 3.1) * 2400 - 240, y: hash(i * 7.3) * 2400 - 660, r: 0.4 + Math.pow(hash(i * 1.7), 6) * 2.2,
  a: 0.25 + hash(i * 5.9) * 0.75, tw: hash(i * 9.2) * 6.28,
}));
const sky = $('#stars').getContext('2d');
function paintSky(t) {
  // stars are seen in the hook, the 1990 turn, and the ending; they spin half a turn at the whip
  const vis = Math.max(env(t, 0, T.launch, 0.6, 0.15), env(t, T.turn, T.portrait, 0.25, 0.12), prog(t, 26.6, 27.8, E.io));
  sky.fillStyle = '#020205';
  sky.fillRect(0, 0, 1920, 1080);
  if (vis <= 0) return;
  const spin = prog(t, T.whip, T.portrait, E.io) * Math.PI;
  const speed = Math.sin(prog(t, T.whip, T.portrait, E.lin) * Math.PI); // 0 → 1 → 0 through the whip
  const zoom = keys(t, [[0, 1.0], [T.launch, 1.08, E.lin]]) * (1 + speed * 0.25);
  sky.save();
  sky.translate(960, 540); sky.rotate(spin); sky.scale(zoom, zoom); sky.translate(-960, -540);
  for (const s of STARS) {
    const tw = 0.75 + 0.25 * Math.sin(t * 3 + s.tw);
    sky.globalAlpha = s.a * tw * vis;
    if (speed > 0.05) {
      // streaks while the spacecraft turns
      const dx = s.x - 960, dy = s.y - 540, ang = -0.18 * speed;
      sky.strokeStyle = '#dfe8ff'; sky.lineWidth = s.r * 1.4;
      sky.beginPath(); sky.moveTo(s.x, s.y);
      sky.lineTo(960 + dx * Math.cos(ang) - dy * Math.sin(ang), 540 + dx * Math.sin(ang) + dy * Math.cos(ang));
      sky.stroke();
    } else {
      sky.fillStyle = '#e6eeff';
      sky.beginPath(); sky.arc(s.x, s.y, s.r, 0, 6.283); sky.fill();
    }
  }
  sky.restore();
  sky.globalAlpha = 1;
}

// ---------- the dot, the ring, the HUD ----------
function paintDot(t) {
  const dot = $('#dot');
  const pulse = 0.75 + 0.25 * Math.sin(t * Math.PI * 2 * 1.2);
  const vis = Math.max(env(t, 0.1, T.launch, 0.5, 0.12), prog(t, 27.2, 27.9, E.out));
  dot.style.opacity = vis * pulse;
  dot.style.transform = `scale(${1 + 0.3 * pulse})`;
  const ring = $('#ring circle'), c = 2 * Math.PI * 70;
  const draw = prog(t, T.circle, T.circle + 0.7, E.io);
  ring.style.strokeDasharray = `${c}`;
  ring.style.strokeDashoffset = `${c * (1 - draw)}`;
  $('#ring').style.opacity = env(t, T.circle, T.home + 0.4, 0.05, 0.5);
  $('#ring').style.transform = `scale(${keys(t, [[T.circle, 1.25], [T.circle + 0.7, 1, E.out], [T.home + 0.4, 1.6, E.in]])})`;
  $('#ring').style.transformOrigin = '960px 540px';
}
function paintHUD(t) {
  const hud = $('#hud');
  const year = Math.round(keys(t, [[T.launch, 1977], [T.lands[0], 1977], [T.lands[0] + 0.01, 1979, E.lin],
    ...MONTAGE.map((m, i) => [T.lands[i] + 0.01, m[6], E.lin]), [T.turn, 1990, E.lin], [27.0, 1990], [29.0, 2026, E.io]]));
  const km = keys(t, [[0.5, 0], [2.6, LIGHT_DAY_KM, E.expo], [T.launch, LIGHT_DAY_KM], [T.launch + 0.01, 0, E.lin],
    [T.turn, 4.6e9, E.lin], [T.whip, 6.0e9, E.lin], [27.0, 6.05e9], [29.0, LIGHT_DAY_KM, E.io]]);
  $('.yv', hud).textContent = year;
  $('.kmv', hud).textContent = fmt(km);
  $('.tagtxt', hud).textContent = t < T.launch || t > 26.9 ? 'VOYAGER 1 · NOW' : 'VOYAGER · ARCHIVE';
  $('.rec', hud).style.opacity = Math.sin(t * Math.PI * 2) > 0 ? 1 : 0.15;
  $('.km', hud).style.opacity = Math.max(env(t, 0.5, T.launch, 0.4, 0.15), env(t, T.turn, T.portrait, 0.4, 0.2), env(t, 26.9, 30.5, 0.5, 0.1));
  $('.year', hud).style.opacity = Math.max(env(t, T.launch + 0.2, T.portrait, 0.4, 0.2), env(t, 26.9, 30.5, 0.5, 0.1));
  $('.tag', hud).style.opacity = env(t, 0.2, 30.5, 0.4, 0.1) * 0.9;
  $('#credit').style.opacity = env(t, 28.9, 31, 0.6, 0.1);
}

// ---------- film stock ----------
const grainCtx = $('#grain').getContext('2d');
const grainImg = grainCtx.createImageData(512, 512);
for (let i = 0; i < grainImg.data.length; i += 4) {
  const v = Math.floor(hash(i * 0.37) * 255);
  grainImg.data[i] = grainImg.data[i + 1] = grainImg.data[i + 2] = v; grainImg.data[i + 3] = 255;
}
grainCtx.putImageData(grainImg, 0, 0);
const CUTS = [T.launch, T.record, T.recordSecond, T.portrait, T.dot];
function paintStock(t) {
  const f = Math.floor(t * 24); // grain changes at 24 fps, like film
  $('#grain').style.transform = `translate(${(hash(f) - 0.5) * 120}px, ${(hash(f + 99) - 0.5) * 120}px) scale(4)`;
  // flashes on every cut and every print that lands
  let flash = 0;
  CUTS.forEach((c) => { flash = Math.max(flash, kick(t, c, 10) * 0.7); });
  T.lands.forEach((c) => { flash = Math.max(flash, kick(t, c, 18) * 0.28); });
  flash = Math.max(flash, kick(t, T.circle + 0.7, 6) * 0.12);
  $('#flash').style.opacity = flash;
  // warm light leaks bloom across scene changes
  let leak = 0.12 + 0.06 * Math.sin(t * 1.3);
  [T.launch, T.record, T.montage, T.portrait].forEach((c) => { leak = Math.max(leak, env(t, c - 0.15, c + 0.9, 0.15, 0.75) * 0.75); });
  if (t < T.launch || (t > T.turn && t < T.portrait) || t > 27.2) leak = 0;
  $('#leak').style.opacity = leak;
  $('#leak').style.transform = `translateX(${Math.sin(t * 0.7) * 80}px)`;
  // letterbox breathes in for the turn
  const bar = env(t, T.turn, T.portrait, 0.5, 0.25) * 110;
  $('#barT').style.height = `${bar}px`; $('#barB').style.height = `${bar}px`;
}

window.seek = function seek(t) {
  paintSky(t);
  for (const s of scenes) {
    const on = t >= s.a && t < s.b;
    s.el.style.display = on ? '' : 'none';
    if (on) s.paint(t, s.el);
  }
  paintDot(t);
  paintType(t);
  paintHUD(t);
  paintStock(t);
};
window.ready = async function ready() {
  await document.fonts.ready;
  const ims = $$('img');
  const failed = [];
  await Promise.all(ims.map((im) => im.decode().catch(() => failed.push(im.src))));
  return { images: ims.length, failed };
};
window.DUR = T.DUR;
seek(Number(new URLSearchParams(location.search).get('t') || 0));
