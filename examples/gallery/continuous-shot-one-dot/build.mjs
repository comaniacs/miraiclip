// Builds the "one dot" sample: a 14 s continuous shot for an invented habit app, "Tally".
// One dot becomes a ring, hops onto a week, six more dots gather into a streak bar, a click
// opens a confirmation, and the confirmation folds into the wordmark. Nothing cuts.
//
// Concept chosen: "one element that transforms through the whole film" (alternatives were
// "a cursor that opens each screen" and "a camera that falls into each detail").
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
import fs from "node:fs";
import { createProject } from "../../../packages/core/dist/index.js";

const W = 1920, H = 1080, DURATION = 14;

const css = `
*{box-sizing:border-box;margin:0}
.stage{background:#10131c;color:#f4efe6;font-family:Inter,"DejaVu Sans",system-ui,sans-serif;overflow:hidden}
.world{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
.abs{position:absolute}
#dot{left:300px;top:690px;width:36px;height:36px;border-radius:50%;background:#ffb454;z-index:6}
#ring{left:${W / 2 - 190}px;top:${H / 2 - 190}px;width:380px;height:380px;border-radius:50%;border:16px solid #ffb454;background:#171b27;display:grid;place-items:center;z-index:5}
#ring p{font-size:150px;font-weight:800;color:#f4efe6}
.row{left:${W / 2 - 700}px;top:${H / 2 - 80}px;width:1400px;height:160px;display:flex;gap:16px;z-index:3}
.day{flex:1;border-radius:20px;background:#1d2231;border:3px solid #2a3046;display:grid;place-items:center;font-size:44px;font-weight:700;color:#9aa3bd}
.day.first{border-color:#ffb454;color:#ffb454}
.pip{width:44px;height:44px;border-radius:50%;background:#ffb454;opacity:0}
#bar{left:${W / 2 - 650}px;top:${H / 2 + 190}px;width:1300px;height:120px;border-radius:60px;background:#1d2231;border:3px solid #2a3046;z-index:4;display:flex;align-items:center;justify-content:center;font-size:46px;font-weight:700}
#btn{left:${W / 2 - 190}px;top:${H / 2 + 330}px;width:380px;height:110px;border-radius:28px;background:#ffb454;color:#10131c;display:grid;place-items:center;font-size:46px;font-weight:800;z-index:4}
#card{left:${W / 2 - 450}px;top:${H / 2 - 225}px;width:900px;height:450px;border-radius:36px;background:#f4efe6;color:#10131c;display:grid;place-items:center;z-index:8;text-align:center}
#card h2{font-size:110px;font-weight:800;line-height:1}
#card p{font-size:44px;color:#5c6378;margin-top:14px}
#word{left:${W / 2 - 380}px;top:${H / 2 - 110}px;width:760px;height:220px;border-radius:110px;background:#ffb454;color:#10131c;display:grid;place-items:center;z-index:9;font-size:140px;font-weight:800;letter-spacing:-.02em}
#ring,#card,#word,.row,#bar,#btn{opacity:0}
`;

const markup = `<div class="world">
<i class="abs" id="dot"></i>
<div class="abs" id="ring"><p>7</p></div>
<div class="abs row" id="row">${["M", "T", "W", "T", "F", "S", "S"].map((d, i) => `<div class="day${i === 0 ? " first" : ""}" id="d${i}">${i === 0 ? "" : d}</div>`).join("")}</div>
${[1, 2, 3, 4, 5, 6].map((i) => `<i class="abs pip" id="p${i}" style="left:${W / 2 - 700 + i * 202.3 + 93 - 22}px;top:${H / 2 - 22}px"></i>`).join("")}
<div class="abs" id="bar">7-day streak</div>
<div class="abs" id="btn">Log it</div>
<div class="abs" id="card"><div><h2>Done.</h2><p>Day 7 of 7</p></div></div>
<div class="abs" id="word">Tally</div>
</div>`;

