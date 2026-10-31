// Original synthesized score for "One Light-Day" (nothing sampled or licensed). Hits follow timing.js.
//   node audio.mjs out/score.wav
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = {};
vm.runInNewContext(readFileSync(path.join(here, 'timing.js'), 'utf8'), { globalThis: ctx });
const T = ctx.TIMING;

const SR = 48000, DUR = T.DUR, N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function add(t0, len, gain, pan, fn) {
  const a = Math.floor(t0 * SR), n = Math.floor(len * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n && a + i < N; i++) { if (a + i < 0) continue; const v = fn(i / SR, i / n); L[a + i] += v * gl; R[a + i] += v * gr; }
}
const tone = (t, m, len, g, pan = 0, shape = 'sine', atk = 0.01) => add(t, len, g, pan, (s, u) => {
  const f = hz(m), ph = 2 * Math.PI * f * s;
  const w = shape === 'saw' ? Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.33 * Math.sin(3 * ph) + 0.2 * Math.sin(4 * ph)
    : shape === 'bell' ? Math.sin(ph) + 0.4 * Math.sin(ph * 2.76) * Math.exp(-s * 3) + 0.2 * Math.sin(ph * 5.4) * Math.exp(-s * 6)
    : Math.sin(ph);
  return w * Math.min(1, s / atk) * Math.pow(1 - u, 1.6);
});
// a slow-attack pad that swells and releases
const pad = (t, m, len, g, pan = 0) => add(t, len, g, pan, (s, u) => {
  const ph = 2 * Math.PI * hz(m) * s, det = 2 * Math.PI * hz(m + 0.08) * s;
  return (Math.sin(ph) + 0.6 * Math.sin(det) + 0.25 * Math.sin(2 * ph)) * Math.sin(Math.PI * u) ** 1.2;
});
const kick = (t, g = 0.9) => add(t, 0.6, g, 0, (s) => Math.sin(2 * Math.PI * (40 * s + 100 * (1 - Math.exp(-s * 28)) / 28)) * Math.exp(-s * 6));
// a camera shutter: two filtered clicks and a tiny mechanical ring
function shutter(t, g = 0.35, pan = 0) {
  [0, 0.045].forEach((o, k) => { let lp = 0; add(t + o, 0.05, g * (k ? 0.7 : 1), pan, (s) => { lp += (rnd() - lp) * 0.55; return lp * Math.exp(-s * 120); }); });
  add(t, 0.09, g * 0.25, pan, (s) => Math.sin(2 * Math.PI * 3100 * s) * Math.exp(-s * 70));
}
function impact(t, g = 0.9) { kick(t, g); add(t, 2.2, g * 0.3, 0, (s) => rnd() * Math.exp(-s * 2.8) * 0.6); tone(t, 29, 3, g * 0.5, 0, 'sine', 0.003); }
function whoosh(t0, t1, g = 0.18, reverse = false) {
  let lp = 0;
  add(t0, t1 - t0, g, 0, (s, u) => { const k = reverse ? 1 - u : u; lp += (rnd() - lp) * (0.015 + 0.4 * k * k); return lp * Math.sin(Math.PI * u) ** 0.7; });
}
// a radio pip, like a deep-space carrier tone
const pip = (t, g = 0.06, f = 1320, len = 0.09) => add(t, len, g, 0.2, (s, u) => Math.sin(2 * Math.PI * f * s) * Math.min(1, s / 0.004) * (1 - u) ** 0.5);

// ---- 0–3.4: the hook. deep drone, a heartbeat-pip synced to the pulsing dot, a lift into the cut
[33, 40, 45].forEach((m, i) => pad(-0.6, m, 4.4, [0.18, 0.08, 0.05][i], i - 1));
for (let t = 0.2; t < T.launch - 0.2; t += 1 / 1.2) pip(t, 0.05);
whoosh(2.6, T.launch, 0.2);

// ---- 3.4–9.4: launch and the record. a warm D-major bed, a shutter on every print
impact(T.launch, 1.0); shutter(T.launch - 0.04, 0.4);
const bed = [[50, [62, 66, 69, 73]], [47, [62, 66, 69, 71]], [43, [59, 62, 66, 71]], [45, [61, 64, 69, 73]]];
bed.forEach(([root, ch], i) => {
  const t = T.launch + i * 1.5;
  pad(t, root - 12, 2.4, 0.12); pad(t, root, 2.4, 0.06);
  ch.forEach((m, k) => pad(t, m, 2.2, 0.022, k / 2 - 0.75));
});
shutter(T.record - 0.04, 0.4); impact(T.record, 0.6);
shutter(T.recordSecond - 0.04, 0.35, 0.4); kick(T.recordSecond, 0.5);
// a little golden-record glint: an ascending bell figure
[74, 78, 81, 86].forEach((m, i) => tone(T.record + 0.35 + i * 0.12, m, 1.6, 0.05, i / 2 - 0.7, 'bell', 0.002));

