// The one timeline for "The flower doing math": the picture (film/*.js) and the score (audio.mjs) both read it.
// Seconds, at 112 BPM-ish pacing (no hard grid: the angle sweeps set the rhythm).
export const GOLDEN = 360 * (1 - 1 / ((1 + Math.sqrt(5)) / 2)); // 137.5077…°
export const T = {
  DUR: 30,
  FPS: 30,
  N: 1000, //                      seeds
  h1: [-0.35, 3.0], //             "This flower is doing math." (already rising on frame 0)
  h2: [1.2, 3.0],
  rule: [3.2, 6.8], //             zoom into the centre: turn θ, nudge outward
  seeds: [4.0, 0.3], //            the first seeds land one by one: start, gap
  // the angle: [time it arrives, degrees]; it morphs over 0.6 s into each (1.3 s for the slow approach to golden), then holds
  angles: [[0, GOLDEN], [6.8, 90], [9.2, 120], [11.0, 144], [12.4, 137.0], [14.2, GOLDEN]],
  a1: [7.0, 8.5], a2: [9.3, 10.3], a3: [11.1, 11.75], a4: [12.4, 13.7],
  lock: 14.2, //                   the golden angle clicks in
  g1: [14.0, 18.8], g2: [14.6, 18.8], g3: [15.6, 18.8],
  sp34: [19.2, 21.9], //           34 spirals one way
  sp55: [22.0, 24.7], //           55 the other
  f1: [19.2, 24.8], fib: [19.8, 24.8],
  petals: [25.0, 26.3],
  p1: 25.5, p2: 26.4,
  rest: [28.6, 30],
};
