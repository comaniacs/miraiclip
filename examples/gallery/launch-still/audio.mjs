// The score and sound design for "STILL", synthesized from scratch (no samples, nothing licensed) from the same
// timeline as the picture. Material: wood and machined metal for the object, glass for the light, soft synth for
// the music. The arc: a low drone under the ring drawing itself → a bloom when it closes → a quiet pulse through the
// craft and the turn (a crisp detent per minute) → the noise (clashing notification pings, a tense cluster) → the
// wave drops everything to one open, calm chord → bells on the name.
//
//   node audio.mjs [out.wav]   writes a 48 kHz stereo 16-bit WAV, exactly T.DUR seconds
import fs from "node:fs";
import { T, detentTimes, hookTicks } from "./timeline.mjs";

const SR = 48000, N = Math.round(T.DUR * SR);
const L = new Float32Array(N), R = new Float32Array(N), sendL = new Float32Array(N), sendR = new Float32Array(N);
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const panLR = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];
function put(i, l, r, send = 0) { if (i < 0 || i >= N) return; L[i] += l; R[i] += r; sendL[i] += l * send; sendR[i] += r * send; }

// ---- the pad: chords cross-fade; each note is two detuned sines and a soft octave, brightness set by the scene
const CHORDS = [
  [0, [33, 45, 52], 0.0], // A drone, open fifth: anticipation
  [T.ringFull, [41, 53, 57, 60, 64], 0.25], // Fmaj7: the bloom
  [T.macro[0], [38, 50, 53, 57, 64], 0.2], // Dm9: the close look
  [T.turnIn, [41, 48, 55, 57, 60, 64], 0.3], // Fmaj9: the feature
  [T.pings[0], [40, 52, 58, 59, 65], 0.55], // E with a b9 and a tritone: the noise
  [T.wave, [36, 48, 55, 62, 64, 67], 0.15], // C add9, wide and quiet: calm
  [T.title, [41, 48, 57, 60, 64, 67, 72], 0.3], // Fmaj9 over the name
];
function chordGain(k, t) {
  const start = CHORDS[k][0], end = k + 1 < CHORDS.length ? CHORDS[k + 1][0] : 1e9, x = k === 5 ? 0.15 : 0.5;
  const inG = k === 0 ? sm(t / 0.6) : sm((t - start + x / 2) / x), outG = 1 - sm((t - end + 0.25) / 0.5);
  return Math.sqrt(inG * outG);
}
const phases = CHORDS.map((c) => c[1].map(() => [rnd(), rnd(), rnd()].map((p) => p * Math.PI * 2)));
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let level = 0.35 + 0.35 * sm((t - 0.2) / 3.4) + 0.25 * Math.exp(-Math.max(0, t - T.ringFull) * 1.5) * (t > T.ringFull ? 1 : 0);
  level += 0.15 * sm((t - T.pings[0]) / 2) * (1 - sm((t - T.wave) / 0.08)); // the noise swells
  level -= 0.12 * sm((t - T.wave) / 0.2) * (1 - sm((t - T.title + 0.6) / 1.2)); // the calm is quieter
  let l = 0, r = 0;
  CHORDS.forEach((c, k) => {
    const g = chordGain(k, t);
    if (g < 1e-4) return;
    c[1].forEach((m, j) => {
      const f = hz(m), ph = phases[k][j], amp = (m < 45 ? 0.95 : 0.5) * g / c[1].length;
      const lfo = 1 + 0.18 * Math.sin(2 * Math.PI * (0.13 + j * 0.037) * t + ph[0]);
      const s = amp * lfo * 0.5 * (Math.sin(2 * Math.PI * f * 0.9985 * t + ph[0]) + Math.sin(2 * Math.PI * f * 1.0015 * t + ph[1]) + c[2] * Math.sin(2 * Math.PI * f * 2.002 * t + ph[2]));
      const p = (j % 2 ? 0.4 : -0.4);
      l += s * (1 - p) * 0.5; r += s * (1 + p) * 0.5;
    });
  });
  put(i, l * level * 0.55, r * level * 0.55, 0.3);
}

