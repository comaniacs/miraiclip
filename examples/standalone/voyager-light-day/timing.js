// Shared beat map for "One Light-Day". Loaded by film.html as a script and by audio.mjs through node:vm,
// so every picture cut and every sound hit come from the same numbers.
globalThis.TIMING = {
  DUR: 30,
  hook: 0, launch: 3.4, record: 6.4, montage: 9.4, turn: 15.8, whip: 18.3, portrait: 19.4, dot: 22.4, home: 26.4,
  // when each montage print lands on the pile (gaps shrink, so the cuts speed up)
  lands: [9.75, 10.6, 11.35, 12.0, 12.55, 13.05, 13.5, 13.9, 14.25, 14.57, 14.86],
  recordSecond: 7.7,     // the second print in the Golden Record scene
  circle: 23.4,          // the ring drawn around Earth
  hello: 28.0,           // the closing "Say hello."
};
