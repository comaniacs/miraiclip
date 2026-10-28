// "Resolution", an original 25.6 s film: one phone is one pixel. The same picture (a smiling classic computer drawn in
// code) resolves as a chain of toppling phones grows: 1, 3x3, 10x10, 32x32 (dark until the drop), 100x100 (12,346 phones
// in all), and the film ends on one phone showing the whole picture, which winks and goes dark on the last hit.
// Beats are cut to a 140 BPM grid. The phones are plain rounded tiles with no marks. Every frame is a pure function of the
// time, drawn on one canvas; the camera is keyed in the script.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";

const W = 1920, H = 1080, DURATION = 25.6;
const film = fs.readFileSync(new URL("./film.js", import.meta.url), "utf8");
const html = `<div class="stage" data-libs="stage" data-duration="${DURATION}" data-stage-version="2" style="width:${W}px;height:${H}px;background:#070a12;overflow:hidden"><canvas id="c" width="${W}" height="${H}" style="position:absolute;left:0;top:0"></canvas></div>\n<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: DURATION, id: "resolution", width: W, height: H });
