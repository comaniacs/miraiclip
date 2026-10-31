// "One Login" — a 60 s HighLevel launch film. Everything on screen is a pure function of time:
// window.seek(t) paints frame t (seconds). No CSS animations or transitions, so any frame renders identically.
'use strict';

// Which captured screen plays where (files in shots/<name>.png).
const SHOTS = {
  dashboard: 'dashboard', inbox: 'conversations', pipeline: 'opportunities', calendar: 'calendars',
  workflows: 'workflows', stack: ['funnels', 'websites', 'memberships'],
  montage: [['social', 'Social'], ['emails', 'Email'], ['reputation', 'Reviews'], ['payments', 'Payments'], ['ai-agents', 'AI Agents'], ['reporting', 'Reports']],
  wall: ['dashboard', 'conversations', 'opportunities', 'calendars', 'workflows', 'funnels', 'websites', 'social', 'emails', 'reputation', 'payments', 'reporting'],
};
const DUR = 60;

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
  back: (x) => { const c = 1.6, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
};
const prog = (t, a, b, e = E.out) => e(clamp((t - a) / (b - a)));
// keys(t, [[t0, v0], [t1, v1, ease], ...]) — the ease on a key shapes the segment arriving at it
function keys(t, ks) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0] = ks[i], [t1, v1, e] = ks[i + 1];
    if (t <= t1) return mix(v0, v1, (e || E.io)((t - t0) / (t1 - t0)));
  }
  return ks[ks.length - 1][1];
}
const set = (el, tf, op) => { el.style.transform = tf; if (op !== undefined) el.style.opacity = op; };

// ---------- dom helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const scenes = [];
function scene(a, b, html, paint) {
  const el = document.createElement('div');
  el.className = 'scene';
  el.innerHTML = html;
  $('#scenes').appendChild(el);
  scenes.push({ a, b, el, paint });
  return el;
}
const shotHTML = (name, extra = '') =>
  `<div class="shot" ${extra}><div class="bar"><i></i><i></i><i></i><span>app.gohighlevel.com</span></div><img data-src="shots/${name}.png" alt=""><div class="gloss"></div></div>`;
// "Run <em>it</em>" → each word wrapped in a mask so it can rise into view
const words = (s) => s.replace(/(<[^>]+>)|([^\s<]+)/g, (m, tag, w) => (tag ? tag : `<span class="w"><span>${w}</span></span>`));
function rise(root, t, t0, step = 0.07, dur = 0.55) {
  $$('.w > span', root).forEach((s, i) => {
    const p = prog(t, t0 + i * step, t0 + i * step + dur, E.expo);
    s.style.transform = `translateY(${(1 - p) * 110}%)`;
  });
}
function fall(root, t, t0, step = 0.03, dur = 0.35) {
  $$('.w > span', root).forEach((s, i) => {
    const p = prog(t, t0 + i * step, t0 + i * step + dur, E.in);
    if (p > 0) s.style.transform = `translateY(${-p * 110}%)`;
  });
}
const gloss = (root, t, t0, t1) => $$('.gloss', root).forEach((g) => { g.style.backgroundPosition = `${mix(120, -20, prog(t, t0, t1, E.io))}% 0`; });

// ---------- background ----------
const BG = { b1: $('#b1'), b2: $('#b2'), b3: $('#b3'), floor: $('#floor'), grain: $('#grain'), flash: $('#flash') };
function paintBG(t) {
  const warm = keys(t, [[0, 0.15], [6.8, 0.15], [7.2, 0.55], [52, 0.5], [54, 0.7]]);
  set(BG.b1, `translate(${-200 + Math.sin(t * 0.21) * 300}px, ${-500 + Math.cos(t * 0.17) * 200}px)`, warm);
  set(BG.b2, `translate(${1300 + Math.cos(t * 0.19) * 260}px, ${400 + Math.sin(t * 0.23) * 220}px)`, warm * 0.55);
  set(BG.b3, `translate(${700 + Math.sin(t * 0.13) * 500}px, ${900 + Math.cos(t * 0.11) * 120}px)`, warm * 0.35);
  BG.floor.style.transform = `rotateX(76deg)`;
  BG.floor.style.backgroundPosition = `0 ${(t * 160) % 120}px`;
  BG.floor.style.opacity = keys(t, [[0, 0.5], [6.4, 0.7], [7.0, 0], [9.6, 0], [10.6, 0.7], [51.5, 0.7], [52.5, 0.25]]);
  const f = Math.floor(t * 24);
  BG.grain.style.transform = `translate(${(f * 37) % 50 - 25}px, ${(f * 61) % 50 - 25}px)`;
  BG.flash.style.opacity = keys(t, [[6.95, 0], [7.0, 0.95, E.lin], [7.6, 0, E.out], [51.95, 0], [52.0, 0.6, E.lin], [52.6, 0, E.out]]);
}

