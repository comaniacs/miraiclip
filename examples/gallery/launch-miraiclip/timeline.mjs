// The one timeline for the Miraiclip launch film: the picture (film/*.js) and the score (audio.mjs) both read it.
// Seconds. The score runs at 120 BPM from 0.4 s, so every scene starts on a beat (0.4 + 0.5k).
const LINES = [8.9, 9.7, 10.5, 11.4, 12.2]; //   dispatch ×3, undo, redo: when each line starts typing
const CODE = ['project.dispatch({ type: "clip/add", … })', 'project.dispatch({ type: "transition/add", … })', 'project.dispatch({ type: "effect/add", … })', "project.undo()", "project.redo()"];
export const CPS = 70; //                     typing speed, characters a second
export const T = {
  DUR: 30,
  FPS: 30,
  slams: [0.0, 0.5, 1.0], //  the three hook words land
  morph: [2.4, 3.4], //       the words shrink into clips on a timeline
  build: [3.4, 8.4], //       the timeline tilts into 3D and fills with clips
  b1: [3.9, 8.0],
  b2: [4.4, 8.0],
  proof: [5.4, 8.0],
  cmd: [8.4, 13.4], //        every edit is a command
  lines: LINES,
  code: CODE,
  cmdAt: LINES.map((t, k) => +(t + CODE[k].length / CPS + 0.1).toFixed(3)), // each command lands when its line is typed
  c1: [8.6, 13.0],
  fx: [13.4, 18.9], //        79 effects
  ai: [18.9, 23.9], //        an agent edits
  type: [19.4, 20.6],
  calls: [20.9, 21.4, 21.9],
  a1: [19.0, 23.5],
  exp: [23.9, 26.4], //       export: the playhead is the progress bar
  e1: [24.0, 26.1],
  flash: 26.4,
  logo: 26.5,
  title: 26.75,
  tag: 27.2,
  url: 27.7,
  rest: [28.6, 30],
};
