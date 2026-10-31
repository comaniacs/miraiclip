// The score for "The cloud is underwater" on the app-film kit's synthesizer (original, nothing licensed).
//   node audio.mjs [out.wav]
// 120 BPM, bouncy: a plucky ukulele-ish line in the sky, a NOPE buzzer, a splash and a muffled underwater groove,
// sonar pings on the seabed, a twinkle per wrap round the Earth, a shark "dun-dun", a clang for the anchor, a happy end.
import fs from "node:fs";
import { createScore, hz } from "../_lib/app-film/audio.mjs";
import { T } from "./timeline.mjs";

const s = createScore(T.DUR, { seed: 9 });
const B = 0.5;
const pluck = (t, m, a = 0.05, pan = 0) => s.voice(t, 0.5, pan, 0.25, (tt) => a * Math.exp(-tt * 9) * (Math.sin(2 * Math.PI * hz(m) * tt) + 0.4 * Math.sin(4 * Math.PI * hz(m) * tt)));
// the sky: a bouncy pluck melody in C, light kicks
const SKY = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84];
for (let k = 0, t = 0; t < T.mask; k++, t = k * B) { pluck(t, SKY[k % 12], 0.045, k % 2 ? 0.3 : -0.3); if (k % 2 === 0) s.kick(t, 0.09); s.key(t + B / 2, 0.025, 0.3); }
s.ep(0, hz(48), 0.05, 0, 3);
// the questions and the NOPE: a boing on the big question, a buzzer on the stamp
s.voice(T.q2[0], 0.5, 0, 0.2, (tt) => 0.08 * Math.sin(2 * Math.PI * (300 + 500 * tt * Math.exp(-tt * 3)) * tt) * Math.exp(-tt * 5));
s.whoosh(T.sat[0], T.sat[1], 800, 3000, 0.03, -0.5);
s.voice(T.nope, 0.45, 0, 0.1, (tt) => 0.09 * Math.sign(Math.sin(2 * Math.PI * 110 * tt)) * Math.exp(-tt * 3));
// the dive: a slide whistle down, a splash, then a muffled groove underwater
s.voice(T.jump, 0.7, 0, 0.3, (tt) => 0.05 * Math.sin(2 * Math.PI * (900 - 700 * tt) * tt));
s.whoosh(T.splash, T.splash + 0.6, 4000, 600, 0.12);
for (let k = 0; k < 10; k++) s.ep(T.splash + 0.1 + k * 0.07, hz(84 + (k % 4) * 3), 0.012, (k % 3) - 1, 0.2); // bubbles
const BASS = [45, 45, 48, 43];
for (let k = 0, t = 8.0; t < T.rest[1] - 0.6; k++, t = 8.0 + k * B) {
  if (t >= T.globe[0] && t < T.globe[1]) continue;
  s.kick(t, k % 2 ? 0.07 : 0.1); s.ep(t, hz(BASS[Math.floor(k / 4) % 4]), 0.045, 0, 0.45);
  if (k % 4 === 2) pluck(t, [64, 67, 69, 67][Math.floor(k / 4) % 4], 0.02, 0.4);
}
// the seabed: sonar pings on the facts, a pop for the cross-section
[T.c1[0], T.c2[0]].forEach((t) => s.bell(t, 88, 0.035, 0.3, 1.6)); s.click(T.xs[0], 0.12, 0.3);
// the globe: a twinkle for every wrap, a chord as it opens
[60, 64, 67, 72].forEach((m, j) => s.ep(T.globe[0] + j * 0.03, hz(m), 0.03, j % 2 ? 0.4 : -0.4, 4.8));
for (let k = 0; k < 35; k++) s.ep(T.wraps[0] + k * (T.wraps[1] - T.wraps[0]) / 35, hz(76 + (k % 8) * 2), 0.014, ((k % 5) - 2) / 2, 0.25);
s.whoosh(T.globe[1] - 0.5, T.globe[1], 600, 3000, 0.05);
// the break: "dun-dun" for the shark, a ding for its halo, a clang for the anchor
s.ep(T.shark[0], hz(40), 0.09, 0, 0.5); s.ep(T.shark[0] + 0.45, hz(41), 0.09, 0, 0.6);
s.bell(T.b2 + 0.15, 93, 0.03, 0.3, 1.2);
s.whoosh(T.anchor, T.hit, 2000, 300, 0.05);
s.voice(T.hit, 1.2, 0, 0.4, (tt) => 0.09 * Math.exp(-tt * 4) * (Math.sin(2 * Math.PI * 523 * tt) + 0.7 * Math.sin(2 * Math.PI * 1307 * tt) + 0.4 * Math.sin(2 * Math.PI * 2093 * tt)));
s.kick(T.hit, 0.2);
// the end: a happy major chord and a pluck flourish
[60, 64, 67, 72, 76].forEach((m, j) => s.ep(T.o2 + j * 0.02, hz(m), 0.03, j % 2 ? 0.35 : -0.35, 3.0));
[72, 76, 79, 84].forEach((m, j) => pluck(T.o3 + j * 0.12, m, 0.05, -0.3 + j * 0.2));

const file = process.argv[2] || new URL("./out/undersea-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: 28.6 }).file}`);