// ===================================================================================
// 1 · HOOK + REVEAL (0 – 10)  "Your business runs on 12 tools… none of them talk."
// ===================================================================================
const TOOLS = [['CRM', '#5B6CFF'], ['Email', '#E5584F'], ['SMS', '#37CA37'], ['Calendar', '#188BF6'], ['Funnels', '#FF8A3D'], ['Website', '#9B59FF'],
  ['Payments', '#00B39B'], ['Reviews', '#FFBC00'], ['Social', '#FF4F9A'], ['Courses', '#2EC5FF'], ['Forms', '#8CA0BD'], ['Reports', '#7CD000']];
{
  const cards = TOOLS.map(([n, c]) => `<div class="tool"><div class="ic" style="background:${c}">${n[0]}</div><div class="nm">${n}</div><div class="sub">LOGIN&nbsp;REQUIRED</div></div>`).join('');
  const el = scene(0, 10.0, `
    <div class="cam"><div class="rig" id="hk-rig">${cards}</div></div>
    <div class="copy" id="hk-1" style="left:0;right:0;text-align:center;top:470px"><div class="title" style="font-size:96px">${words('Your business runs on…')}</div></div>
    <div class="copy" id="hk-2" style="left:0;right:0;text-align:center;top:850px;font:700 64px/1 Geist;letter-spacing:-.03em">
      <span id="hk-a">12 tools.</span>&nbsp;&nbsp;<span id="hk-b">12 logins.</span>&nbsp;&nbsp;<span id="hk-c" style="color:#E5584F">12 bills.</span></div>
    <div class="copy" id="hk-3" style="left:0;right:0;text-align:center;top:450px"><div class="title" style="font-size:120px">${words('And none of them <em>talk.</em>')}</div></div>
    <div class="ring" id="hk-ring1"></div><div class="ring" id="hk-ring2" style="border-color:#37CA37"></div>
    <div class="copy" id="hk-logo" style="left:0;right:0;top:330px;text-align:center">
      <img src="assets/HighLevel-logo-white.png" style="width:640px;height:auto" alt="HighLevel">
      <div class="title" style="margin-top:60px;font-size:118px">${words('One platform.')} <span id="hk-ev">${words('<em>Everything.</em>')}</span></div>
    </div>`, paintHook);
  const tools = $$('.tool', el);
  const grid = tools.map((_, i) => [((i % 4) - 1.5) * 360, (Math.floor(i / 4) - 1) * 200]);
  const seed = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 0.5;
  function paintHook(t) {
    // line 1
    const l1 = $('#hk-1', el);
    rise(l1, t, 0.15, 0.09);
    set(l1, `translateY(${keys(t, [[0.9, 0], [1.5, -400, E.expo]])}px)`, keys(t, [[3.6, 1], [3.9, 0]]));
    // cards pop in, then drift, then separate, then collapse into the centre
    const rig = $('#hk-rig', el);
    rig.style.transform = `translateY(-20px) rotateX(${keys(t, [[0.8, 30], [6, 14]])}deg) rotateY(${keys(t, [[0.8, -26], [6, 18]])}deg)`;
    tools.forEach((c, i) => {
      const t0 = 0.95 + i * 0.11;
      const pin = prog(t, t0, t0 + 0.5, E.back);
      const spread = keys(t, [[3.7, 0], [4.6, 1, E.expo], [5.8, 1.25]]);
      const suck = prog(t, 5.9 + i * 0.02, 6.75 + i * 0.02, E.inExpo);
      const jit = spread * 14 * Math.sin(t * 9 + i);
      const [gx, gy] = grid[i];
      const x = mix(gx * (1 + spread * 0.75) + seed(i, 1) * 260 * spread, 0, suck);
      const y = mix(gy * (1 + spread * 0.9) + seed(i, 2) * 200 * spread, 0, suck);
      const z = mix(-900 + 900 * pin + seed(i, 3) * 500 * spread, -1400, suck);
      const r = seed(i, 4) * 40 * spread + suck * 260;
      set(c, `translate3d(${x + jit}px,${y}px,${z}px) rotateZ(${r}deg) rotateX(${(1 - pin) * 70}deg)`, clamp(pin * 1.4) * (1 - suck));
      c.style.filter = spread > 0.01 ? `saturate(${1 - spread * 0.7}) brightness(${1 - spread * 0.25})` : '';
    });
    // 12 tools. 12 logins. 12 bills.
    [['#hk-a', 2.5], ['#hk-b', 2.9], ['#hk-c', 3.3]].forEach(([s, a]) => {
      const p = prog(t, a, a + 0.35, E.back);
      set($(s, el), `translateY(${(1 - p) * 40}px) scale(${mix(1.4, 1, p)})`, clamp(p * 2));
    });
    $('#hk-2', el).style.opacity = keys(t, [[3.7, 1], [4.0, 0]]);
    // and none of them talk
    const l3 = $('#hk-3', el);
    rise(l3, t, 3.95, 0.1);
    fall(l3, t, 5.55);
    // flash, rings, logo
    [['#hk-ring1', 7.0, 1.4], ['#hk-ring2', 7.15, 1.6]].forEach(([s, a, d]) => {
      const p = prog(t, a, a + d, E.expo);
      const r = mix(40, 1500, p);
      set($(s, el), `translate(-50%,-50%)`, t < a ? 0 : (1 - p) * 0.9);
      Object.assign($(s, el).style, { width: `${r}px`, height: `${r}px` });
    });
    const lg = $('#hk-logo', el);
    const lp = prog(t, 7.0, 7.9, E.back);
    const out = prog(t, 9.15, 9.95, E.inExpo);
    set(lg, `scale(${mix(0.7, 1, lp) * mix(1, 4.5, out)})`, t < 7 ? 0 : clamp(lp * 2) * (1 - out));
    lg.style.filter = out > 0.01 ? `blur(${out * 18}px)` : '';
    $('img', lg).style.transform = `translateY(${(1 - lp) * 40}px)`;
    rise($('.title', lg), t, 7.45, 0.14, 0.6);
  }
}