// ---- the pulse: a soft muted pluck on eighths at 100 BPM, from the reveal to the noise, following the chords
const EIGHTH = 60 / 100 / 2;
function pluck(t0, f, amp, pan, decay = 9) {
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR);
  for (let n = 0; n < SR * 0.6; n++) {
    const tt = n / SR, env = Math.exp(-tt * decay) * sm(tt / 0.003);
    const s = amp * env * (Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(2 * Math.PI * f * 2 * tt) * Math.exp(-tt * 20));
    put(i0 + n, s * pl, s * pr, 0.35);
  }
}
const PATTERN = [0, 2, 1, 2, 0, 3, 1, 2];
for (let k = 0, t = 5.0; t < T.pings[0] - 0.1; k++, t = 5.0 + k * EIGHTH) {
  if (t > T.click - 0.4 && t < T.click + 0.2) continue; // leave room for the reassembly
  const chord = CHORDS.filter((c) => c[0] <= t).pop()[1], tones = chord.slice(-4);
  const ramp = sm((t - 5.0) / 2) * (t > T.turn[0] && t < T.turn[1] ? 0.5 : 1);
  pluck(t, hz(tones[PATTERN[k % 8] % tones.length] + 12), (k % 2 ? 0.035 : 0.05) * ramp, k % 2 ? 0.3 : -0.3);
}

// ---- noise-band whooshes (a resonant band-pass whose centre sweeps)
function whoosh(t0, t1, f0, f1, amp, pan = 0) {
  let low = 0, band = 0;
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR), i1 = Math.round(t1 * SR);
  for (let i = i0; i < i1; i++) {
    const u = (i - i0) / (i1 - i0), f = f0 * Math.pow(f1 / f0, u), F = 2 * Math.sin(Math.PI * Math.min(f, 9000) / SR);
    const x = rnd() * 2 - 1; low += F * band; const high = x - low - 0.6 * band; band += F * high;
    const env = sm(u / 0.4) * (1 - sm((u - 0.65) / 0.35));
    put(i, band * amp * env * pl, band * amp * env * pr, 0.3);
  }
}
whoosh(T.lightOn[0] - 0.1, T.lightOn[1] + 0.2, 300, 2400, 0.09, -0.3); // the light sweep
whoosh(T.macro[0] - 0.1, T.macro[0] + 1.3, 600, 180, 0.08, 0.2); // the push into the edge
whoosh(T.explode[0], T.explode[1] + 0.2, 220, 1600, 0.06, 0); // the layers lift
whoosh(T.wave - 0.75, T.wave + 0.02, 150, 4200, 0.08, 0); // the inhale before the wave
whoosh(T.wave, T.wave + 2.0, 3000, 200, 0.07, 0); // the wave passing out

// ---- object sounds
function thud(t0, amp, f0 = 70, f1 = 40, len = 1.4) {
  const i0 = Math.round(t0 * SR); let ph = 0, low = 0;
  for (let n = 0; n < SR * len; n++) {
    const tt = n / SR, f = f1 + (f0 - f1) * Math.exp(-tt * 8); ph += 2 * Math.PI * f / SR;
    low += 0.05 * ((rnd() * 2 - 1) - low);
    const s = amp * (Math.sin(ph) * Math.exp(-tt * 3) + low * 2 * Math.exp(-tt * 18));
    put(i0 + n, s, s, 0.3);
  }
}
// a machined click: a short filtered transient and a high metallic ring
function click(t0, amp, f = 3100, pan = 0, body = 0.6) {
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR);
  let low = 0;
  for (let n = 0; n < SR * 0.12; n++) {
    const tt = n / SR, x = rnd() * 2 - 1; low += 0.35 * (x - low);
    const s = amp * ((x - low) * Math.exp(-n / 60) * 0.9 + Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 70) * 0.5 + body * Math.sin(2 * Math.PI * 180 * tt) * Math.exp(-tt * 60));
    put(i0 + n, s * pl, s * pr, 0.15);
  }
}
// a wooden tick: lower, rounder
function tick(t0, amp, pan) {
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR);
  for (let n = 0; n < SR * 0.08; n++) { const tt = n / SR, s = amp * (Math.sin(2 * Math.PI * 1250 * tt) * Math.exp(-tt * 90) + Math.sin(2 * Math.PI * 520 * tt) * Math.exp(-tt * 55) * 0.6); put(i0 + n, s * pl, s * pr, 0.4); }
}
function bell(t0, f, amp, pan = 0, len = 3.5) {
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR), parts = [[1, 1, 1.4], [2.0, 0.42, 2.0], [2.76, 0.3, 2.8], [5.4, 0.1, 4.6]];
  for (let n = 0; n < SR * len; n++) {
    const tt = n / SR; let s = 0;
    parts.forEach(([m, a, d]) => { s += a * Math.sin(2 * Math.PI * f * m * tt) * Math.exp(-tt * d); });
    s *= amp * sm(tt / 0.004);
    put(i0 + n, s * pl, s * pr, 0.55);
  }
}
// a notification ping: two quick sine notes, bright and slightly off from the music
function ping(t0, f, amp, pan) {
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR);
  for (let n = 0; n < SR * 0.45; n++) {
    const tt = n / SR, second = tt > 0.085 ? 1 : 0, ff = second ? f * 1.335 : f, ts = second ? tt - 0.085 : tt;
    const s = amp * Math.sin(2 * Math.PI * ff * ts) * Math.exp(-ts * (second ? 9 : 30)) * sm(ts / 0.002);
    put(i0 + n, s * pl, s * pr, 0.25);
  }
}

