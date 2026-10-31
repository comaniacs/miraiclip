// The __TITLE__ score on the kit's synthesizer (original, nothing licensed).   node audio.mjs [out.wav]
// A pad that follows four chords, a pluck on each beat after the hook, every UI click and key, bells on the name.
import fs from "node:fs";
import { createScore, hz } from "../_lib/app-film/audio.mjs";
import { T, ACTIONS, KEYS } from "./timeline.mjs";

const s = createScore(T.DUR);
const BAR = 4 * 60 / 100, PROG = [[50, 62, 66, 69, 73], [47, 59, 62, 66, 69], [43, 55, 59, 66, 71], [45, 57, 61, 64, 69]];
for (let b = 0; b * BAR < T.DUR; b++) PROG[b % 4].forEach((m, j) => s.ep(b * BAR + j * 0.012, hz(m), m < 52 ? 0.07 : 0.035, j % 2 ? 0.35 : -0.35, BAR + 0.6));
for (let k = 0, t = 2.4; t < T.title; k++, t = 2.4 + k * 0.6) s.ep(t, hz(PROG[Math.floor(t / BAR) % 4][2 + (k % 3)] + 12), 0.03, (k % 2) - 0.5, 0.7);
s.uiFromActions(ACTIONS, KEYS);
s.bell(T.title, 74, 0.07, 0, 3.5); s.bell(T.tag, 81, 0.04, 0.25, 3);

const file = process.argv[2] || new URL("./out/__ID__-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: T.DUR - 2 }).file}`);