// ===================================================================================
// 2 · DASHBOARD (9.5 – 16.2) — rises from the floor, low hero angle, glides right
// ===================================================================================
{
  const el = scene(9.5, 16.2, `
    <div class="cam" style="perspective:1600px"><div class="rig">${shotHTML(SHOTS.dashboard)}</div></div>
    <div class="scrim-l" id="db-scrim"></div>
    <div class="copy" id="db-copy" style="left:120px;top:330px;width:900px">
      <div class="kicker"><b>01</b>Dashboard</div>
      <div class="title" style="margin-top:34px">${words('See your whole <em>business.</em>')}</div>
      <div style="margin-top:34px;font:450 34px/1.35 Geist;color:var(--dim)" class="sub">${words('Leads, revenue and pipeline. Live.')}</div>
    </div>`, (t) => {
    const s = $('.shot', el);
    const rx = keys(t, [[0, 78], [2.4, 14, E.expo], [3.6, 6], [6.0, 3]]);
    const ry = keys(t, [[0, 0], [2.4, -8], [3.6, -22, E.io], [6.0, -16]]);
    const tx = keys(t, [[2.4, 0], [3.6, 470, E.io], [6.0, 520]]);
    const ty = keys(t, [[0, 700], [2.4, 20, E.expo], [6.0, 0]]);
    const tz = keys(t, [[0, -900], [2.4, -60, E.expo], [3.6, -240], [6.0, -120]]);
    const ex = prog(t, 6.15, 6.7, E.inExpo);
    set(s, `translate3d(${tx - ex * 2600}px,${ty}px,${tz}px) rotateX(${rx}deg) rotateY(${ry + ex * 40}deg)`, clamp(t / 0.4));
    s.style.filter = ex > 0.01 ? `blur(${ex * 14}px)` : '';
    gloss(el, t, 1.6, 3.4);
    $('#db-scrim', el).style.opacity = keys(t, [[2.8, 0], [3.6, 1], [6.1, 1], [6.5, 0]]);
    const c = $('#db-copy', el);
    rise(c, t, 3.3, 0.07);
    fall(c, t, 6.0, 0.02, 0.3);
    $('.kicker', c).style.opacity = keys(t, [[3.2, 0], [3.5, 1], [6.0, 1], [6.2, 0]]);
  });
}

