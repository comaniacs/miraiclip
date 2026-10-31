// The one timeline for the Foldwork film: the picture (film/*.js) and the score (audio.mjs) both read it.
// Times are seconds; 30 s at 30 fps is 900 frames.

export const T = {
  DUR: 30,
  FPS: 30,
  crease: [0.3, 1.9], //   the first line of light
  first: [2.0, 3.4], //    the first fold stands up
  hook: [0.5, 3.6],
  grid: [4.0, 6.0], //     the street creases draw
  wave: [4.4, 8.2], //     the buildings fold up
  intro: [4.6, 8.4],
  tower: [10.2, 12.6], //  the annotated tower folds up slowly
  disc: [11.0, 14.4],
  dusk: [15.0, 18.0], //   the light warms, windows come on
  birds: [15.6, 21.5],
  trans: [16.2, 20.4],
  mark: [21.6, 24.4], //   the line draws the mark on the plan
  reveal: [22.0, 25.6],
  fold: [25.8, 27.2], //   the city folds down
  close: [26.6, 28.4], //  the book closes
  tag: 28.0,
  cta: 28.5,
};

// the buildings: [x, z, width, depth, height] on the right page (x 0…1600, z −550…550); index 0 is the first fold,
// index 1 the annotated tower. The order of the rest is the order of the wave (outward from the first).
export const CITY = [
  [760, 40, 150, 110, 210], [1040, -120, 120, 120, 330],
  [560, -150, 130, 100, 170], [950, 200, 140, 100, 150], [600, 230, 110, 90, 120], [1180, 120, 130, 110, 240],
  [380, 20, 120, 100, 140], [1250, -250, 140, 110, 190], [800, -300, 160, 100, 120], [420, -330, 110, 90, 200],
  [1420, 30, 110, 120, 130], [230, 260, 120, 90, 100], [1400, 330, 120, 90, 160], [260, -170, 100, 90, 120],
  [1100, 380, 130, 80, 110], [560, 420, 140, 70, 90],
];
// when each building folds up: the first at T.first, the tower at T.tower, the rest in the wave by distance
export function popTimes() {
  const [x0, z0] = CITY[0], rest = CITY.map((c, i) => ({ i, d: Math.hypot(c[0] - x0, c[1] - z0) })).filter((o) => o.i > 1).sort((a, b) => a.d - b.d);
  const out = [];
  out[0] = T.first[0]; out[1] = T.tower[0];
  rest.forEach((o, k) => { out[o.i] = +(T.wave[0] + (T.wave[1] - T.wave[0] - 0.8) * k / (rest.length - 1)).toFixed(3); });
  return out;
}
