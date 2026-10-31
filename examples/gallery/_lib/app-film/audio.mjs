// app-film kit · audio: a small synthesizer for original scores (no samples, nothing licensed). A film's audio.mjs
// creates a score, places music and sounds from its own timeline, and writes the WAV:
//
//   const s = createScore(T.DUR);
//   s.ep(t, hz(62), 0.05, -0.3);   s.uiFromActions(ACTIONS, keyTimes(ACTIONS));   s.write(file, { fadeFrom: 27.6 });
//
// Everything is deterministic (a seeded generator), so a re-render produces the same sound.
import fs from "node:fs";

export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const panLR = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

export function createScore(dur, opts = {}) {
  const SR = opts.sr || 48000, N = Math.round(dur * SR);
  const L = new Float32Array(N), R = new Float32Array(N), sendL = new Float32Array(N), sendR = new Float32Array(N);
  let seed = opts.seed || 23;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function put(i, l, r, send = 0) { if (i < 0 || i >= N) return; L[i] += l; R[i] += r; sendL[i] += l * send; sendR[i] += r * send; }
  /** a voice: fn(tt) → sample, over len seconds from t0, panned, with a reverb send */
  function voice(t0, len, pan, send, fn) {
    const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR);
    for (let n = 0; n < SR * len; n++) { const s = fn(n / SR, n); put(i0 + n, s * pl, s * pr, send); }
  }

  const api = {
    SR, rnd, put, voice,
    /** electric piano: a sine with a quickly decaying 2nd/3rd partial "tine" */
    ep(t0, f, amp, pan = 0, len = 2.4) {
      voice(t0, len, pan, 0.35, (tt) => amp * Math.exp(-tt * 1.6) * sm(tt / 0.006) * (1 - sm((tt - len + 0.4) / 0.4)) *
        (Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(2 * Math.PI * f * 2 * tt) * Math.exp(-tt * 6) + 0.12 * Math.sin(2 * Math.PI * f * 3.01 * tt) * Math.exp(-tt * 12)));
    },
    /** a soft, rounded UI click */
    click(t0, amp = 0.22, pan = 0) {
      voice(t0, 0.06, pan, 0.1, (tt) => amp * (Math.sin(2 * Math.PI * 1900 * tt) * Math.exp(-tt * 140) * 0.6 + Math.sin(2 * Math.PI * 620 * tt) * Math.exp(-tt * 80)));
    },
    /** a typing tick: a filtered noise burst */
    key(t0, amp = 0.07, pan = 0) {
      let lo = 0;
      voice(t0, 0.025, pan, 0.05, (tt) => { const x = rnd() * 2 - 1; lo += 0.5 * (x - lo); return amp * (x - lo) * Math.exp(-tt / 0.004); });
    },
    /** a quick rising run of glassy partials (an AI or "generate" cue) */
    shimmer(t0, amp = 0.035, notes = [74, 78, 81, 85, 88, 93]) {
      notes.forEach((m, k) => voice(t0 + k * 0.045, 0.9, -0.5 + k * 0.2, 0.6, (tt) => amp * Math.sin(2 * Math.PI * hz(m) * tt) * Math.exp(-tt * 5) * sm(tt / 0.003)));
    },
    /** noise through a resonant band-pass whose centre sweeps from f0 to f1 */
    whoosh(t0, t1, f0, f1, amp, pan = 0) {
      let low = 0, band = 0; const [pl, pr] = panLR(pan), i0 = Math.round(t0 * SR), i1 = Math.round(t1 * SR);
      for (let i = i0; i < i1; i++) {
        const u = (i - i0) / (i1 - i0), f = f0 * Math.pow(f1 / f0, u), F = 2 * Math.sin(Math.PI * Math.min(f, 9000) / SR);
        const x = rnd() * 2 - 1; low += F * band; const high = x - low - 0.6 * band; band += F * high;
        const env = sm(u / 0.4) * (1 - sm((u - 0.6) / 0.4));
        put(i, band * amp * env * pl, band * amp * env * pr, 0.3);
      }
    },
    bell(t0, m, amp, pan = 0, len = 2.5) {
      const f = hz(m);
      voice(t0, len, pan, 0.5, (tt) => amp * sm(tt / 0.003) * (Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 2) + 0.4 * Math.sin(2 * Math.PI * f * 2.76 * tt) * Math.exp(-tt * 4)));
    },
    /** a soft kick: a falling sine */
    kick(t0, amp = 0.16) {
      let ph = 0;
      voice(t0, 0.35, 0, 0.05, (tt) => { const f = 45 + 70 * Math.exp(-tt * 30); ph += 2 * Math.PI * f / SR; return amp * Math.sin(ph) * Math.exp(-tt * 9); });
    },
    /** a click on every click action and a tick on every key press, panned a little for space */
    uiFromActions(actions, keys, amp = 0.22) {
      actions.forEach((a, i) => { if (a.kind === "click") api.click(a.t, amp, ((i * 0.41) % 1) - 0.5); });
      keys.forEach((t, k) => api.key(t, 0.06 + 0.02 * ((k * 7) % 3) / 2, ((k * 0.29) % 0.6) - 0.3));
    },
    /** reverb, a fade that ends exactly at dur, soft clip, normalize to -1 dBFS, 16-bit stereo WAV */
    write(file, o = {}) {
      const revL = reverb(sendL, [1557, 1617, 1491, 1422]), revR = reverb(sendR, [1277, 1356, 1188, 1116]);
      const fadeFrom = o.fadeFrom != null ? o.fadeFrom : dur - 2.4, wet = o.wet != null ? o.wet : 0.14, drive = o.drive || 1.2;
      const mixL = new Float32Array(N), mixR = new Float32Array(N);
      let peak = 0;
      for (let i = 0; i < N; i++) {
        const t = i / SR, fade = (t < 0.04 ? t / 0.04 : 1) * (t < fadeFrom ? 1 : Math.pow(1 - clamp01((t - fadeFrom) / (dur - fadeFrom)), 1.8));
        mixL[i] = Math.tanh((L[i] + revL[i] * wet) * drive) * fade; mixR[i] = Math.tanh((R[i] + revR[i] * wet) * drive) * fade;
        peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i]));
      }
      if (peak === 0) throw new Error("the score is silent: nothing was placed");
      const gain = Math.pow(10, -1 / 20) / peak, out = Buffer.alloc(44 + N * 4);
      out.write("RIFF", 0); out.writeUInt32LE(36 + N * 4, 4); out.write("WAVE", 8); out.write("fmt ", 12);
      out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
      out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write("data", 36); out.writeUInt32LE(N * 4, 40);
      for (let i = 0; i < N; i++) {
        out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixL[i] * gain)) * 32767), 44 + i * 4);
        out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixR[i] * gain)) * 32767), 46 + i * 4);
      }
      fs.writeFileSync(file, out);
      return { file, seconds: N / SR };
    },
  };
  function reverb(inp, delays) { // a small Schroeder reverb: four combs, two all-passes
    const out = new Float32Array(N);
    delays.forEach((d) => { const buf = new Float32Array(d); let k = 0; for (let i = 0; i < N; i++) { const y = buf[k]; buf[k] = inp[i] + y * 0.82; out[i] += y; k = (k + 1) % d; } });
    [347, 113].forEach((d) => { const buf = new Float32Array(d); let k = 0; for (let i = 0; i < N; i++) { const y = buf[k], x = out[i]; buf[k] = x + y * 0.6; out[i] = y - 0.6 * x; k = (k + 1) % d; } });
    return out;
  }
  return api;
}
