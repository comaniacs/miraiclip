// The score and sound design for the Kiteline film, synthesized from scratch (no samples, nothing licensed). Every UI
// sound is placed from the same ACTIONS list that drives the app in the picture, so a click is heard on the frame
// the button is pressed.
//
//   node audio.mjs [out.wav]   writes a 48 kHz stereo 16-bit WAV, exactly T.DUR seconds
//
// Music: a warm electric-piano pad at 104 BPM in D major (Dmaj9 → Bm11 → Gmaj9 → A6sus), a soft pluck arpeggio from
// the calendar onward, a lift into the plan, and a final Dmaj9 that fades to nothing at 30 s.
import fs from "node:fs";
import { T, ACTIONS, keyTimes } from "./timeline.mjs";

const SR = 48000, N = Math.round(T.DUR * SR);
const L = new Float32Array(N), R = new Float32Array(N), sendL = new Float32Array(N), sendR = new Float32Array(N);
let seed = 23;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const panLR = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];
function put(i, l, r, send = 0) { if (i < 0 || i >= N) return; L[i] += l; R[i] += r; sendL[i] += l * send; sendR[i] += r * send; }

const BEAT = 60 / 104, BAR = 4 * BEAT;
// chords per bar (MIDI), looping; the last one is held from the hero onward
const PROG = [[50, 62, 66, 69, 73, 76], [47, 59, 62, 66, 69, 76], [43, 55, 59, 66, 69, 74], [45, 57, 62, 64, 66, 69]];
const FINAL = [38, 50, 57, 62, 66, 69, 73, 76];
function chordAt(t) { return t >= T.title - 0.1 ? FINAL : PROG[Math.floor(t / BAR) % PROG.length]; }

// ---- electric-piano notes: a sine with a quickly decaying 2nd/3rd partial "tine"
function ep(t0, f, amp, pan, len = 2.4) {
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR);
  for (let n = 0; n < SR * len; n++) {
    const tt = n / SR, env = Math.exp(-tt * 1.6) * sm(tt / 0.006) * (1 - sm((tt - len + 0.4) / 0.4));
    const s = amp * env * (Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(2 * Math.PI * f * 2 * tt) * Math.exp(-tt * 6) + 0.12 * Math.sin(2 * Math.PI * f * 3.01 * tt) * Math.exp(-tt * 12));
    put(i0 + n, s * pl, s * pr, 0.35);
  }
}
// ---- the pad: chord tones on every bar, softer in the hook, fuller from the calendar on, held at the end
function level(t) { return 0.45 + 0.35 * sm((t - 3.6) / 1.2) + 0.15 * sm((t - T.chipsUp[0]) / 1.5) - 0.1 * sm((t - T.settle[0]) / 1.5); }
for (let b = 0; b * BAR < T.title - 0.1; b++) {
  const t = b * BAR, ch = chordAt(t);
  ch.forEach((m, j) => ep(t + j * 0.012, hz(m), (m < 52 ? 0.07 : 0.035) * level(t), j % 2 ? 0.35 : -0.35, BAR + 0.6));
}
FINAL.forEach((m, j) => ep(T.title - 0.1 + j * 0.03, hz(m), (m < 52 ? 0.08 : 0.04), j % 2 ? 0.4 : -0.4, T.DUR - T.title + 0.2));

// ---- the arpeggio: eighth notes from the calendar until the hero, rising with the plan
const ARP = [0, 2, 3, 4, 3, 2, 4, 5];
for (let k = 0; ; k++) {
  const t = 4.35 + k * BEAT / 2;
  if (t > T.title - 0.2) break;
  const ch = chordAt(t), m = ch[1 + (ARP[k % 8] % (ch.length - 1))] + 12, amp = 0.028 + 0.02 * sm((t - T.chipsUp[0]) / 2);
  ep(t, hz(m), amp, ((k * 0.37) % 1.4) - 0.7, 0.7);
}
// a soft kick on beats 1 and 3 from the calendar, to give the flow a pulse (not a beat to dance to)
for (let k = 0; ; k++) {
  const t = 4.35 + k * 2 * BEAT; if (t > T.title - 0.2) break;
  const i0 = Math.round(t * SR); let ph = 0;
  for (let n = 0; n < SR * 0.35; n++) { const tt = n / SR, f = 45 + 70 * Math.exp(-tt * 30); ph += 2 * Math.PI * f / SR; const s = 0.16 * Math.sin(ph) * Math.exp(-tt * 9); put(i0 + n, s, s, 0.05); }
}

