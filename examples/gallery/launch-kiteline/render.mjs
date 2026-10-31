// Render the Kiteline film end to end with the app-film kit: picture, score, mux, validation, timings.
//   node build.mjs && node render.mjs [--draft] [--blur] [--workers 4] [--mux-only]
import { renderFilm } from "../_lib/app-film/render.mjs";
import { T } from "./timeline.mjs";

renderFilm(import.meta.url, { name: "kiteline", T });