// ===================================================================================
// 3 · CONVERSATIONS (16 – 22.2) — macro pan across the inbox, pull back, channels fly out
// ===================================================================================
const CHANNELS = [['SMS', '#37CA37'], ['Email', '#E5584F'], ['WhatsApp', '#25C26E'], ['Instagram', '#FF4F9A'], ['Facebook', '#3D7BFF'], ['Live chat', '#188BF6'], ['Calls', '#FFBC00']];
{
  const chips = CHANNELS.map(([n, c]) => `<div class="chip"><i style="background:${c}">${n[0]}</i>${n}</div>`).join('');
  const el = scene(16.0, 22.2, `
    <div class="cam" style="perspective:2000px"><div class="rig">${shotHTML(SHOTS.inbox)}</div></div>
    <div class="scrim-b" id="cv-scrimb"></div><div class="scrim-l" id="cv-scrim"></div>
    <div class="copy" id="cv-big" style="left:120px;bottom:110px"><div class="title" style="font-size:150px">${words('Every <span class="g">channel.</span>')}</div></div>
    <div class="copy" id="cv-copy" style="left:120px;top:250px;width:760px">
      <div class="kicker"><b>02</b>Conversations</div>
      <div class="title" style="margin-top:34px">${words('Every channel. <span class="g">One inbox.</span>')}</div>
      <div id="cv-chips" style="margin-top:46px;display:flex;flex-wrap:wrap;gap:16px;width:720px">${chips}</div>
    </div>`, (t) => {
    const s = $('.shot', el);
    const sc = keys(t, [[0, 2.5], [2.5, 2.2], [3.5, 0.74, E.expo], [6.2, 0.7]]);
    const tx = keys(t, [[0, 1500], [2.5, 300, E.lin], [3.5, 400, E.expo], [6.2, 430]]);
    const ty = keys(t, [[0, 500], [2.5, 380, E.lin], [3.5, 30, E.expo], [6.2, 10]]);
    const ry = keys(t, [[0, 0], [2.5, 0], [3.5, -24, E.expo], [6.2, -18]]);
    const rz = keys(t, [[0, -5], [2.5, -3], [3.5, 0, E.expo]]);
    const ex = prog(t, 5.7, 6.2, E.inExpo);
    set(s, `translate3d(${tx}px,${ty - ex * 1500}px,0) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`, clamp(t / 0.25));
    $('#cv-scrimb', el).style.opacity = keys(t, [[2.4, 1], [2.9, 0]]);
    $('#cv-scrim', el).style.opacity = keys(t, [[2.9, 0], [3.5, 1]]) * (1 - ex);
    const big = $('#cv-big', el);
    rise(big, t, 0.25, 0.12, 0.6);
    fall(big, t, 2.35, 0.05);
    const c = $('#cv-copy', el);
    rise(c, t, 3.2, 0.07);
    $('.kicker', c).style.opacity = keys(t, [[3.1, 0], [3.4, 1]]);
    $$('.chip', c).forEach((ch, i) => {
      const p = prog(t, 3.9 + i * 0.13, 4.5 + i * 0.13, E.back);
      set(ch, `translate(${(1 - p) * 900}px, ${(1 - p) * 60}px) scale(${mix(0.6, 1, p)})`, clamp(p * 2));
    });
    set(c, `translateY(${-ex * 1500}px)`);
  });
}

