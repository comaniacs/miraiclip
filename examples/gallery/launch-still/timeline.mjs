// The one timeline for "STILL": every picture beat (film/*.js) and every sound (audio.mjs) reads these numbers, so a
// change here moves the shot and its score together. Times are seconds; 30 s at 30 fps is 900 frames.

export const T = {
  DUR: 30,
  FPS: 30,

  // 1 · hook (0–4): in the dark, the ring of light draws itself, one segment per minute
  drawStart: 0.25,
  drawEnd: 3.55,
  hook1In: 0.7,
  hook2In: 1.25,
  hookOut: 3.4,

  // 2 · reveal (4–9): the ring completes, a light sweep finds the object, the camera tilts down to a hero angle
  ringFull: 3.65,
  lightOn: [3.7, 5.4],
  revealIn: 5.0,
  wordIn: 5.35,
  subIn: 5.9,
  revealOut: 8.5,

  // 3 · craft (9–14): a macro pass along the knurled edge, the exploded view with callouts, and the reassembly
  macro: [8.7, 10.6],
  explode: [10.4, 11.4],
  callouts: [11.0, 11.45, 11.9],
  calloutsOut: 13.05,
  assemble: [13.1, 13.75],
  click: 13.75,

  // 4 · feature (14–20): turn to set (25 detents light 25 segments), then the light keeps time
  turnIn: 14.1,
  turn: [14.75, 16.55],
  minutes: 25,
  setOut: 17.35,
  keepIn: 17.55,
  keepOut: 19.6,
  countdown: 17.0, // the timer starts when the hand lets go

  // 5 · payoff (20–26): the noise arrives as notifications, the ring sweeps it away
  pings: [20.2, 20.55, 20.85, 21.1, 21.32, 21.52, 21.7, 21.86],
  wave: 22.55,
  waveEnd: 24.6,
  calmIn: 23.35,
  calmOut: 25.55,

  // 6 · hero and call to action (26–30)
  title: 26.5,
  tag: 27.05,
  cta: 27.65,
};

// the detent clicks while the dial turns: one per minute set, on the same curve that lights the segments
export function detentTimes() {
  const out = [];
  for (let m = 1; m <= T.minutes; m++) out.push(+(T.turn[0] + (T.turn[1] - T.turn[0]) * turnInverse(m / T.minutes)).toFixed(4));
  return out;
}
// the turn eases in and out; minute m is reached when ease(u) = m / minutes
export function turnEase(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
function turnInverse(y) { let a = 0, b = 1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (turnEase(m) < y) a = m; else b = m; } return (a + b) / 2; }

// the hook: segments drawn on an ease-out, so the first ticks are slow and readable
export function drawEase(u) { u = Math.max(0, Math.min(1, u)); return 1 - Math.pow(1 - u, 2.2); }
export function hookTicks() {
  const out = [];
  for (let s = 5; s <= 60; s += 5) {
    let a = 0, b = 1;
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (drawEase(m) * 60 < s) a = m; else b = m; }
    out.push(+(T.drawStart + (T.drawEnd - T.drawStart) * a).toFixed(4));
  }
  return out;
}
