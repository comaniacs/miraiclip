// Render "The cloud is underwater" with the app-film kit: picture, score, mux, validation, timings.
//   node build.mjs && node render.mjs [--draft] [--workers 4] [--mux-only]
import { renderFilm } from "../_lib/app-film/render.mjs";
import { T } from "./timeline.mjs";

renderFilm(import.meta.url, { name: "undersea", T });
