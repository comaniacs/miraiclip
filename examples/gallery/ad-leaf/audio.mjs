// The LEAF score on the app-film kit's synthesizer (original, nothing licensed).   node audio.mjs [out.wav]
// Paper flutters and a felt-piano note for the falling page; a whoosh that compresses into a soft thud; a gentle
// piano motif; a tick on the warm-light slider; a page-turn swish; a rising swell into the flash; a final chord.
import fs from "node:fs";
import { createScore, hz, sm } from "../_lib/app-film/audio.mjs";
import { T } from "./timeline.mjs";

const s = createScore(T.DUR, { seed: 19 });
// paper flutter: short bursts of soft noise, denser as the swirl builds
for (let k = 0; k < 26; k++) { const t = 0.2 + k * 0.24 + 0.08 * Math.sin(k * 2.1); if (t < T.stack[1]) s.whoosh(t, t + 0.18, 1600, 3200, 0.018 + 0.014 * sm((t - 3) / 3), Math.sin(k)); }
s.ep(0.6, hz(69), 0.06, 0, 3.5);
// the compression: a whoosh into a soft felt thud
s.whoosh(T.stack[0] - 0.4, T.stack[1], 300, 1400, 0.06);
s.voice(T.stack[1], 0.8, 0, 0.3, (tt) => 0.35 * Math.sin(2 * Math.PI * (70 + 30 * Math.exp(-tt * 20)) * tt) * Math.exp(-tt * 7));
// the motif: a gentle felt-piano figure in A major from the device to the lockup, with a warm pad underneath
const MOTIF = [69, 73, 76, 81, 80, 76, 73, 76], BEAT = 0.5;
for (let k = 0, t = T.stack[1]; t < T.title; k++, t = T.stack[1] + k * BEAT) s.ep(t, hz(MOTIF[k % 8] + (k % 16 >= 8 ? 2 : 0)), 0.035 + 0.02 * sm((t - 15) / 5), ((k * 0.37) % 1.2) - 0.6, 1.0);
const PAD = [[T.stack[1], [45, 57, 61, 64]], [T.macro[0], [42, 54, 57, 61]], [T.turn[0], [38, 50, 57, 62]], [T.dive[0], [40, 52, 56, 59, 64]], [T.title - 0.1, [45, 57, 61, 64, 69, 73]]];
PAD.forEach(([t0, notes], k) => notes.forEach((m, j) => s.ep(t0 + j * 0.02, hz(m), m < 47 ? 0.06 : 0.025, j % 2 ? 0.35 : -0.35, (k + 1 < PAD.length ? PAD[k + 1][0] : T.DUR) - t0 + 0.8)));
// the warm-light slider: a few soft ticks; the page turn: a swish
for (let k = 0; k < 6; k++) s.click(T.warm[0] + k * 0.3, 0.07, 0.3);
s.whoosh(T.turn[0], T.turn[0] + 0.7, 2200, 900, 0.05, -0.3);
// the dive: a rising swell to the flash, a bright chord on it, then the name
s.whoosh(T.dive[0], T.flash, 200, 5000, 0.06);
s.shimmer(T.flash, 0.03, [81, 85, 88, 93]);
s.bell(T.title, 81, 0.06, 0, 3.5);

const file = process.argv[2] || new URL("./out/leaf-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: 28.2 }).file}`);