const script = `
S.grid({ depth: 0.5, spacing: S.min(7), dot: 2, color: "#8b93b8", opacity: 0.14 });

tl.label("spark", 0)
  .to("#dot", { x: S.w(34.4), y: -S.h(13.9), duration: 1.9, ease: "sine.inOut" }, 0)
  .follow("#dot", { lead: 0.15, from: 0, to: 1.9 })
  .label("ring", 1.9)
  .set("#ring", { opacity: 1 }, "ring")
  .morph("#dot", "#ring", { duration: 1.2, ease: "expo.inOut" }, "ring")
  .camera({ zoom: 1.06, duration: 3.2, ease: "sine.inOut" }, "ring")
  .label("week", 3.8)
  .set(".row", { opacity: 1 }, "week")
  .to("#ring p", { opacity: 0, duration: 0.3, ease: "sine.in" }, "week")
  .morph("#ring", "#d0", { duration: 1.0, ease: "expo.inOut" }, "week")
  .from(".day:not(.first)", { scale: 0.6, opacity: 0, duration: 0.6, stagger: 0.07, ease: "expo.out" }, "week+=0.5")
  .camera({ zoom: 0.94, duration: 2, ease: "inOut(3)" }, "week")
  .label("fill", 5.6)
  .set(".pip", { opacity: 1 }, "fill")
  .from(".pip", { scale: 0, duration: 0.35, stagger: 0.08, ease: "back.out" }, "fill")
  .set("#bar", { opacity: 1 }, "fill+=0.9")
  .gather(".pip", { into: "#bar", arc: 0.25, stagger: 0.06, duration: 0.9 }, "fill+=0.9")
  .from("#bar", { scaleX: 0.5, duration: 0.7, ease: "expo.out" }, "fill+=0.9")
  .set("#btn", { opacity: 1 }, "fill+=1.5")
  .from("#btn", { y: S.h(4), duration: 0.5, ease: "expo.out" }, "fill+=1.5")
  .label("rest", 7.8)
  .rest("rest", "rest+=0.7")
  .pointer({ path: [{ t: 0, x: S.w(104), y: S.h(96) }, { t: 6.8, x: S.w(78), y: S.h(90) }, { t: 7.5, x: S.w(50), y: S.h(86) }, { t: 9.4, x: S.w(50), y: S.h(86) }, { t: 10.2, x: S.w(104), y: S.h(96) }], clicks: [8.6] })
  .label("press", 8.6)
  .press("#btn", 8.6)
  .shake(8.6, { amp: S.min(0.9), decay: 0.35, seed: 3 })
  .label("confirm", 9.2)
  .set("#card", { opacity: 1 }, "confirm")
  .iris("#card", { from: "#btn", duration: 1.0, ease: "inOut(3)" }, "confirm")
  .camera({ zoom: 1.04, duration: 2, ease: "sine.inOut" }, "confirm")
  .label("lockup", 11)
  .set("#word", { opacity: 1 }, "lockup")
  .morph("#card", "#word", { duration: 1.1, ease: "expo.inOut" }, "lockup")
  .handheld({ amount: S.min(0.25) }, 0, ${DURATION})
  .label("end", 12.9);
`;

const html = `<div class="stage" data-libs="stage" data-duration="${DURATION}" data-stage-version="2" style="width:${W}px;height:${H}px"><style>${css}</style>${markup}</div>\n<script>stage.build((tl, S) => {${script}});</script>`;
fs.writeFileSync(new URL("./sequence.html", import.meta.url), html);

const project = createProject({ width: W, height: H, fps: 30 });
project.transaction(() => {
  project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
  project.dispatch({ type: "clip/add", payload: { kind: "html", id: "tally", trackId: "v1", startUs: 0, durationUs: DURATION * 1_000_000, template: html, scripted: true } });
});
fs.writeFileSync(new URL("./video.miraiclip.json", import.meta.url), JSON.stringify(project.toJSON(), null, 2) + "\n");
console.log("wrote sequence.html and video.miraiclip.json");
