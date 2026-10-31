// The score for "The flower doing math" on the app-film kit's synthesizer (original, nothing licensed).
//   node audio.mjs [out.wav]
// A celesta-like arpeggio that blooms with the seeds; a hollow, unresolved chord on every "wrong" angle and a soft
// thunk as it snaps; a warm resolution when the golden angle locks; a tick per counted spiral arm; a final chord.
import fs from "node:fs";
import { createScore, hz } from "../_lib/app-film/audio.mjs";
import { T } from "./timeline.mjs";

const s = createScore(T.DUR, { seed: 21 });
const cel = (t, m, a = 0.03, pan = 0) => s.voice(t, 1.2, pan, 0.45, (tt) => a * Math.exp(-tt * 4) * (Math.sin(2 * Math.PI * hz(m) * tt) + 0.3 * Math.sin(2 * Math.PI * hz(m) * 4 * tt) * Math.exp(-tt * 10)));
// the bloom: a rising sparkle as the seeds burst, then a gentle arpeggio in D under the hook and the rule
for (let k = 0; k < 24; k++) cel(k * 0.07, 74 + (k * 5) % 24, 0.018, ((k % 5) - 2) / 2.5);
const ARP = [62, 66, 69, 74, 69, 66];
for (let k = 0, t = 1.6; t < T.angles[1][0] - 0.8; k++, t = 1.6 + k * 0.32) cel(t, ARP[k % 6], 0.024, k % 2 ? 0.3 : -0.3);
[50, 57, 62].forEach((m, j) => s.ep(0.2 + j * 0.02, hz(m), 0.03, j - 1, 6));
for (let k = 1; k < 7; k++) s.click(T.seeds[0] + T.seeds[1] * k, 0.06, 0.2); // each numbered seed lands
// the wrong angles: a thunk on arrival and a hollow open-fifth chord that never resolves
[[1, [50, 57, 64]], [2, [49, 56, 63]], [3, [51, 58, 65]], [4, [50, 56, 61]]].forEach(([k, ch]) => {
  const t = T.angles[k][0];
  s.voice(t, 0.4, 0, 0.2, (tt) => 0.12 * Math.sin(2 * Math.PI * (90 * Math.exp(-tt * 10) + 50) * tt) * Math.exp(-tt * 9));
  ch.forEach((m, j) => s.ep(t + j * 0.02, hz(m), 0.028, j - 1, 1.6));
});
// the slow approach and the lock: a riser, then a warm resolution in D major
s.whoosh(T.angles[4][0] + 0.4, T.lock, 300, 3000, 0.04);
[38, 50, 57, 62, 66, 69, 74].forEach((m, j) => s.ep(T.lock + j * 0.025, hz(m), m < 45 ? 0.07 : 0.03, ((j % 3) - 1) / 2, 4.5));
s.shimmer(T.lock, 0.025, [81, 86, 90, 93]);
for (let k = 0, t = T.lock + 0.6; t < T.sp34[0]; k++, t = T.lock + 0.6 + k * 0.32) cel(t, [74, 78, 81, 86, 81, 78][k % 6], 0.02, k % 2 ? 0.3 : -0.3);
// counting the spirals: a tick per arm, in step with the arms lighting; a bell when each count lands
[[T.sp34, 34], [T.sp55, 55]].forEach(([sp, F]) => {
  for (let n = 1; n <= F; n++) { const t = sp[0] + 0.2 + 1.7 * (n / F); s.key(t, 0.035, ((n % 7) - 3) / 4); if (n % 3 === 0) cel(t, 74 + (n % 12), 0.008); }
  s.bell(sp[0] + 1.95, F === 34 ? 81 : 86, 0.05, 0, 2);
});
[38, 50, 57, 62].forEach((m, j) => s.ep(T.sp34[0], hz(m), m < 45 ? 0.05 : 0.02, 0, 5.6));
// the payoff: petals unfurl with a harp-like sweep, the final chord
for (let k = 0; k < 16; k++) cel(T.petals[0] + k * 0.06, 62 + [0, 4, 7, 12][k % 4] + 12 * Math.floor(k / 4), 0.02, ((k % 5) - 2) / 2.5);
[38, 50, 57, 62, 66, 69, 74, 78].forEach((m, j) => s.ep(T.p2 + j * 0.03, hz(m), m < 45 ? 0.07 : 0.03, ((j % 3) - 1) / 2, 3.6));

const file = process.argv[2] || new URL("./out/golden-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: 28.6 }).file}`);
