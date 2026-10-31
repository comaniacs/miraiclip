// Render the Miraiclip launch film with the app-film kit: picture, score, mux, validation, timings.
//   node build.mjs && node render.mjs [--draft] [--blur] [--workers 4] [--mux-only]
import { renderFilm } from "../_lib/app-film/render.mjs";
import { T } from "./timeline.mjs";

// planned cuts: each hook word slams in on its first frame, and the white flash hands the export to the end card
const cuts = [...T.slams.map((t) => t + 1 / T.FPS), T.flash - 2 / T.FPS, T.flash];
renderFilm(import.meta.url, { name: "miraiclip", T, cuts });
