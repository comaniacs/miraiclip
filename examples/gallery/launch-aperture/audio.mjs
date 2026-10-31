// The Aperture score on the app-film kit's synthesizer (original, nothing licensed).   node audio.mjs [out.wav]
// 100 BPM. A hit on every hook word; a riser into the aperture; a groove (kick, clap-ish noise, bass, stabs) from 3 s;
// a swish on every hexagon wipe and window; clicks on the tour chips; a big hit and a bell on the yellow lockup.
import fs from "node:fs";
import { createScore, hz } from "../_lib/app-film/audio.mjs";
import { T, BEAT } from "./timeline.mjs";

const s = createScore(T.DUR, { seed: 7 });
// the hook: five hard hits climbing, then a riser into the aperture
T.words.forEach((t, k) => { s.kick(t, 0.22); s.ep(t, hz([40, 43, 45, 47, 48][k]), 0.1, 0, 0.5); s.click(t, 0.1, k % 2 ? 0.4 : -0.4); });
s.whoosh(T.words[4], T.ap[0], 300, 4000, 0.06);
// the groove: A minor → F → C → G, a bar each (4 beats)
const CH = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]];
for (let k = 0, t = T.ap[0]; t < T.wipe - 0.01; k++, t = T.ap[0] + k * BEAT) {
  const [root, stab] = CH[Math.floor(k / 4) % 4];
  s.kick(t, k % 2 ? 0.12 : 0.17);
  if (k % 2) s.whoosh(t, t + 0.12, 2500, 4000, 0.05, 0.1); //  backbeat snap
  s.key(t + BEAT / 2, 0.035, 0.35);
  s.ep(t, hz(root), 0.06, 0, BEAT * 0.9); s.ep(t + BEAT * 0.75, hz(root), 0.04, 0, 0.3);
  if (k % 4 === 0 && t > 7) stab.forEach((m, j) => s.ep(t + j * 0.01, hz(m + 12), 0.022, j % 2 ? 0.4 : -0.4, 1.0));
}
// swishes on every wipe and window, clicks on the chips
[T.themes[0] + 1.2, T.themes[0] + 2.4, T.themes[0] + 3.6, T.themes[0] + 4.8, T.tour[0], T.proof[0], ...T.pages.slice(1), T.end[0]]
  .forEach((t, k) => s.whoosh(t - 0.1, t + 0.35, 600, 2600, 0.045, k % 2 ? 0.3 : -0.3));
T.stops.forEach((t) => { s.click(t + 0.3, 0.14, 0.2); s.shimmer(t + 0.3, 0.01, [81, 88]); });
// the close and the lockup
s.whoosh(T.close[0], T.wipe, 3000, 200, 0.06);
s.kick(T.wipe, 0.26);
[45, 57, 64, 69, 72, 76].forEach((m, j) => s.ep(T.wipe + j * 0.02, hz(m), m < 50 ? 0.09 : 0.035, j % 2 ? 0.35 : -0.35, 3.6));
s.bell(T.name, 81, 0.06, 0, 3.0);
s.click(T.url, 0.12, 0); s.shimmer(T.url, 0.02, [76, 81, 88]);

const file = process.argv[2] || new URL("./out/aperture-score.wav", import.meta.url).pathname;
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
console.log(`wrote ${s.write(file, { fadeFrom: 28.6 }).file}`);
