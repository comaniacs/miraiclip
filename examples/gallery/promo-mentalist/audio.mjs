// The score for the fan promo, on the app-film kit's synthesizer (original, nothing licensed).   node audio.mjs [out.wav]
// A clock tick and a spoon on porcelain; a low cello-like drone; a pizzicato motif that quickens with each deduction;
// a string "zip"; then near-silence and a deep hit as the pattern resolves; a dark final chord.
import fs from "node:fs";
import { createScore, hz, sm } from "../_lib/app-film/audio.mjs";
import { T } from "./timeline.mjs";

const s = createScore(T.DUR, { seed: 13 });
// the clock: a soft tick every second until the reveal
for (let t = 0.2; t < T.smile[0]; t += 1) s.click(t, 0.05, 0.4);
// the spoon on the cup
s.bell(1.0, 91, 0.05, -0.2, 1.8); s.bell(1.07, 98, 0.025, -0.2, 1.2);
// the drone: a low bowed tone with slow vibrato, swelling into the mind and through the deductions
s.voice(0, T.smile[0], 0, 0.3, (tt) => {
  const env = sm(tt / 2) * (1 - sm((tt - T.smile[0] + 0.6) / 0.6)), lift = 0.6 + 0.4 * sm((tt - 6) / 8);
  const f = hz(38) * (1 + 0.004 * Math.sin(2 * Math.PI * 5 * tt));
  return 0.07 * env * lift * (Math.sin(2 * Math.PI * f * tt) + 0.5 * Math.sin(2 * Math.PI * 2 * f * tt) + 0.25 * Math.sin(2 * Math.PI * 3 * f * tt));
});
// the dive: a deep whoosh through the tea
s.whoosh(T.dive[0], T.dive[1], 1400, 120, 0.06);
// pizzicato: D minor figure, quickening through the deductions and the string
const FIG = [62, 65, 69, 70, 69, 65, 64, 65];
let t = T.intro[0], k = 0;
while (t < T.align[1]) {
  s.ep(t, hz(FIG[k % 8]), 0.04, ((k * 0.37) % 1.2) - 0.6, 0.35);
  t += t < T.deds[0][0] ? 0.5 : t < T.string[0] ? 0.33 : 0.25; k++;
}
// each deduction lands on a soft high bell; the red string zips as it threads
T.deds.forEach(([a], i) => s.bell(a + 0.6, [86, 88, 91][i], 0.035, 0.3, 1.6));
s.whoosh(T.string[0], T.string[1] - 1.2, 900, 3600, 0.035, -0.2);
// the reveal: a held breath, then a deep hit and a dissonant swell resolving into the title
s.voice(T.smile[0], 2.5, 0, 0.4, (tt) => 0.55 * Math.sin(2 * Math.PI * (48 + 30 * Math.exp(-tt * 12)) * tt) * Math.exp(-tt * 2.2));
[50, 53, 57, 62, 63].forEach((m, j) => s.ep(T.smile[0] + 0.05 + j * 0.04, hz(m), 0.035, j % 2 ? 0.4 : -0.4, 3.2));
[38, 50, 57, 62, 65, 69].forEach((m, j) => s.ep(T.title + j * 0.05, hz(m), m < 45 ? 0.07 : 0.035, j % 2 ? 0.4 : -0.4, T.DUR - T.title));
s.bell(T.title + 0.1, 86, 0.04, 0, 3.5);

const file = process.argv[2] || new URL("./out/mentalist-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: 28.4 }).file}`);
