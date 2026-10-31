// The TILDE score on the app-film kit's synthesizer (original, nothing licensed).   node audio.mjs [out.wav]
// An underwater hush and a rising tone for the bubble; a bright pop starts a light, plucky groove at 112 BPM; a paper
// peel for the label; a tick per fact; citrus plinks; a fizz swell into the climax; a clean final chord.
import fs from "node:fs";
import { createScore, hz, sm } from "../_lib/app-film/audio.mjs";
import { T } from "./timeline.mjs";

const s = createScore(T.DUR, { seed: 7 });
const BEAT = 60 / T.BPM;
// the hush and the rise: filtered noise and a slowly rising sine under the bubble
s.whoosh(0, T.pop, 180, 420, 0.05);
s.voice(0, T.pop, 0, 0.4, (tt) => 0.05 * sm(tt / 1) * Math.sin(2 * Math.PI * (110 + 60 * tt / T.pop) * tt));
// the pop: a bright click with a quick pitch drop, and a sparkle
s.voice(T.pop, 0.25, 0, 0.5, (tt) => 0.5 * Math.sin(2 * Math.PI * (1400 - 1000 * Math.min(1, tt / 0.04)) * tt) * Math.exp(-tt * 30));
s.shimmer(T.pop + 0.02, 0.03, [84, 88, 91, 96]);
// the groove: E major pluck pattern on eighths with a soft kick on beats, from the pop to the lockup
const PROG = [[52, 56, 59, 64], [49, 56, 59, 61], [45, 52, 57, 61], [47, 54, 59, 63]];
const PAT = [0, 2, 1, 3, 2, 1, 3, 2];
for (let k = 0, t = T.pop; t < T.title + 0.4; k++, t = T.pop + k * BEAT / 2) {
  const ch = PROG[Math.floor(k / 8) % 4], lift = sm((t - 15) / 4) - 0.6 * sm((t - T.facts[0]) / 0.6) * (1 - sm((t - T.wrap[0]) / 0.6));
  s.ep(t, hz(ch[PAT[k % 8]] + 12), 0.03 + 0.02 * lift, ((k * 0.37) % 1.2) - 0.6, 0.6);
  if (k % 2 === 0) s.kick(t, 0.12 + 0.05 * lift);
  if (k % 8 === 0) ch.forEach((m, j) => s.ep(t + j * 0.01, hz(m), 0.03, j % 2 ? 0.3 : -0.3, 4 * BEAT + 0.4));
}
// the label: a paper peel as it unwraps, a zip as it wraps back; a tick per fact
s.whoosh(T.peel[0], T.peel[1], 4000, 1200, 0.05, -0.3);
s.whoosh(T.wrap[0], T.wrap[1], 1200, 4500, 0.05, 0.3);
[0, 1, 2, 3].forEach((k) => s.click(T.facts[0] + 0.45 + 0.35 * k, 0.16, 0.4));
// citrus plinks as the slices drop in
[0, 1, 2, 3, 4, 5].forEach((k) => s.bell(T.citrus[0] + 0.18 * k + 0.5, [88, 91, 95, 93, 96, 100][k], 0.03, (k % 2) - 0.5, 1.2));
// the climax: fizz swell, then a chord hit on the wave; the final chord on the lockup
s.whoosh(T.burst[0] - 0.8, T.burst[0] + 0.6, 400, 7000, 0.07);
[52, 59, 64, 68, 71, 76].forEach((m, j) => s.ep(T.wave[0] + j * 0.03, hz(m), 0.05, j % 2 ? 0.4 : -0.4, 3.5));
[40, 52, 59, 64, 68, 71].forEach((m, j) => s.ep(T.title + j * 0.03, hz(m), m < 45 ? 0.07 : 0.045, j % 2 ? 0.4 : -0.4, T.DUR - T.title));
s.bell(T.title + 0.05, 76, 0.06, 0, 3.5);

const file = process.argv[2] || new URL("./out/tilde-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: 28.2 }).file}`);