// ===================================================================================
// 4 · PIPELINE / CALENDAR (22 – 28.2) — diagonal split screen, opposing motion
// ===================================================================================
{
  const el = scene(22.0, 28.2, `
    <div class="layer" id="sp-a"><div class="cam"><div class="rig">${shotHTML(SHOTS.pipeline)}</div></div>
      <div class="corner" style="left:-500px;top:-450px;background:radial-gradient(closest-side, rgba(5,8,15,.92), transparent)"></div>
      <div class="copy" style="left:110px;top:110px"><div class="kicker"><b>03</b>Opportunities</div><div class="title" style="margin-top:26px;font-size:92px">${words('Close more <em>deals.</em>')}</div></div></div>
    <div class="layer" id="sp-b"><div class="cam"><div class="rig">${shotHTML(SHOTS.calendar)}</div></div>
      <div class="corner" style="right:-500px;bottom:-450px;background:radial-gradient(closest-side, rgba(5,8,15,.92), transparent)"></div>
      <div class="copy" style="right:110px;bottom:110px;text-align:right"><div class="kicker"><b>04</b>Calendars</div><div class="title" style="margin-top:26px;font-size:92px">${words('Fill your <span class="y">calendar.</span>')}</div></div></div>
    <svg class="layer" viewBox="0 0 1920 1080" style="pointer-events:none"><line id="sp-line" stroke="#188BF6" stroke-width="6"/></svg>`, (t) => {
    const A = $('#sp-a', el), B = $('#sp-b', el);
    // the divider: top x and bottom x, slanted; it slides to give each side its moment
    const d = keys(t, [[0, 960], [1.2, 1080], [3.0, 1180], [3.8, 760, E.expo], [5.5, 700]]);
    const xt = d + 210, xb = d - 210;
    A.style.clipPath = `polygon(0 0, ${xt - 6}px 0, ${xb - 6}px 1080px, 0 1080px)`;
    B.style.clipPath = `polygon(${xt + 6}px 0, 1920px 0, 1920px 1080px, ${xb + 6}px 1080px)`;
    const ln = $('#sp-line', el);
    ['x1', 'y1', 'x2', 'y2'].forEach((k, i) => ln.setAttribute(k, [xt, -20, xb, 1100][i]));
    const inA = prog(t, 0, 0.8, E.expo), inB = prog(t, 0.2, 1.0, E.expo);
    const ex = prog(t, 5.6, 6.2, E.inExpo);
    ln.style.opacity = inB * (1 - ex);
    set($('.shot', A), `translate3d(${-260}px,${mix(-1300, 0, inA) + keys(t, [[0.8, 120], [6.2, -60]]) - ex * 1400}px,-200px) rotateY(20deg) rotateX(6deg) scale(0.95)`);
    set($('.shot', B), `translate3d(${300}px,${mix(1300, 0, inB) + keys(t, [[1, -120], [6.2, 60]]) + ex * 1400}px,-200px) rotateY(-20deg) rotateX(-6deg) scale(0.95)`);
    gloss(el, t, 1.0, 3.0);
    const ca = $('.copy', A), cb = $('.copy', B);
    rise(ca, t, 0.7, 0.08); rise(cb, t, 3.6, 0.08);
    $('.kicker', ca).style.opacity = prog(t, 0.6, 0.9); $('.kicker', cb).style.opacity = prog(t, 3.5, 3.8);
    ca.style.opacity = keys(t, [[3.4, 1], [3.8, 0.35]]) * (1 - ex);
    cb.style.opacity = 1 - ex;
  });
}