// ---- 9.4–15.8: the montage. a pulse that tightens with the cuts; one shutter + bell per print
impact(T.montage, 0.55);
const scale = [62, 64, 66, 69, 71, 73, 74, 76, 78, 81, 83];
T.lands.forEach((t, i) => {
  shutter(t - 0.03, 0.33, (i % 3 - 1) * 0.5);
  kick(t, 0.55 + i * 0.02);
  tone(t, scale[i], 1.2, 0.06, (i % 2) - 0.5, 'bell', 0.002);
  tone(t, 38, 0.5, 0.18, 0, 'sine', 0.004);
});
for (let i = 0; i < T.lands.length - 1; i++) {   // off-beat ticks between landings
  const mid = (T.lands[i] + T.lands[i + 1]) / 2;
  add(mid, 0.03, 0.05, 0.3, (s) => rnd() * Math.exp(-s * 160));
}
[[9.4, 38], [11.35, 35], [13.05, 31], [14.25, 33]].forEach(([t, m]) => pad(t, m, 2.3, 0.1));
whoosh(14.9, T.turn, 0.28);
add(14.6, T.turn - 14.6, 0.12, 0, (s, u) => Math.sin(2 * Math.PI * (300 * s + 1400 * s * u)) * u * u);

// ---- 15.8–19.4: the turn. the music drops out; a sub, a lone tone, then the whip
add(T.turn, 0.02, 0, 0, () => 0);
pad(T.turn, 26, 3.8, 0.16); pad(T.turn + 0.2, 57, 3.4, 0.025, 0.3);
for (let t = T.turn + 0.3; t < T.whip; t += 1 / 1.2) pip(t, 0.035, 990);
whoosh(T.whip - 0.2, T.portrait + 0.1, 0.32, false);
add(T.whip, T.portrait - T.whip, 0.08, 0, (s, u) => Math.sin(2 * Math.PI * (1600 * s - 1200 * s * u)) * Math.sin(Math.PI * u));

// ---- 19.4–26.4: home. the emotional turn — F, C, Am, G — and a bell when the ring closes
impact(T.portrait, 0.85); shutter(T.portrait - 0.04, 0.35);
const prog = [[41, [57, 60, 65, 69]], [36, [55, 60, 64, 67]], [45, [57, 60, 64, 69]], [43, [55, 59, 62, 67]]];
prog.forEach(([root, ch], i) => {
  const t = T.portrait + i * 1.75;
  pad(t, root - 12, 2.8, 0.14); pad(t, root, 2.8, 0.06);
  ch.forEach((m, k) => pad(t, m, 2.6, 0.026, k / 2 - 0.75));
});
[[T.portrait + 0.4, 76], [T.portrait + 1.3, 74], [T.portrait + 2.2, 72], [T.dot + 0.2, 69], [T.dot + 0.6, 71]].forEach(([t, m]) => tone(t, m, 2.2, 0.06, 0.2, 'bell', 0.003));
shutter(T.dot - 0.04, 0.3); kick(T.dot, 0.5);
tone(T.circle + 0.7, 88, 3.5, 0.08, 0, 'bell', 0.002); tone(T.circle + 0.72, 93, 3.5, 0.05, 0.3, 'bell', 0.002);
[[45, [64, 69, 72, 76]], [41, [60, 65, 69, 72]]].forEach(([root, ch], i) => {
  const t = T.circle + 0.6 + i * 1.6;
  pad(t, root - 12, 2.6, 0.12);
  ch.forEach((m, k) => pad(t, m, 2.4, 0.025, k / 2 - 0.75));
});

// ---- 26.4–30: the pull-back and the sign-off. swell, silence, then "HI" in Morse on the carrier
whoosh(26.6, 27.7, 0.2, true);
[[29, 0.16], [41, 0.08], [60, 0.03], [64, 0.025], [67, 0.025], [72, 0.02], [79, 0.012]].forEach(([m, g], i) => pad(26.4, m, 4.0, g, (i % 2) * 0.6 - 0.3));
const dit = 0.075;
let mt = T.hello + 0.05;
for (const sym of '.... ..') {  // H I
  if (sym === ' ') { mt += dit * 2; continue; }
  pip(mt, 0.07, 1320, dit * 0.9); mt += dit * 2;
}
tone(T.hello, 81, 2.5, 0.06, 0, 'bell', 0.002); tone(T.hello + 0.75, 76, 2.2, 0.045, 0, 'bell', 0.002);

// ---- master: soft clip, fade the tail, normalise to -1 dBFS
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = t > DUR - 1.4 ? Math.max(0, (DUR - t) / 1.4) : 1, fin = Math.min(1, t / 0.05);
  L[i] = Math.tanh(L[i] * 1.3) * fade * fin; R[i] = Math.tanh(R[i] * 1.3) * fade * fin;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = 0.89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * gain * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * gain * 32767), 46 + i * 4); }
const out = process.argv[2] || path.join(here, 'out/score.wav');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, buf);
process.stdout.write(`wrote ${out}\n`);
