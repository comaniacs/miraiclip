// The one timeline for the __TITLE__ film: the picture replays ACTIONS on the real app every frame, and the score
// puts a click or key sound on the same actions. Change the beats here and both follow. Times are seconds.
import { retypeAt, keyTimes, validateActions } from "../_lib/app-film/timeline.mjs";

export const T = {
  DUR: 15,
  FPS: 30,
  head1: [0.5, 2.6], //  the hook, over the window in 3D
  appIn: [0, 0.6], //    the window fades up
  head2: [7.3, 9.4], //  the orbit
  title: 10.4,
  tag: 10.9,
  cta: 11.4,
  rest: [13.4, 15], //   the final frame holds still
};

// what the viewer watches someone do in the app (kinds: click | type | retype | focus; cap: snapshots)
export const ACTIONS = validateActions([
  { t: 3.0, kind: "focus", sel: '[data-field="draft"]' },
  { t: 3.2, kind: "type", sel: '[data-field="draft"]', text: "Book the launch call", dur: 1.3 },
  { t: 4.8, kind: "click", sel: '[data-act="add"]' },
  { t: 5.9, kind: "click", sel: '[data-act="toggle"][data-id="i2"]', cap: { list: ".ap-list" } },
], 15);

export { retypeAt };
export const KEYS = keyTimes(ACTIONS);
