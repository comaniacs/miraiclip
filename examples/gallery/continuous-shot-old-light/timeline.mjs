// The one timeline for "Old Light": every picture beat (film/*.js) and every sound (audio.mjs) reads these numbers,
// so a change here moves the shot and its score together. Times are seconds.

export const T = {
  DUR: 30,
  FPS: 30,

  // 1 · hook: the photon pinballs in the plasma
  hook1In: 0.5,
  hook2In: 1.5,
  hookOut: 3.9,

  // 2 · setup: the log zoom out of the core
  zoomStart: 4.0,
  zoomEnd: 9.4,
  setupIn: 4.8,
  setupOut: 8.4,
  sunFade: [7.6, 8.9],
  starsFade: [8.6, 10.2],
  coreLabel: [8.0, 9.5],

  // 3 · mechanism: the random walk across the cut face, then convection
  walkStart: 9.0,
  walkEnd: 13.2,
  convEnd: 14.1,
  restEnd: 14.9, // a declared rest 14.1 → 14.9 before the breakout
  radLabel: [9.6, 12.9],
  convLabel: [13.0, 14.3],
  mech1In: 9.4,
  mech1Out: 12.8,
  mech2In: 13.0,
  mech2Out: 14.6,
  yearsOut: 14.7,

  // 4 · transformation: free, straight, at the speed of light
  breakout: 15.0,
  rideStart: 16.4,
  approach: 20.2,
  landing: 21.0,
  freeIn: 15.8,
  freeOut: 18.6,
  clockIn: 15.6,
  clockOut: 20.9,

  // 5 · reveal: the comparison
  revealIn: 22.0,
  revealOut: 25.6,
  barIn: 21.8,
  barTick: 23.4,
  barOut: 25.8,

  // 6 · resolution: the lockup
  title: 26.4,
  sub: 27.1,
};

// The micro collisions: irregular and readable in the hook, then accelerating into a blur as the zoom pulls out.
// Deterministic, so the picture and the ticks in the score land on the same frame.
export function collisionTimes() {
  const hook = [0.32, 0.98, 1.58, 2.31, 2.92, 3.55];
  const out = [...hook];
  let t = hook[hook.length - 1];
  let dt = 0.52;
  while (t < 8.9) {
    dt = Math.max(0.016, dt * 0.9);
    t += dt;
    out.push(+t.toFixed(4));
  }
  return out;
}
