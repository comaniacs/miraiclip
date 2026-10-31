// The Foldwork score, on the app-film kit's synthesizer (original, nothing licensed).   node audio.mjs [out.wav]
// A held low tone and a pencil hiss for the first crease; a paper snap on every fold; a music-box motif that builds
// as the city rises; an airy shimmer for the birds; a full chord at the reveal; a book thud and one bell to close.
import fs from "node:fs";
import { createScore, hz, sm } from "../_lib/app-film/audio.mjs";
import { T, popTimes } from "./timeline.mjs";

const s = createScore(T.DUR, { seed: 41 });
const POP = popTimes();

// a paper snap: a short band of filtered noise and a soft low knock, quieter when far away
function snap(t0, amp, pan = 0) {
  let lo = 0, bp = 0;
  s.voice(t0, 0.18, pan, 0.25, (tt) => {
    const x = s.rnd() * 2 - 1; lo += 0.25 * (x - lo); bp += 0.5 * (lo - bp);
    return amp * ((lo - bp) * 3 * Math.exp(-tt * 45) + 0.6 * Math.sin(2 * Math.PI * 140 * tt) * Math.exp(-tt * 30));
  });
}
// the pad: E major colours, warming at dusk, opening up at the reveal
const CH = [[0, [40, 52, 59, 64]], [4.0, [40, 52, 56, 59, 63]], [9.0, [37, 49, 56, 59, 64]], [15.0, [45, 52, 57, 61, 64]], [21.6, [40, 52, 56, 59, 64, 68, 71]], [26.6, [40, 52, 59, 64, 68]]];
CH.forEach(([t0, notes], k) => {
  const t1 = k + 1 < CH.length ? CH[k + 1][0] : T.DUR, lvl = [0.5, 0.7, 0.75, 0.85, 1, 0.8][k];
  notes.forEach((m, j) => s.voice(t0, t1 - t0 + 1.2, j % 2 ? 0.35 : -0.35, 0.35, (tt) => {
    const env = sm(tt / 0.9) * (1 - sm((tt - (t1 - t0) - 0.2) / 1.0));
    return lvl * (m < 45 ? 0.05 : 0.022) * env * (Math.sin(2 * Math.PI * hz(m) * 0.999 * tt) + Math.sin(2 * Math.PI * hz(m) * 1.001 * tt));
  }));
});
// the music box: a rising figure on the folds' rhythm from the first fold to the reveal
const BOX = [76, 80, 83, 88, 87, 83, 80, 78];
for (let k = 0, t = T.first[0]; t < T.reveal[0]; k++, t = T.first[0] + k * 0.42) {
  const amp = 0.018 + 0.03 * sm((t - T.wave[0]) / 4) + 0.015 * sm((t - T.dusk[0]) / 3);
  s.bell(t, BOX[k % 8] + (t > T.dusk[0] ? 0 : -12) + 12, amp, ((k * 0.37) % 1.2) - 0.6, 1.2);
}
// the first crease: a pencil-like hiss under the line, then the first snap
s.whoosh(T.crease[0], T.crease[1], 3000, 6000, 0.03, -0.2);
POP.forEach((t, i) => snap(t + 0.04, i < 2 ? 0.45 : 0.22, ((i * 0.53) % 1.4) - 0.7));
// the annotation counter ticks while the tower opens
for (let k = 0; k < 9; k++) s.click(T.tower[0] + 0.25 + k * 0.2, 0.08, 0.3);
// dusk: a soft swell; the birds: airy flutter
s.whoosh(T.dusk[0] - 0.2, T.dusk[1], 200, 900, 0.05);
[0, 1, 2].forEach((k) => s.whoosh(T.birds[0] + 0.45 * k, T.birds[0] + 0.45 * k + 2.4, 1800, 4200, 0.025, -0.4 + 0.4 * k));
s.shimmer(T.birds[0] + 0.1, 0.022);
// the reveal: a full chord accent; then the city folds down (quick soft snaps) and the book shuts
[52, 59, 64, 68, 71, 76].forEach((m, j) => s.ep(T.mark[0] + 0.5 + j * 0.04, hz(m), 0.05, j % 2 ? 0.4 : -0.4, 3.5));
for (let k = 0; k < 8; k++) snap(T.fold[0] + 0.15 * k, 0.12, ((k * 0.7) % 1.4) - 0.7);
s.whoosh(T.close[0], T.close[1], 160, 700, 0.05);
s.voice(T.close[1], 1.2, 0, 0.3, (tt) => 0.5 * Math.sin(2 * Math.PI * (60 + 40 * Math.exp(-tt * 25)) * tt) * Math.exp(-tt * 6)); // the book's thud
s.bell(T.close[1] + 0.05, 76, 0.07, 0, 3.5);

const file = process.argv[2] || new URL("./out/foldwork-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: 28.6 }).file}`);
