// The DEWLIT bed: light lo-fi music and product sounds, on the app-film kit's synthesizer (original, nothing licensed).
// There is no voice yet: the presenter's audio comes with the real footage (or avatar). The music is mixed low, like
// a creator's background track, so the voice will sit on top.   node audio.mjs [out.wav]
import fs from "node:fs";
import { createScore, hz, sm } from "../_lib/app-film/audio.mjs";
import { T, INSERTS } from "./timeline.mjs";

const s = createScore(T.DUR, { seed: 5 });
const BEAT = 60 / 92, PROG = [[57, 61, 64, 68], [54, 57, 61, 64], [50, 54, 57, 61], [52, 56, 59, 62]];
for (let b = 0; b * 4 * BEAT < T.DUR; b++) {
  const t0 = b * 4 * BEAT, ch = PROG[b % 4];
  ch.forEach((m, j) => s.ep(t0 + j * 0.02, hz(m), 0.022, j % 2 ? 0.3 : -0.3, 4 * BEAT + 0.4)); // a soft Rhodes bed
  for (let k = 0; k < 4; k++) { s.kick(t0 + k * BEAT, k % 2 ? 0.05 : 0.08); s.key(t0 + k * BEAT + BEAT / 2, 0.02, 0.2); } // brushed lo-fi beat
}
for (let k = 0, t = 0.5; t < T.DUR - 1; k++, t += BEAT / 2) if (k % 3 !== 2) s.ep(t, hz(PROG[Math.floor(t / (4 * BEAT)) % 4][k % 4] + 12), 0.012, ((k * 0.4) % 1.2) - 0.6, 0.5);
// product sounds: a glass tick on the reveal, the dropper unscrewing, the drop, the bottle set down, a light end cue
s.bell(INSERTS.bottle[0], 93, 0.03, 0.2, 1.0);
for (let k = 0; k < 5; k++) s.click(8.1 + k * 0.07, 0.05, -0.2);
s.voice(INSERTS.texture[0] + 0.7, 0.3, 0, 0.4, (tt) => 0.25 * Math.sin(2 * Math.PI * (700 * Math.exp(-tt * 20) + 260) * tt) * Math.exp(-tt * 16));
s.voice(INSERTS.vanity[0] + 0.15, 0.25, 0.2, 0.2, (tt) => 0.2 * Math.sin(2 * Math.PI * 180 * tt) * Math.exp(-tt * 30) + 0.06 * Math.sin(2 * Math.PI * 2400 * tt) * Math.exp(-tt * 50));
s.bell(INSERTS.end[0], 88, 0.035, 0, 2.5); s.bell(INSERTS.end[0] + 0.12, 93, 0.025, 0.2, 2.5);

const file = process.argv[2] || new URL("./out/dewlit-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: 28.4 }).file}`);