// ===================================================================================
// 5 · WORKFLOWS (28 – 34.2) — isometric plane, action nodes hovering above it
// ===================================================================================
const NODES = [['Form submitted', '⚡', '#FFBC00', -420, -220], ['Send SMS', 'S', '#37CA37', -60, -60], ['Wait 1 day', '◷', '#8CA0BD', 280, 110], ['Book appointment', '✓', '#188BF6', 560, 300]];
{
  const nodes = NODES.map(([n, i, c]) => `<div class="node"><i style="background:${c}">${i}</i>${n}</div>`).join('');
  const el = scene(28.0, 34.2, `
    <div class="cam" style="perspective:2200px"><div class="rig" id="wf-rig">
      <div id="wf-shadow" style="width:1700px;height:1000px;margin:-500px 0 0 -850px;border-radius:40px;background:rgba(24,139,246,.25);filter:blur(60px)"></div>
      ${shotHTML(SHOTS.workflows)}
      <svg id="wf-svg" width="1600" height="942" viewBox="-800 -471 1600 942" style="margin:-471px 0 0 -800px;overflow:visible"><path id="wf-path" fill="none" stroke="#188BF6" stroke-width="8" stroke-linecap="round" stroke-dasharray="1 0"/></svg>
      ${nodes}
    </div></div>
    <div class="copy" id="wf-copy" style="right:110px;top:120px;text-align:right">
      <div class="kicker"><b>05</b>Workflows</div>
      <div class="title" style="margin-top:30px">${words('Automate the')}<br>${words('<em>follow-up.</em>')}</div>
    </div>`, (t) => {
    const rig = $('#wf-rig', el);
    const ex = prog(t, 5.65, 6.2, E.inExpo);
    const rx = keys(t, [[0, 62], [6.2, 50]]), rz = keys(t, [[0, -42], [6.2, -24]]);
    set(rig, `translate(${-140}px, ${120 - ex * 300}px) translateZ(${keys(t, [[0, 1600], [1.1, 0, E.expo]]) + ex * 1400}px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(0.9)`, (1 - ex));
    set($('.shot', el), `translateZ(0)`);
    set($('#wf-shadow', el), `translateZ(-60px)`);
    // the path across the plane, drawn as the nodes light up
    const pts = NODES.map((n) => [n[3], n[4]]);
    const dpath = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
    const path = $('#wf-path', el);
    path.setAttribute('d', dpath);
    const len = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len * (1 - prog(t, 1.3, 3.6, E.io))}`;
    set($('#wf-svg', el), 'translateZ(4px)');
    $$('.node', el).forEach((nd, i) => {
      const p = prog(t, 1.2 + i * 0.6, 1.7 + i * 0.6, E.back);
      const [, , , x, y] = NODES[i];
      // counter-rotate so the card stands up toward the camera
      set(nd, `translate3d(${x}px,${y}px,${mix(0, 120 + i * 30, p)}px) rotateZ(${-rz}deg) rotateX(${-rx * 0.85}deg) scale(${mix(0.3, 1, p)})`, clamp(p * 2));
    });
    gloss(el, t, 0.6, 2.4);
    const c = $('#wf-copy', el);
    rise(c, t, 0.9, 0.09);
    $('.kicker', c).style.opacity = keys(t, [[0.8, 0], [1.1, 1]]);
    c.style.opacity = 1 - ex;
  });
}

// ===================================================================================
// 6 · FUNNELS / WEBSITES / MEMBERSHIPS (34 – 40.2) — exploded depth stack
// ===================================================================================
{
  const labels = ['Funnels', 'Websites', 'Courses'];
  const el = scene(34.0, 40.2, `
    <div class="cam" style="perspective:2000px"><div class="rig" id="st-rig">
      ${SHOTS.stack.map((n, i) => `<div class="lyr" style="transform-style:preserve-3d">${shotHTML(n)}<div class="chip" style="position:absolute;left:-800px;top:-560px">${labels[i]}</div></div>`).reverse().join('')}
    </div></div>
    <div class="copy" id="st-copy" style="left:110px;top:120px">
      <div class="kicker"><b>06</b>Funnels &amp; Websites</div>
      <div class="title" style="margin-top:30px">${words('Launch pages')}<br>${words('that <span class="g">sell.</span>')}</div>
    </div>`, (t) => {
    const rig = $('#st-rig', el);
    set(rig, `translate(${keys(t, [[0, 1900], [1.0, 260, E.expo], [6.2, 200]])}px, 60px) rotateY(${keys(t, [[0, -55], [1.0, -34, E.expo], [6.2, -22]])}deg) rotateX(6deg) scale(0.62)`);
    const lyrs = $$('.lyr', el).reverse(); // front first
    const open = prog(t, 1.0, 2.6, E.expo);
    lyrs.forEach((l, i) => {
      const ex = prog(t, 5.4 + i * 0.12, 5.95 + i * 0.12, E.inExpo);
      set(l, `translate3d(${i * 520 * open + ex * 2600}px, ${-i * 90 * open}px, ${-i * 700 * open}px)`, 1 - ex);
      $('.chip', l).style.opacity = prog(t, 1.8 + i * 0.2, 2.2 + i * 0.2);
    });
    gloss(el, t, 2.4, 4.2);
    const c = $('#st-copy', el);
    rise(c, t, 0.8, 0.09);
    $('.kicker', c).style.opacity = keys(t, [[0.7, 0], [1.0, 1], [5.6, 1], [5.9, 0]]);
    fall(c, t, 5.5);
  });
}

// ===================================================================================
// 7 · MONTAGE (40 – 46) — six screens, six camera moves, one per beat pair
// ===================================================================================
{
  const M = SHOTS.montage;
  const el = scene(40.0, 46.0, M.map(([n, label], i) => `
    <div class="layer mt" data-i="${i}">
      <div class="outline">${label.toUpperCase()}</div>
      <div class="cam"><div class="rig">${shotHTML(n)}</div></div>
      <div class="copy" style="left:110px;bottom:96px"><div class="kicker"><b>${String(i + 7).padStart(2, '0')}</b>${label}</div></div>
    </div>`).join(''), (t) => {
    // entrance: [from transform, to transform]
    const MOVES = [
      (p, d) => `translate3d(${mix(1900, 80, p) - d * 120}px,20px,0) rotateY(${mix(-70, -12, p)}deg) scale(.8)`,
      (p, d) => `translate3d(80px,${mix(-1300, 30, p)}px,0) rotateX(${mix(75, 10, p)}deg) rotateZ(${d * 2}deg) scale(.8)`,
      (p, d) => `translate3d(60px,20px,0) rotateZ(${mix(-30, -3, p) + d * 2}deg) scale(${mix(0.2, 0.8, p) + d * 0.03})`,
      (p, d) => `translate3d(100px,10px,${mix(-4000, 0, p) + d * 150}px) rotateY(${mix(40, 14, p)}deg) scale(.8)`,
      (p, d) => `translate3d(${mix(-1900, 60, p)}px,20px,0) rotateY(${mix(80, 12, p) - d * 4}deg) scale(.8)`,
      (p, d) => `translate3d(80px,${mix(1300, 20, p)}px,0) rotateX(${mix(-70, -8, p) + d * 3}deg) scale(.8)`,
    ];
    $$('.mt', el).forEach((L, i) => {
      const a = i, lt = t - a;
      const on = lt >= 0 && lt < 1;
      L.style.display = on ? '' : 'none';
      if (!on) return;
      const p = prog(lt, 0, 0.42, E.expo);
      const d = lt; // drift
      $('.shot', L).style.transform = MOVES[i](p, d);
      $('.outline', L).style.transform = `translateX(${mix(i % 2 ? -400 : 0, i % 2 ? 0 : -400, lt)}px)`;
      $('.copy', L).style.transform = `translateY(${(1 - prog(lt, 0.08, 0.4, E.expo)) * 60}px)`;
      $('.copy', L).style.opacity = prog(lt, 0.08, 0.3);
    });
  });
}

// ===================================================================================
// 8 · THE WALL (46 – 52.2) — every screen on one wall, the camera pulls back
// ===================================================================================
{
  const tiles = SHOTS.wall.map((n) => `<div class="tile" style="width:560px;height:330px;margin:-165px 0 0 -280px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.15),0 30px 60px rgba(0,0,0,.5)"><img data-src="shots/${n}.png" style="width:560px;height:315px;display:block;margin-top:15px" alt=""><div style="position:absolute;left:0;right:0;top:0;height:15px;background:#10151F"></div></div>`).join('');
  const el = scene(46.0, 52.2, `
    <div class="cam" style="perspective:1700px"><div class="rig" id="wl-rig">${tiles}</div></div>
    <div class="layer" id="wl-dim" style="background:radial-gradient(ellipse at 50% 50%, rgba(5,8,15,.92) 20%, rgba(5,8,15,.55) 70%)"></div>
    <div class="copy" id="wl-copy" style="left:0;right:0;top:380px;text-align:center">
      <div class="title" style="font-size:150px">${words('All of it.')}</div>
      <div class="title" style="font-size:150px;margin-top:10px">${words('<em>One login.</em>')}</div>
    </div>`, (t) => {
    const rig = $('#wl-rig', el);
    const z = keys(t, [[0, 1300], [3.2, -700, E.io], [6.2, -900]]);
    set(rig, `translateZ(${z}px) rotateY(${keys(t, [[0, -34], [3.2, -16], [6.2, -10]])}deg) rotateX(${keys(t, [[0, 12], [3.2, 6]])}deg)`);
    const col = 4;
    $$('.tile', el).forEach((tl, i) => {
      const gx = ((i % col) - 1.5) * 600, gy = (Math.floor(i / col) - 1) * 370;
      const p = prog(t, i * 0.05, 0.6 + i * 0.05, E.expo);
      const conv = prog(t, 5.25 + (i % 5) * 0.03, 6.0 + (i % 5) * 0.03, E.inExpo);
      set(tl, `translate3d(${mix(gx, 0, conv)}px,${mix(gy, 0, conv)}px,${mix(-600, 0, p) - conv * 800}px) rotateZ(${conv * (i % 2 ? 90 : -90)}deg) scale(${1 - conv * 0.9})`, clamp(p * 2) * (1 - conv));
    });
    $('#wl-dim', el).style.opacity = keys(t, [[2.2, 0], [3.0, 1], [5.1, 1], [5.6, 0]]);
    const c = $('#wl-copy', el);
    rise(c, t, 2.6, 0.12, 0.6);
    fall(c, t, 5.1, 0.04);
  });
}

// ===================================================================================
// 9 · END CARD (52 – 60) — logo, promise, URL; an orbit of screens slows to a stop
// ===================================================================================
{
  const ORB = ['dashboard', 'conversations', 'opportunities', 'calendars', 'workflows', 'funnels', 'social', 'reporting'];
  const orbit = ORB.map((n) => `<div class="ob" style="width:420px;height:236px;margin:-118px 0 0 -210px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.15)"><img data-src="shots/${n}.png" style="width:420px;height:236px;display:block" alt=""></div>`).join('');
  const el = scene(52.0, DUR + 1, `
    <div class="cam" style="perspective:1600px"><div class="rig" id="en-rig">${orbit}</div></div>
    <div class="layer" style="background:radial-gradient(ellipse at 50% 50%, rgba(5,8,15,.94) 25%, rgba(5,8,15,.5) 75%)"></div>
    <div class="copy" id="en-copy" style="left:0;right:0;top:260px;text-align:center">
      <img id="en-logo" src="assets/HighLevel-logo-white.png" style="width:520px;height:auto" alt="HighLevel">
      <div class="title" style="margin-top:64px;font-size:96px">${words('Run your entire business')}<br>${words('from <em>one place.</em>')}</div>
      <div style="margin-top:70px"><div class="pill" id="en-pill"><span>app.gohighlevel.com</span><span style="font-weight:400">→</span><div class="sheen"></div></div></div>
    </div>`, (t) => {
    const rig = $('#en-rig', el);
    // spin decelerates to zero by 6 s (58 s), so the last two seconds hold perfectly still
    const spinT = Math.min(t, 6);
    const ang = 40 * spinT - (40 / 12) * spinT * spinT; // d/dt = 40 - 6.67t → 0 at t=6
    set(rig, `translateY(330px) translateZ(-500px) rotateX(-12deg) rotateY(${ang}deg)`);
    $$('.ob', el).forEach((o, i) => {
      const a = (i / ORB.length) * 360;
      const p = prog(t, 0.1 + i * 0.05, 0.9 + i * 0.05, E.expo);
      set(o, `rotateY(${a}deg) translateZ(${mix(200, 900, p)}px)`, p * 0.6);
    });
    const lg = $('#en-logo', el);
    const lp = prog(t, 0.2, 1.0, E.back);
    set(lg, `translateY(${(1 - lp) * 30}px) scale(${mix(0.8, 1, lp)})`, clamp(lp * 2));
    rise($('.title', el), t, 0.7, 0.08, 0.6);
    const pp = prog(t, 1.8, 2.5, E.back);
    const pill = $('#en-pill', el);
    set(pill, `scale(${mix(0.6, 1, pp)})`, clamp(pp * 2));
    $('.sheen', pill).style.transform = `translateX(${mix(-120, 120, prog(t, 2.6, 3.6, E.io))}%)`;
  });
}

// ---------- frame driver ----------
window.seek = function seek(t) {
  paintBG(t);
  for (const s of scenes) {
    const on = t >= s.a && t < s.b;
    s.el.style.display = on ? '' : 'none';
    if (!on) continue;
    // images load lazily, only while their scene is on screen, to keep memory low
    $$('img[data-src]', s.el).forEach((im) => { if (!im.src) im.src = im.dataset.src; });
    s.paint(t - s.a);
  }
};
// resolves when every image is decoded (the renderer awaits this once before frame 0)
window.ready = async function ready() {
  await document.fonts.ready;
  const ims = $$('img');
  ims.forEach((im) => { if (!im.src && im.dataset.src) im.src = im.dataset.src; });
  const failed = [];
  await Promise.all(ims.map((im) => im.decode().catch(() => failed.push(im.dataset.src || im.src))));
  return { images: ims.length, failed: [...new Set(failed)] };
};
window.DUR = DUR;
seek(Number(new URLSearchParams(location.search).get('t') || 0));
