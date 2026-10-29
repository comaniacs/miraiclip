// The score and sound design for "Old Light", synthesized from scratch (no samples, nothing licensed) from the
// same timeline as the picture: a pad that moves Dm → Bb → F → C → D, a glassy tick on every micro collision,
// whooshes under the zoom and the ride, impacts at the breakout and the landing, and two bells.
//
//   node audio.mjs [out.wav]   writes a 48 kHz stereo 16-bit WAV, exactly T.DUR seconds
import fs from "node:fs";
import { T, collisionTimes } from "./timeline.mjs";

const SR = 48000, N = Math.round(T.DUR * SR);
const L = new Float32Array(N), Rt = new Float32Array(N), sendL = new Float32Array(N), sendR = new Float32Array(N);
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
function put(i, l, r, send = 0) { if (i < 0 || i >= N) return; L[i] += l; Rt[i] += r; sendL[i] += l * send; sendR[i] += r * send; }
const panLR = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

// ---- the pad: chords cross-fade over 0.9 s; each note is three slightly detuned sines with a soft octave
const CHORDS = [
  [0, [38, 50, 53, 57, 62]], // Dm
  [T.walkStart, [34, 46, 50, 53, 58]], // Bb
  [T.breakout, [41, 48, 53, 57, 60, 65]], // F, the lift
  [T.landing, [36, 43, 48, 52, 55, 60]], // C
  [T.title, [38, 45, 50, 54, 57, 62, 66]], // D major, the resolution
];
function chordGain(k, t) {
  const start = CHORDS[k][0], end = k + 1 < CHORDS.length ? CHORDS[k + 1][0] : 1e9;
  const inG = k === 0 ? sm(t / 0.15) : sm((t - start + 0.45) / 0.9), outG = 1 - sm((t - end + 0.45) / 0.9);
  return Math.sqrt(inG * outG);
}
const phases = CHORDS.map((c) => c[1].map(() => [rnd(), rnd(), rnd()].map((p) => p * Math.PI * 2)));
for (let i = 0; i < N; i++) {
  const t = i / SR;
  // intensity: builds through the zoom, dips for the rest, swells at the breakout, settles at the end
  let level = 0.55 + 0.25 * sm((t - 4) / 5) - 0.35 * sm((t - T.convEnd) / 0.3) * (1 - sm((t - T.breakout + 0.05) / 0.1));
  level += 0.35 * sm((t - T.breakout) / 1.2) * (1 - sm((t - 19) / 3)) + 0.1 * sm((t - T.title) / 1.0);
  const bright = 0.15 + 0.35 * sm((t - T.breakout) / 1.5) * (1 - sm((t - 24) / 3));
  let l = 0, r = 0;
  CHORDS.forEach((c, k) => {
    const g = chordGain(k, t);
    if (g < 1e-4) return;
    c[1].forEach((m, j) => {
      const f = hz(m), ph = phases[k][j], amp = (m < 45 ? 0.9 : 0.55) * g / c[1].length;
      const lfo = 1 + 0.15 * Math.sin(2 * Math.PI * (0.11 + j * 0.03) * t + ph[0]);
      const v1 = Math.sin(2 * Math.PI * f * 0.998 * t + ph[0]), v2 = Math.sin(2 * Math.PI * f * 1.002 * t + ph[1]);
      const v3 = Math.sin(2 * Math.PI * f * 2.001 * t + ph[2]) * bright;
      const s = amp * lfo * (v1 + v2 + v3) * 0.5;
      const p = ((j % 2) ? 0.35 : -0.35);
      l += s * (1 - p) * 0.5; r += s * (1 + p) * 0.5;
    });
  });
  put(i, l * level * 0.5, r * level * 0.5, 0.25);
}

// ---- the collision ticks: a glassy ping and a click, quieter as they speed up into a shimmer
collisionTimes().forEach((c, k) => {
  const f = 2100 + rnd() * 1100, amp = k < 6 ? 0.16 : Math.max(0.025, 0.12 * Math.pow(0.95, k - 6));
  const [pl, pr] = panLR(rnd() * 1.2 - 0.6), i0 = Math.round(c * SR);
  for (let n = 0; n < SR * 0.25; n++) {
    const tt = n / SR, s = amp * (Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 28) + (n < 140 ? (rnd() * 2 - 1) * Math.exp(-n / 30) * 0.6 : 0));
    put(i0 + n, s * pl, s * pr, 0.5);
  }
});

// the random walk across the Sun: fainter, lower ticks scattered under the drawing thread
for (let k = 0; k < 34; k++) {
  const c = T.walkStart + 0.1 + (T.walkEnd - T.walkStart - 0.2) * (k + rnd() * 0.8) / 34, f = 1500 + rnd() * 700;
  const [pl, pr] = panLR(rnd() * 1.4 - 0.7), i0 = Math.round(c * SR), amp = 0.035 + rnd() * 0.02;
  for (let n = 0; n < SR * 0.2; n++) { const s = amp * Math.sin(2 * Math.PI * f * n / SR) * Math.exp(-n / SR * 34); put(i0 + n, s * pl, s * pr, 0.6); }
}

