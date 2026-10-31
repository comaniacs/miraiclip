// Render the __TITLE__ film: picture, score, mux, validation, timings.
//   node build.mjs && node render.mjs [--draft] [--blur] [--workers 4] [--mux-only]
import { renderFilm } from "../_lib/app-film/render.mjs";
import { T } from "./timeline.mjs";

renderFilm(import.meta.url, { name: "__ID__", T });
