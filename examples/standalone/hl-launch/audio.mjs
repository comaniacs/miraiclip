// Original synthesized score for "One Login" (nothing sampled or licensed). 120 BPM, Am–F–C–G.
//   node audio.mjs out/score.wav
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SR = 48000, DUR = 60, N = SR * DUR, BEAT = 0.5;
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function add(t0, len, gain, pan, fn) {
  const a = Math.floor(t0 * SR), n = Math.floor(len * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n && a + i < N; i++) { if (a + i < 0) continue; const v = fn(i / SR, i / n); L[a + i] += v * gl; R[a + i] += v * gr; }
}
const kick = (t, g = 0.9) => add(t, 0.45, g, 0, (s) => Math.sin(2 * Math.PI * (45 * s + 90 * (1 - Math.exp(-s * 30)) / 30)) * Math.exp(-s * 7));
const clap = (t, g = 0.25) => add(t, 0.22, g, 0, (s) => rnd() * Math.exp(-s * 22) * (1 + 0.6 * Math.sin(s * 900)));
const hat = (t, g = 0.08, pan = 0.25) => { let p = 0; add(t, 0.06, g, pan, (s) => { const x = rnd(); const h = x - p; p = x; return h * Math.exp(-s * 70); }); };
const tone = (t, m, len, g, pan = 0, shape = 'sine', atk = 0.01) => add(t, len, g, pan, (s, u) => {
  const f = hz(m), ph = 2 * Math.PI * f * s;
  const w = shape === 'saw' ? Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.33 * Math.sin(3 * ph) + 0.25 * Math.sin(4 * ph)
    : shape === 'bell' ? Math.sin(ph) + 0.4 * Math.sin(ph * 2.76) * Math.exp(-s * 3) : Math.sin(ph);
  return w * Math.min(1, s / atk) * Math.pow(1 - u, 1.6);
});
function whoosh(t0, t1, g = 0.18, up = true) {
  let lp = 0;
  add(t0, t1 - t0 + 0.25, g, 0, (s, u) => { const k = up ? u : 1 - u; lp += (rnd() - lp) * (0.02 + 0.5 * k * k); return lp * Math.sin(Math.PI * Math.min(1, u * 1.15)); });
}
function impact(t, g = 0.9) { kick(t, g); add(t, 1.6, g * 0.35, 0, (s) => rnd() * Math.exp(-s * 3.5)); tone(t, 33, 2.2, g * 0.5, 0, 'sine', 0.002); }
const riser = (t0, t1, g = 0.12) => add(t0, t1 - t0, g, 0, (s, u) => Math.sin(2 * Math.PI * (200 * s + 900 * s * u)) * u * u + rnd() * u * u * 0.4);

// ---- 0–7: the hook. a held drone, ticking time, a pluck per tool card, three slams, a broken glitch, a riser
[45, 52, 57].forEach((m, i) => tone(0, m, 7.0, 0.07, i - 1, 'saw', 1.5));
for (let t = 0; t < 6; t += BEAT / 2) hat(t, 0.03 + 0.05 * (t / 6));
for (let i = 0; i < 12; i++) tone(0.95 + i * 0.11, [69, 72, 76, 79][i % 4] + (i > 7 ? 12 : 0), 0.35, 0.12, (i % 3) - 1, 'bell', 0.002);
[2.5, 2.9, 3.3].forEach((t, i) => { kick(t, 0.8); clap(t, 0.2); tone(t, [57, 60, 63][i], 0.4, 0.15, 0, 'saw', 0.002); });
for (let t = 3.9; t < 5.8; t += 0.125) if (rnd() > -0.2) add(t, 0.07, 0.07, rnd(), (s) => Math.sign(Math.sin(s * 2 * Math.PI * (300 + 900 * Math.abs(rnd()))))* Math.exp(-s * 40));
riser(5.6, 7.0, 0.14);
impact(7.0, 1.0);
[57, 64, 69, 72, 76].forEach((m, i) => tone(7.0 + i * 0.03, m, 2.6, 0.06, (i % 2) * 0.8 - 0.4, 'bell', 0.005));

// ---- 7–52: the groove (pad from 7, drums from 9.5)
const CH = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]];
for (let bar = 0, t = 7.5; t < 52; bar++, t += 4 * BEAT) {
  const [root, chord] = CH[bar % 4];
  chord.forEach((m, i) => tone(t, m, 4 * BEAT + 0.2, 0.035, i - 1, 'saw', 0.25));
  for (let b = 0; b < 4; b++) {
    const tb = t + b * BEAT;
    if (tb >= 52) break;
    const drums = tb >= 9.5 && !(tb >= 50.5);
    if (drums) {
      kick(tb, 0.75);
      if (b % 2) clap(tb, 0.17);
      hat(tb + BEAT / 2, 0.07, 0.3); hat(tb + BEAT / 4, 0.03, -0.3); hat(tb + 3 * BEAT / 4, 0.03, -0.3);
      tone(tb + BEAT / 2, root, BEAT * 0.45, 0.22, 0, 'saw', 0.005);
      tone(tb, root - 12, BEAT * 0.4, 0.25, 0, 'sine', 0.005);
    }
  }
}
// scene transitions and the montage: a whoosh into each cut
[9.1, 15.7, 21.7, 27.7, 33.7, 39.6, 40.7, 41.7, 42.7, 43.7, 44.7, 45.6].forEach((t) => whoosh(t, t + 0.4, 0.16));
[16, 22, 28, 34, 40, 46].forEach((t) => impact(t, 0.5));
// UI ticks: channel chips, workflow nodes, stack layers
for (let i = 0; i < 7; i++) tone(16 + 3.9 + i * 0.13, 76 + [0, 2, 4, 7, 9, 12, 14][i], 0.25, 0.07, i / 3 - 1, 'bell', 0.002);
for (let i = 0; i < 4; i++) tone(28 + 1.2 + i * 0.6, [64, 67, 71, 76][i], 0.6, 0.09, 0, 'bell', 0.002);
[35.8, 36.0, 36.2].forEach((t, i) => tone(t, 72 + i * 4, 0.4, 0.07, i - 1, 'bell', 0.002));
// the wall: build to the end card
riser(50.0, 52.0, 0.16);
impact(52.0, 1.0);
// ---- 52–60: the resolve. full chord, a bell on the URL, then let it ring out
[33, 45, 57, 64, 69, 72, 76, 81].forEach((m, i) => tone(52 + i * 0.02, m, 7.5, m < 50 ? 0.12 : 0.045, (i % 2) * 0.7 - 0.35, m < 50 ? 'sine' : 'saw', 0.02));
tone(53.8, 88, 3, 0.07, 0.2, 'bell', 0.002); tone(53.95, 93, 3, 0.05, -0.2, 'bell', 0.002);

// ---- master: soft clip, fade the tail, normalise to -1 dBFS
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = t > 57.5 ? Math.max(0, (60 - t) / 2.5) : 1, fin = Math.min(1, t / 0.05);
  L[i] = Math.tanh(L[i] * 1.2) * fade * fin; R[i] = Math.tanh(R[i] * 1.2) * fade * fin;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = 0.89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * gain * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * gain * 32767), 46 + i * 4); }
const out = process.argv[2] || 'out/score.wav';
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log(`wrote ${out}`);
