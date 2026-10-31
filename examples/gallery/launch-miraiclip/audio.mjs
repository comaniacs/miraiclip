// The Miraiclip launch score on the app-film kit's synthesizer (original, nothing licensed).   node audio.mjs [out.wav]
// Three hits for the hook words; a 120 BPM pulse (kick, bass, arpeggio) from the build; key ticks for typed code and the
// prompt; clicks as commands land; a riser into the export flash; a bell and a chord on the lockup.
import fs from "node:fs";
import { createScore, hz } from "../_lib/app-film/audio.mjs";
import { T, CPS } from "./timeline.mjs";

const s = createScore(T.DUR, { seed: 31 });
const BEAT = 0.5, GRID = 0.4, END = T.flash;
// the hook: a kick, a low stab and a shimmer on each word
T.slams.forEach((t, k) => { s.kick(t, 0.2); s.ep(t, hz([45, 48, 52][k]), 0.09, 0, 1.2); s.shimmer(t, 0.012, [69 + k * 3, 76 + k * 3]); });
s.whoosh(T.morph[0] - 0.3, T.morph[1], 400, 3000, 0.05);
// the pulse: four-on-the-floor, an eighth-note bass, an arpeggio over A minor → F → C → G
const CH = [[45, [69, 72, 76, 79]], [41, [65, 69, 72, 76]], [48, [67, 72, 76, 79]], [43, [67, 71, 74, 79]]];
for (let k = 0, t = T.build[0]; t < END - 0.01; k++, t = T.build[0] + k * BEAT) {
  const bar = Math.floor(k / 4) % 4, [root, arp] = CH[bar];
  s.kick(t, k % 4 === 0 ? 0.17 : 0.12);
  s.ep(t, hz(root), 0.06, 0, 0.45); s.ep(t + BEAT / 2, hz(root + 12), 0.035, 0, 0.3);
  s.key(t + BEAT / 2, 0.03, 0.4); // off-beat hat
  arp.forEach((m, j) => { if (t > 5) s.ep(t + j * BEAT / 4, hz(m), 0.018, j % 2 ? 0.45 : -0.45, 0.6); });
}
// typed code and the prompt: a key tick per character; each command lands with a click
T.code.forEach((line, k) => { for (let i = 0; i < line.length; i += 2) s.key(T.lines[k] + i / CPS, 0.035, -0.3); s.click(T.cmdAt[k], 0.16, 0.2); });
for (let i = 0; i < 24; i++) s.key(T.type[0] + i * (T.type[1] - T.type[0]) / 24, 0.035, -0.3);
T.calls.forEach((t) => { s.click(t, 0.15, 0.3); s.shimmer(t, 0.01, [81, 88]); });
// effects: a soft tick per look
for (let t = T.fx[0] + 0.6; t < T.fx[1] - 0.6; t += 0.36) s.click(t, 0.06, 0.3);
// export: a riser into the flash, a chord on it, the name's bell
s.whoosh(T.exp[0] + 0.4, END, 200, 6000, 0.07);
s.kick(END, 0.24);
[45, 57, 64, 69, 72, 76].forEach((m, j) => s.ep(END + j * 0.02, hz(m), m < 50 ? 0.08 : 0.035, j % 2 ? 0.35 : -0.35, 3.6));
s.bell(T.logo + 0.1, 81, 0.06, 0, 3.2);
s.click(T.url, 0.12, 0); s.shimmer(T.url, 0.02, [76, 81, 88]);

const file = process.argv[2] || new URL("./out/miraiclip-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: 28.6 }).file}`);
