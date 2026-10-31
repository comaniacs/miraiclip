// Render the Aperture film with the app-film kit: picture, score, mux, validation, timings.
//   node build.mjs && node render.mjs [--draft] [--workers 4] [--mux-only]
import { renderFilm } from "../_lib/app-film/render.mjs";
import { T } from "./timeline.mjs";

// An edited film: hard cuts on the hook words and the aperture, hexagon wipes into each theme, the tour and the
// proof, and the yellow flood at the lockup. The validator fails on any cut that isn't one of these.
const themeWipes = [1, 2, 3, 4].map((k) => T.themes[0] + 1.2 * k);
const cuts = [...T.words.slice(1), T.ap[0], T.themes[0], ...themeWipes, T.tour[0], T.proof[0], T.wipe]
  .flatMap((t) => [t, t + 1 / T.FPS, t + 2 / T.FPS, t + 3 / T.FPS]);
renderFilm(import.meta.url, { name: "aperture", T, cuts });
