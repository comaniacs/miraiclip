// The one timeline for "The cloud is underwater": the picture (film/*.js) and the score (audio.mjs) both read it.
// Seconds, at 120 BPM (a beat is 0.5 s).
export const T = {
  DUR: 30,
  FPS: 30,
  q1: [-0.2, 3.1], //          "Quick question…" (already popping in on frame 0)
  q2: [0.6, 3.1], //           "Where IS the cloud?"
  s1: [3.3, 6.2], //           "Up in the sky?"
  sat: [3.3, 5.3], //          a satellite whizzes past
  nope: 4.6, //                NOPE stamp
  s2: [5.1, 6.2], //           satellites carry a tiny slice
  mask: 6.3, //                Nimbus puts on a snorkel mask
  jump: 6.8,
  splash: 7.5,
  d1: [7.9, 10.6], //          "It's down here!"
  seabed: 10.8,
  c1: [11.0, 16.2], //         ~99% of data between continents
  c2: [11.5, 16.2], //         travels through undersea cables
  xs: [13.4, 16.2], //         the cross-section: garden-hose thick
  globe: [16.4, 21.4], //      1.4 million+ km, 35 times round the Earth
  wraps: [17.4, 20.4],
  brk: [21.4, 26.0], //        they break; who did it?
  b1: [21.8, 25.8],
  shark: [22.4, 24.2],
  b2: 23.1, //                 "Sharks? Rarely."
  anchor: 24.2,
  hit: 24.6,
  b3: 24.8, //                 "Usually: anchors & fishing gear."
  outro: [26.0, 30],
  o1: 26.2, o2: 26.7, o3: 27.4,
  rest: [28.6, 30],
};
