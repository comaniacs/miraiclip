// The one timeline for the Aperture launch film: the picture (film/*.js) and the score (audio.mjs) both read it.
// Seconds, at 100 BPM (one beat = 0.6 s from 0), so every scene and every cut lands on a beat.
export const BEAT = 0.6;
export const T = {
  DUR: 30,
  FPS: 30,
  words: [0, 0.6, 1.2, 1.8, 2.4], // the hook: one word per beat, full frame
  ap: [3.0, 7.2], //                the hexagon aperture opens on the editor
  apHead: [4.5, 6.7],
  themes: [7.2, 13.2], //           one engine, five looks: a theme per two beats
  tour: [13.2, 19.2], //            you bring the UI, we bring the rest
  stops: [14.4, 15.6, 16.8, 18.0], // preview, timeline, assistant, export
  proof: [19.2, 24.6], //           miraiclip.com, three sections
  pages: [19.2, 21.0, 22.8],
  end: [24.6, 30],
  close: [25.8, 26.4], //           the aperture closes into the mark
  wipe: 26.4, //                    yellow floods out from the mark
  name: 26.7,
  tag: 27.2,
  url: 27.7,
  rest: [28.6, 30],
};
