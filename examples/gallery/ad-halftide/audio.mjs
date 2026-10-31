// The HALFTIDE score on the app-film kit's synthesizer (original, nothing licensed).   node audio.mjs [out.wav]
// A drip and a bloom swell; a flowing harp-like arpeggio (D major, 96 BPM) that never stops, only swells; nib
// scratches as the line writes; liquid swirls; a pour that rises in pitch as the bottle fills; a final chord.
import fs from "node:fs";
import { createScore, hz, sm } from "../_lib/app-film/audio.mjs";
import { T } from "./timeline.mjs";

const s = createScore(T.DUR, { seed: 29 });
// the drip: a quick falling "plip", then a low bloom swell under the spreading ink
s.voice(T.hit, 0.35, 0, 0.5, (tt) => 0.4 * Math.sin(2 * Math.PI * (900 * Math.exp(-tt * 18) + 300) * tt) * Math.exp(-tt * 14));
s.voice(T.hit, 3.2, 0, 0.4, (tt) => 0.06 * sm(tt / 0.8) * (1 - sm((tt - 2.2) / 1.0)) * Math.sin(2 * Math.PI * 73.4 * tt));
// the flowing arpeggio: sixteenth-note waves over D – Bm – G – A, swelling with the story; it never stops
const PROG = [[62, 66, 69, 74], [59, 62, 66, 71], [55, 59, 62, 67], [57, 61, 64, 69]], SIX = 60 / 96 / 4;
for (let k = 0, t = 2.0; t < T.DUR - 1.2; k++, t = 2.0 + k * SIX) {
  const bar = Math.floor(k / 16) % 4, ch = PROG[bar], idx = [0, 1, 2, 3, 2, 1][k % 6];
  const lvl = 0.012 + 0.02 * sm((t - 9) / 6) + 0.012 * sm((t - 15) / 4) - 0.01 * sm((t - T.title) / 2);
  s.ep(t, hz(ch[idx] + 12), lvl, Math.sin(k * 0.5) * 0.6, 0.9);
  if (k % 16 === 0) ch.forEach((m, j) => s.ep(t + j * 0.015, hz(m - 12), 0.025, j % 2 ? 0.3 : -0.3, 16 * SIX + 0.6));
}
// a soft glass touch as the bottle settles; nib scratches along the written line
s.bell(T.rise[1], 86, 0.04, 0.2, 2);
for (let k = 0; k < 18; k++) { const t = T.write[0] + k * (T.write[1] - T.write[0]) / 18; s.whoosh(t, t + 0.16, 3500, 5200, 0.012, -0.3 + 0.03 * k); }
// liquid swirls as the ribbons flow; the pour, rising as the bottle fills; the chord on full
[0, 1, 2].forEach((k) => s.whoosh(T.ribbons[0] + 0.4 + k * 1.8, T.ribbons[0] + 2.4 + k * 1.8, 300, 1100, 0.03, -0.5 + 0.5 * k));
s.whoosh(T.pour[0], T.fill[1], 200, 1800, 0.05);
s.voice(T.fill[0], T.fill[1] - T.fill[0], 0, 0.4, (tt) => { const d = T.fill[1] - T.fill[0]; return 0.03 * sm(tt / 0.3) * (1 - sm((tt - d + 0.3) / 0.3)) * Math.sin(2 * Math.PI * (180 + 260 * tt / d) * tt) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 23 * tt)); });
[50, 57, 62, 66, 69, 74].forEach((m, j) => s.ep(T.fill[1] + j * 0.03, hz(m), m < 52 ? 0.07 : 0.045, j % 2 ? 0.4 : -0.4, T.DUR - T.fill[1]));
s.bell(T.title, 81, 0.05, 0, 3.5);

const file = process.argv[2] || new URL("./out/halftide-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: 28.2 }).file}`);