// ---- interface sounds
function click(t0, amp, pan = 0) { // a soft, rounded UI click: short body + a gentle high tick
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR);
  for (let n = 0; n < SR * 0.06; n++) { const tt = n / SR, s = amp * (Math.sin(2 * Math.PI * 1900 * tt) * Math.exp(-tt * 140) * 0.6 + Math.sin(2 * Math.PI * 620 * tt) * Math.exp(-tt * 80)); put(i0 + n, s * pl, s * pr, 0.1); }
}
function key(t0, amp, pan) { // a typing tick: filtered noise burst
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR); let lo = 0;
  for (let n = 0; n < SR * 0.025; n++) { const x = rnd() * 2 - 1; lo += 0.5 * (x - lo); const s = amp * (x - lo) * Math.exp(-n / (SR * 0.004)); put(i0 + n, s * pl, s * pr, 0.05); }
}
function shimmer(t0, amp) { // generate: a quick rising run of glassy partials
  [74, 78, 81, 85, 88, 93].forEach((m, k) => {
    const i0 = Math.round((t0 + k * 0.045) * SR), f = hz(m), [pl, pr] = panLR(-0.5 + k * 0.2);
    for (let n = 0; n < SR * 0.9; n++) { const tt = n / SR, s = amp * Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 5) * sm(tt / 0.003); put(i0 + n, s * pl, s * pr, 0.6); }
  });
}
function whoosh(t0, t1, f0, f1, amp, pan = 0) {
  let low = 0, band = 0; const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR), i1 = Math.round(t1 * SR);
  for (let i = i0; i < i1; i++) {
    const u = (i - i0) / (i1 - i0), f = f0 * Math.pow(f1 / f0, u), F = 2 * Math.sin(Math.PI * Math.min(f, 9000) / SR);
    const x = rnd() * 2 - 1; low += F * band; const high = x - low - 0.6 * band; band += F * high;
    put(i, band * amp * sm(u / 0.4) * (1 - sm((u - 0.6) / 0.4)) * pl, band * amp * sm(u / 0.4) * (1 - sm((u - 0.6) / 0.4)) * pr, 0.3);
  }
}
function bell(t0, m, amp, pan = 0, len = 2.5) {
  const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR), f = hz(m);
  for (let n = 0; n < SR * len; n++) { const tt = n / SR; const s = amp * sm(tt / 0.003) * (Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 2) + 0.4 * Math.sin(2 * Math.PI * f * 2.76 * tt) * Math.exp(-tt * 4)); put(i0 + n, s * pl, s * pr, 0.5); }
}

// the hook: a pluck as the line threads each real idea, a low swell as the tiles lock into the calendar
[0.95, 1.3, 1.65, 1.95, 2.25].forEach((t, k) => ep(t, hz([74, 76, 78, 81, 83][k]), 0.06, -0.4 + k * 0.2, 1.4));
whoosh(2.3, 3.6, 120, 900, 0.07, 0);
bell(3.55, 62, 0.06, 0, 3);
// every scripted click, and the keys while typing
ACTIONS.forEach((a, i) => { if (a.kind === "click") click(a.t, 0.22, ((i * 0.41) % 1) - 0.5); });
keyTimes().forEach((t, k) => key(t, 0.06 + 0.02 * ((k * 7) % 3) / 2, ((k * 0.29) % 0.6) - 0.3));
shimmer(11.88, 0.035); // generate
whoosh(T.lift[0], T.lift[1], 300, 1600, 0.05, -0.2); // the Thursday column lifts across
whoosh(T.promptFly[0], T.promptFly[1] + 0.05, 1800, 400, 0.05, 0.2); // the prompt drops into the editor
whoosh(T.previewFly[0], T.previewFly[1], 1500, 300, 0.06, 0);
bell(T.previewFly[1] - 0.1, 81, 0.05, 0.2, 1.6); bell(T.previewFly[1] + 0.05, 86, 0.04, 0.3, 2); // scheduled: a two-note confirm
whoosh(T.chipsUp[0] - 0.3, T.chipsUp[1] + 0.3, 200, 2400, 0.06, 0); // the plan lifts
bell(T.planLine[1] - 0.05, 78, 0.04, -0.2, 2.2);
bell(T.title, 74, 0.07, 0, 3.5); bell(T.title + 0.06, 81, 0.04, 0.25, 3.5); // the name

// ---- reverb, master fade ending exactly at T.DUR, soft clip, normalize to -1 dBFS
function reverb(inp, delays) {
  const out = new Float32Array(N);
  delays.forEach((d) => { const buf = new Float32Array(d); let k = 0; for (let i = 0; i < N; i++) { const y = buf[k]; buf[k] = inp[i] + y * 0.82; out[i] += y; k = (k + 1) % d; } });
  [347, 113].forEach((d) => { const buf = new Float32Array(d); let k = 0; for (let i = 0; i < N; i++) { const y = buf[k], x = out[i]; buf[k] = x + y * 0.6; out[i] = y - 0.6 * x; k = (k + 1) % d; } });
  return out;
}
const revL = reverb(sendL, [1557, 1617, 1491, 1422]), revR = reverb(sendR, [1277, 1356, 1188, 1116]);
const mixL = new Float32Array(N), mixR = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = (t < 0.04 ? t / 0.04 : 1) * (t < 27.6 ? 1 : Math.pow(1 - clamp01((t - 27.6) / (T.DUR - 27.6)), 1.8));
  mixL[i] = Math.tanh((L[i] + revL[i] * 0.14) * 1.2) * fade; mixR[i] = Math.tanh((R[i] + revR[i] * 0.14) * 1.2) * fade;
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
const file = process.argv[2] || new URL("./out/kiteline-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
fs.writeFileSync(file, out);
console.log(`wrote ${file} (${(N / SR).toFixed(3)} s, peak normalized to -1 dBFS)`);
