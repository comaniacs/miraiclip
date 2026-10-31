// The score and sound design for the Kiteline film, on the app-film kit's synthesizer (original, nothing licensed).
// Every UI sound is placed from the same ACTIONS that drive the app in the picture, so a click is heard on the frame
// the button is pressed.
//
//   node audio.mjs [out.wav]   writes a 48 kHz stereo 16-bit WAV, exactly T.DUR seconds
//
// Music: a warm electric-piano pad at 104 BPM in D major (Dmaj9 → Bm11 → Gmaj9 → A6sus), a soft pluck arpeggio from
// the calendar onward, a lift into the plan, and a final Dmaj9 that fades to nothing at 30 s.
import fs from "node:fs";
import { createScore, hz, sm } from "../_lib/app-film/audio.mjs";
import { T, ACTIONS, KEYS } from "./timeline.mjs";

const s = createScore(T.DUR);
const BEAT = 60 / 104, BAR = 4 * BEAT;
const PROG = [[50, 62, 66, 69, 73, 76], [47, 59, 62, 66, 69, 76], [43, 55, 59, 66, 69, 74], [45, 57, 62, 64, 66, 69]];
const FINAL = [38, 50, 57, 62, 66, 69, 73, 76];
const chordAt = (t) => (t >= T.title - 0.1 ? FINAL : PROG[Math.floor(t / BAR) % PROG.length]);

// the pad: chord tones on every bar, softer in the hook, fuller from the calendar on, held at the end
const level = (t) => 0.45 + 0.35 * sm((t - 3.6) / 1.2) + 0.15 * sm((t - T.chipsUp[0]) / 1.5) - 0.1 * sm((t - T.settle[0]) / 1.5);
for (let b = 0; b * BAR < T.title - 0.1; b++) {
  const t = b * BAR;
  chordAt(t).forEach((m, j) => s.ep(t + j * 0.012, hz(m), (m < 52 ? 0.07 : 0.035) * level(t), j % 2 ? 0.35 : -0.35, BAR + 0.6));
}
FINAL.forEach((m, j) => s.ep(T.title - 0.1 + j * 0.03, hz(m), m < 52 ? 0.08 : 0.04, j % 2 ? 0.4 : -0.4, T.DUR - T.title + 0.2));

// the arpeggio: eighth notes from the calendar until the hero, rising with the plan; a soft kick on beats 1 and 3
const ARP = [0, 2, 3, 4, 3, 2, 4, 5];
for (let k = 0, t = 4.35; t <= T.title - 0.2; k++, t = 4.35 + k * BEAT / 2) {
  const ch = chordAt(t);
  s.ep(t, hz(ch[1 + (ARP[k % 8] % (ch.length - 1))] + 12), 0.028 + 0.02 * sm((t - T.chipsUp[0]) / 2), ((k * 0.37) % 1.4) - 0.7, 0.7);
}
for (let t = 4.35; t <= T.title - 0.2; t += 2 * BEAT) s.kick(t);

// the hook: a pluck as the line threads each real idea, a low swell as the tiles lock into the calendar
[0.95, 1.3, 1.65, 1.95, 2.25].forEach((t, k) => s.ep(t, hz([74, 76, 78, 81, 83][k]), 0.06, -0.4 + k * 0.2, 1.4));
s.whoosh(2.3, 3.6, 120, 900, 0.07);
s.bell(3.55, 62, 0.06, 0, 3);
// the interface: every scripted click and key press, the generate shimmer, the moves between screens, the confirm
s.uiFromActions(ACTIONS, KEYS);
s.shimmer(11.88);
s.whoosh(T.lift[0], T.lift[1], 300, 1600, 0.05, -0.2);
s.whoosh(T.promptFly[0], T.promptFly[1] + 0.05, 1800, 400, 0.05, 0.2);
s.whoosh(T.previewFly[0], T.previewFly[1], 1500, 300, 0.06);
s.bell(T.previewFly[1] - 0.1, 81, 0.05, 0.2, 1.6); s.bell(T.previewFly[1] + 0.05, 86, 0.04, 0.3, 2);
s.whoosh(T.chipsUp[0] - 0.3, T.chipsUp[1] + 0.3, 200, 2400, 0.06);
s.bell(T.planLine[1] - 0.05, 78, 0.04, -0.2, 2.2);
s.bell(T.title, 74, 0.07, 0, 3.5); s.bell(T.title + 0.06, 81, 0.04, 0.25, 3.5);

const file = process.argv[2] || new URL("./out/kiteline-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
const w = s.write(file, { fadeFrom: 27.6 });
console.log(`wrote ${w.file} (${w.seconds.toFixed(3)} s, peak normalized to -1 dBFS)`);