// ---- whooshes: noise through a resonant band-pass whose centre sweeps
function whoosh(t0, t1, f0, f1, amp, pan = 0) {
  let low = 0, band = 0;
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR), i1 = Math.round(t1 * SR);
  for (let i = i0; i < i1; i++) {
    const u = (i - i0) / (i1 - i0), f = f0 * Math.pow(f1 / f0, u * u), F = 2 * Math.sin(Math.PI * Math.min(f, 8000) / SR);
    const x = rnd() * 2 - 1; low += F * band; const high = x - low - 0.7 * band; band += F * high;
    const env = sm(u / 0.35) * (1 - sm((u - 0.7) / 0.3));
    put(i, band * amp * env * pl, band * amp * env * pr, 0.3);
  }
}
whoosh(T.zoomStart - 0.2, T.zoomEnd, 250, 2600, 0.11, -0.2);
whoosh(T.breakout + 0.15, T.landing - 0.05, 400, 5200, 0.12, 0.2);

// ---- impacts: a falling sine thump with a soft noise body
function impact(t0, amp, f0 = 62, f1 = 36) {
  const i0 = Math.round(t0 * SR); let ph = 0, low = 0;
  for (let n = 0; n < SR * 1.6; n++) {
    const tt = n / SR, f = f1 + (f0 - f1) * Math.exp(-tt * 9); ph += 2 * Math.PI * f / SR;
    low += 0.04 * ((rnd() * 2 - 1) - low);
    const s = amp * (Math.sin(ph) * Math.exp(-tt * 2.6) + low * 2.5 * Math.exp(-tt * 14));
    put(i0 + n, s, s, 0.35);
  }
}
impact(T.breakout, 0.5);
impact(T.landing, 0.32, 70, 44);

// ---- bells: a few inharmonic partials, long decay
function bell(t0, f, amp, pan = 0) {
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR), parts = [[1, 1, 1.6], [2.0, 0.45, 2.2], [2.76, 0.35, 3.0], [5.4, 0.12, 5.0]];
  for (let n = 0; n < SR * 3.5; n++) {
    const tt = n / SR; let s = 0;
    parts.forEach(([m, a, d]) => { s += a * Math.sin(2 * Math.PI * f * m * tt) * Math.exp(-tt * d); });
    s *= amp * sm(tt / 0.004);
    put(i0 + n, s * pl, s * pr, 0.6);
  }
}
bell(T.barTick, hz(81), 0.07, 0.3); // the blue tick lands
bell(T.title, hz(74), 0.09, -0.15); // the lockup
bell(T.sub, hz(78), 0.05, 0.15);

// ---- a small Schroeder reverb on the send bus
function reverb(inp, delays) {
  const out = new Float32Array(N);
  delays.forEach((d) => { const buf = new Float32Array(d); let k = 0; for (let i = 0; i < N; i++) { const y = buf[k]; buf[k] = inp[i] + y * 0.82; out[i] += y; k = (k + 1) % d; } });
  [347, 113].forEach((d) => { const buf = new Float32Array(d); let k = 0; for (let i = 0; i < N; i++) { const y = buf[k], x = out[i]; buf[k] = x + y * 0.6; out[i] = y - 0.6 * x; k = (k + 1) % d; } });
  return out;
}
const revL = reverb(sendL, [1557, 1617, 1491, 1422]), revR = reverb(sendR, [1277, 1356, 1188, 1116]);

// ---- master: reverb in, a fade to silence that ends exactly at T.DUR, soft clip, normalize to -1 dBFS
const out = Buffer.alloc(44 + N * 4);
let peak = 0;
const mixL = new Float32Array(N), mixR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = t < 27.6 ? 1 : Math.pow(1 - clamp01((t - 27.6) / (T.DUR - 27.6)), 2.2);
  mixL[i] = Math.tanh((L[i] + revL[i] * 0.16) * 1.1) * fade;
  mixR[i] = Math.tanh((Rt[i] + revR[i] * 0.16) * 1.1) * fade;
  peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i]));
}
const gain = Math.pow(10, -1 / 20) / peak;
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 4, 4); out.write("WAVE", 8); out.write("fmt ", 12);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write("data", 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixL[i] * gain)) * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixR[i] * gain)) * 32767), 46 + i * 4);
}
const file = process.argv[2] || new URL("./out/old-light-score.wav", import.meta.url).pathname;
fs.writeFileSync(file, out);
console.log(`wrote ${file} (${(N / SR).toFixed(3)} s, peak normalized to -1 dBFS)`);
