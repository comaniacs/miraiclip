// The one timeline for the Kiteline launch film. The picture (film/*.js) replays ACTIONS on the real app every frame,
// and the score (audio.mjs) puts a click or typing sound on the same actions, so UI, motion and sound can't drift.
// Times are seconds; 30 s at 30 fps is 900 frames.
import { retypeAt, keyTimes, validateActions } from "../_lib/app-film/timeline.mjs";

export const T = {
  DUR: 30,
  FPS: 30,
  TODAY: "2026-11-09",

  // 1 · hook
  hook1: [0.45, 2.0],
  hook2: [2.1, 3.7],
  thread: [0.8, 2.4], //  the line threads the five real ideas
  land: [2.3, 3.5], //    they fly to their calendar chips
  tiles: [2.2, 3.5], //   the day tiles assemble
  appIn: [3.55, 4.35], // the real app fades in under the tiles

  // 2 · calendar
  head2: [6.7, 8.45],
  lift: [8.3, 9.35], //   the Thursday column lifts out and flies to the idea field

  // 3 · prompt studio
  reveal: [11.9, 12.65],
  head3: [12.75, 13.85],
  promptFly: [13.9, 14.55],

  // 4 · editor
  head4: [18.4, 19.4],
  previewFly: [19.6, 20.55],

  // 5 · schedule and organize
  chipsUp: [22.0, 23.2],
  planLine: [22.9, 24.4],
  head5: [22.6, 25.4],

  // 6 · hero
  settle: [25.6, 26.8],
  heroIn: [25.8, 27.1],
  title: 26.5,
  tag: 27.0,
  cta: 27.5,
};

const CAPTION_FROM = "Meet Fieldnote, our new meeting-notes app.";
const CAPTION_TO = "Your meetings deserve better notes. Meet Fieldnote.";
// what the viewer watches someone do in the app. kind: click | type | retype | focus; cap: snapshots taken just before
export const ACTIONS = [
  { t: 4.9, kind: "click", sel: '[data-act="view"][data-view="week"]' },
  { t: 5.9, kind: "click", sel: '.kl-wh[data-date="2026-11-12"]' },
  { t: 8.3, kind: "click", sel: '.kl-day [data-act="start"]', cap: { thu: '.kl-col[data-date="2026-11-12"]' } },
  { t: 9.25, kind: "type", sel: '[data-field="idea"]', text: "Introduce Fieldnote, our new meeting-notes app", dur: 1.35 },
  { t: 10.85, kind: "click", sel: '[data-act="studio"][data-field="platform"][data-value="linkedin"]' },
  { t: 11.15, kind: "click", sel: '[data-act="studio"][data-field="audience"][data-value="team-leads"]' },
  { t: 11.45, kind: "click", sel: '[data-act="studio"][data-field="tone"][data-value="confident"]' },
  { t: 11.85, kind: "click", sel: '[data-act="generate"]' },
  { t: 13.9, kind: "click", sel: '[data-act="write"]', cap: { prompt: ".kl-out" } },
  { t: 15.0, kind: "focus", sel: '[data-field="text"]' },
  { t: 15.2, kind: "retype", sel: '[data-field="text"]', from: CAPTION_FROM, to: CAPTION_TO, dur: 1.5 },
  { t: 16.95, kind: "click", sel: '[data-act="edit"][data-field="media"][data-value="m2"]' },
  { t: 17.45, kind: "click", sel: '[data-act="edit"][data-field="platform"][data-value="instagram"]' },
  { t: 18.0, kind: "click", sel: '[data-act="edit"][data-field="platform"][data-value="linkedin"]' },
  { t: 19.6, kind: "click", sel: '[data-act="schedule"]', cap: { preview: ".kl-pv" } },
  { t: 21.4, kind: "click", sel: '[data-act="view"][data-view="month"]' },
];

validateActions(ACTIONS, T.DUR);
export { retypeAt };
export const KEYS = keyTimes(ACTIONS); // every key press, for the typing sounds
