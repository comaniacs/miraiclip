// "Resolution" v2, an original 25.6 s film: one phone is one pixel, as a real 3D domino run drawn with three.js.
// A generic phone (rounded slab, plain camera bump, no marks) is instanced for every domino. Each one tips on its
// bottom edge into the next and its screen lights as it lands, so a picture (a smiling classic computer drawn in code)
// appears where the wave has passed: 1, 3x3, 10x10, 32x32 (dark until the drop), 100x100. Cut to a 140 BPM grid.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";

const W = 1920, H = 1080, DURATION = 25.6;
const film = fs.readFileSync(new URL("./film.js", import.meta.url), "utf8");
const html = `<div class="stage" data-libs="stage three" data-duration="${DURATION}" data-stage-version="2" data-frame-timeout="120" style="width:${W}px;height:${H}px;background:#e9eaec;overflow:hidden"><canvas id="c" width="${W}" height="${H}" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px"></canvas></div>\n<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: DURATION, id: "resolution-3d", width: W, height: H });