hookTicks().forEach((t, k) => tick(t, 0.11 + 0.05 * (k / 11), k % 2 ? 0.3 : -0.3)); // a tick every five minutes drawn
bell(T.ringFull, hz(88), 0.08, 0.2); // the ring closes: glass
thud(T.ringFull + 0.08, 0.38, 64, 38, 2.0); // and the bloom underneath it
T.callouts.forEach((t, k) => bell(t, hz(96 - k * 2), 0.018, -0.4, 0.8));
click(T.click, 0.55, 2600, 0, 1.0); thud(T.click, 0.22, 90, 55, 0.6); // the layers seat: a machined clack
detentTimes().forEach((t, k) => click(t, 0.3 + 0.08 * Math.sin(k), 3300 + (k % 3) * 120, 0.15 * Math.sin(k * 1.7), 0.35));
bell(T.turn[1] + 0.06, hz(84), 0.05, 0.1, 2.4); // set
const PING_NOTES = [83, 88, 80, 86, 91, 82, 89, 85];
T.pings.forEach((t, k) => ping(t, hz(PING_NOTES[k]), 0.09 + 0.012 * k, ((k * 0.61) % 1.6) - 0.8));
thud(T.wave, 0.6, 58, 32, 2.6); // the wave
bell(T.wave + 0.02, hz(76), 0.05, 0, 4.5);
bell(T.title, hz(76), 0.085, -0.15, 4); // the name
bell(T.tag, hz(83), 0.05, 0.2, 3.5);

// ---- a small Schroeder reverb on the send bus
function reverb(inp, delays) {
  const out = new Float32Array(N);
  delays.forEach((d) => { const buf = new Float32Array(d); let k = 0; for (let i = 0; i < N; i++) { const y = buf[k]; buf[k] = inp[i] + y * 0.84; out[i] += y; k = (k + 1) % d; } });
  [347, 113].forEach((d) => { const buf = new Float32Array(d); let k = 0; for (let i = 0; i < N; i++) { const y = buf[k], x = out[i]; buf[k] = x + y * 0.6; out[i] = y - 0.6 * x; k = (k + 1) % d; } });
  return out;
}
const revL = reverb(sendL, [1557, 1617, 1491, 1422]), revR = reverb(sendR, [1277, 1356, 1188, 1116]);

// ---- master: reverb in, a fade that ends exactly at T.DUR, soft clip, normalize to -1 dBFS
const mixL = new Float32Array(N), mixR = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = t < 27.8 ? 1 : Math.pow(1 - clamp01((t - 27.8) / (T.DUR - 27.8)), 1.8);
  mixL[i] = Math.tanh((L[i] + revL[i] * 0.15) * 1.1) * fade;
  mixR[i] = Math.tanh((R[i] + revR[i] * 0.15) * 1.1) * fade;
  peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i]));
}
const gain = Math.pow(10, -1 / 20) / peak, out = Buffer.alloc(44 + N * 4);
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 4, 4); out.write("WAVE", 8); out.write("fmt ", 12);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write("data", 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixL[i] * gain)) * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixR[i] * gain)) * 32767), 46 + i * 4);
}
const file = process.argv[2] || new URL("./out/still-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
fs.writeFileSync(file, out);
console.log(`wrote ${file} (${(N / SR).toFixed(3)} s, peak normalized to -1 dBFS)`);
