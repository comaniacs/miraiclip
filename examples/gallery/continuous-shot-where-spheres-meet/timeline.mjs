// The one timeline for "Where the Spheres Meet": the picture (film/*.js) and the score (audio.mjs) read these
// numbers, so a change here moves both. Times are seconds.
export const T = {
  DUR: 30,
  FPS: 30,

  // 1 · hook: pulses fall into the blue dot
  hook1In: 0.4,
  hook2In: 1.6,
  hookOut: 3.8,
  pulseLands: [0.7, 1.5, 2.3, 3.1],

  // 2 · setup: the pull-back to orbit
  zoomStart: 3.6,
  zoomEnd: 9.4,
  setupIn: 4.6,
  setupOut: 8.8,
  earthFade: [5.2, 6.8],
  altLabel: [7.4, 9.6],

  // 3 · mechanism: delay → distance → sphere 1
  focus: 9.6,
  packet: [9.9, 11.1],
  sphere1: [11.2, 12.4],
  mech1In: 9.8,
  mech1Out: 12.1,
  mech2In: 12.4,
  mech2Out: 14.8,
  mathIn: 10.0,
  mathOut: 14.8,

  // 4 · transformation: two spheres, a circle; three, two points
  sphere2: [15.0, 16.2],
  circle: [15.8, 17.0],
  sphere3: [17.6, 18.6],
  points: 18.6,
  ghost: 19.4,
  tr1In: 15.4,
  tr1Out: 17.6,
  tr2In: 18.0,
  tr2Out: 20.9,
  restFrom: 20.2,
  restTo: 20.9,

  // 5 · reveal: the dive home
  dive: [21.0, 26.2],
  revIn: 21.6,
  revOut: 25.4,
  footIn: 22.2,
  footOut: 25.4,

  // 6 · resolution
  converge: 26.0,
  title: 26.4,
  sub: 27.1,
};
