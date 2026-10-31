// Render the DEWLIT UGC ad with the app-film kit: picture, bed, mux, validation, timings. UGC cuts on purpose, so the
// validator is given the planned cuts (shot changes and insert in/out) and fails only on any other cut.
//   node build.mjs && node render.mjs
import { renderFilm } from "../_lib/app-film/render.mjs";
import { T, SHOTS, INSERTS } from "./timeline.mjs";

const cuts = SHOTS.slice(1).map((s) => s.t[0]).concat(Object.values(INSERTS).flat()).filter((t) => t > 0 && t < T.DUR);
renderFilm(import.meta.url, { name: "dewlit", T, cuts });
