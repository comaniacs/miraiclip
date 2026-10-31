// The "One day" score on the app-film kit's synthesizer (original, nothing licensed).   node audio.mjs [out.wav]
// 96 BPM. Night: a phone ringing over a low pad; the answer; then a warm groove for the working day, a clock-tick
// time-lapse into every scene, small UI sounds on each module's moments, and a full chord on the lockup.
import fs from "node:fs";
import { createScore, hz } from "../_lib/app-film/audio.mjs";
import { T, BEAT, SCENES } from "./timeline.mjs";

const s = createScore(T.DUR, { seed: 5 });
// the hook: a two-tone ring on each bar, a night pad underneath
T.ring.forEach((r) => { for (let k = 0; k < 14; k++) s.ep(r + k * 0.05, hz(k % 2 ? 83 : 79), 0.022, 0.3, 0.12); });
[45, 52, 57, 60].forEach((m, j) => s.ep(0, hz(m), m < 50 ? 0.05 : 0.02, j % 2 ? 0.3 : -0.3, 5.2));
s.click(T.answer, 0.16, 0.3); s.shimmer(T.answer + 0.05, 0.02, [76, 81, 88]);
// the reveal: a riser, then the groove starts on the bar at 5 s
s.whoosh(T.answer, T.reveal[0], 300, 5000, 0.06);
const CH = [[45, [64, 67, 72]], [41, [65, 69, 72]], [48, [64, 67, 71]], [43, [62, 67, 71]]]; // Am → F → C → G, a bar each
for (let k = 0, t = T.reveal[0]; t < T.end[0] - 0.01; k++, t = T.reveal[0] + k * BEAT) {
  const [root, chord] = CH[Math.floor(k / 4) % 4];
  s.kick(t, k % 4 === 0 ? 0.16 : 0.12);
  s.key(t + BEAT / 2, 0.03, 0.35);
  if (k % 2) s.whoosh(t, t + 0.1, 2400, 3800, 0.035, -0.1);
  s.ep(t, hz(root), 0.055, 0, BEAT * 0.9);
  if (k % 4 === 0) chord.forEach((m, j) => s.ep(t + j * 0.015, hz(m), 0.02, j % 2 ? 0.4 : -0.4, BEAT * 3.6));
}
// the time-lapse into each scene and the recap: a whoosh with racing clock ticks
SCENES.map((x) => x[1]).concat([T.recap[0]]).forEach((S) => { s.whoosh(S - 0.3, S + 0.9, 500, 3000, 0.05); for (let k = 0; k < 14; k++) s.key(S + k * 0.06, 0.05, 0.2); });
const at = (i, u) => SCENES[i][1] + u;
// voice: a pop per line, a chime on the booking
[1.6, 2.6, 3.8, 4.4].forEach((u) => s.click(at(0, u), 0.08, 0.2)); s.shimmer(at(0, 5.4), 0.022, [72, 76, 79, 84]);
// conversations: the message, typing, the reply, a tick per "AI replied"
s.click(at(1, 1.5), 0.08); for (let k = 0; k < 16; k++) s.key(at(1, 3.0 + k * 0.08), 0.03, 0.3); [0, 1, 2, 3].forEach((k) => s.click(at(1, 4.4 + 0.28 * k), 0.06, 0.4));
// reviews: five star ticks, typing, the post
for (let k = 0; k < 5; k++) s.ep(at(2, 1.4 + 0.12 * k), hz(76 + k * 2), 0.03, 0.2, 0.4);
for (let k = 0; k < 20; k++) s.key(at(2, 2.8 + k * 0.09), 0.03, 0.3); s.click(at(2, 5.0), 0.14); s.shimmer(at(2, 5.1), 0.02, [76, 81, 88]);
// content and funnel: the prompts type, the results land
for (let k = 0; k < 14; k++) { s.key(at(3, 1.1 + k * 0.085), 0.03, -0.3); s.key(at(4, 1.1 + k * 0.08), 0.03, -0.3); }
s.whoosh(at(3, 2.9), at(3, 3.8), 1200, 4000, 0.04); s.click(at(3, 3.8), 0.08);
[0, 1, 2].forEach((k) => s.click(at(4, 2.4 + 0.45 * k), 0.09, -0.3 + 0.3 * k));
// workflow: typing, apply, a pop per node
for (let k = 0; k < 14; k++) s.key(at(5, 1.4 + k * 0.085), 0.03, -0.3); s.click(at(5, 3.3), 0.13);
for (let k = 0; k < 6; k++) s.click(at(5, 3.45 + 0.32 * k), 0.06, -0.4 + 0.16 * k);
// the recap cards, then the lockup
for (let k = 0; k < 6; k++) s.click(T.recap[0] + 1.8 + 0.15 * k, 0.05, -0.4 + 0.16 * k);
s.kick(T.end[0], 0.2);
[45, 57, 64, 69, 72, 76].forEach((m, j) => s.ep(T.end[0] + j * 0.02, hz(m), m < 50 ? 0.08 : 0.032, j % 2 ? 0.35 : -0.35, 4.5));
s.bell(T.title, 81, 0.06, 0, 3.2); s.click(T.url, 0.12); s.shimmer(T.url, 0.02, [76, 81, 88]);

const file = process.argv[2] || new URL("./out/oneday-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: 58.4 }).file}`);
