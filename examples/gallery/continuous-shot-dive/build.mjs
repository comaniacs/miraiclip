// Builds the "continuous shot dive" sample: one 14 s scripted sequence that opens on a dot,
// morphs it into a monitor, dives through four screens inside screens (about 160× deep), rests,
// and pulls back out to where it began. Everything uses the stage kit's version 2 verbs.
//
//   node build.mjs   writes sequence.html (the sequence on its own) and video.miraiclip.json
import fs from "node:fs";
import { createProject } from "../../../packages/core/dist/index.js";

const W = 1920, H = 1080, DURATION = 14;
const MON_W = 560, MON_H = 315, BORDER = 10;
const SCREEN_W = MON_W - BORDER * 2; // 540
const SCALE = SCREEN_W / W; // each nested level is drawn at this scale inside the screen above it
const LEVELS = 4; // L0 holds L1 … L3 holds L4
const ZOOM = Math.pow(1 / SCALE, LEVELS);

const hue = (n) => 215 + n * 38;
const level = (n, inner) => `
<div class="lv" id="L${n}" style="--h:${hue(n)}">
  <p class="cap">LEVEL ${n}</p>
  <div class="mon" id="mon${n}"><div class="scr">${inner}</div></div>
  <i class="m" id="m${n}"></i>
</div>`;
const innermost = `<div class="lv last" id="L${LEVELS}" style="--h:${hue(LEVELS)}"><p class="cap">LEVEL ${LEVELS}</p><p class="end">…and another.<span class="caret"></span></p><i class="m" id="m${LEVELS}"></i></div>`;
let nest = innermost;
for (let n = LEVELS - 1; n >= 0; n--) nest = level(n, nest);

const css = `
*{box-sizing:border-box;margin:0}
.stage{background:#080b16;color:#eef1ff;font-family:Inter,"DejaVu Sans",system-ui,sans-serif;overflow:hidden}
.world{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
.title{z-index:5;position:absolute;left:0;width:${W}px;top:120px;text-align:center;font-weight:800;font-size:74px;letter-spacing:-.02em}
.lv{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;--bg:hsl(var(--h) 50% 12%);--ac:hsl(var(--h) 90% 64%);background:var(--bg)}
.lv .cap{position:absolute;left:0;width:${W}px;top:60px;text-align:center;font-size:34px;letter-spacing:.34em;color:var(--ac);font-weight:700}
.mon{position:absolute;left:${(W - MON_W) / 2}px;top:300px;width:${MON_W}px;height:${MON_H}px;border-radius:26px;background:hsl(var(--h) 40% 30%);border:${BORDER}px solid hsl(var(--h) 40% 30%)}
.scr{position:absolute;inset:0;border-radius:14px;overflow:hidden;background:var(--bg)}
.scr > .lv{left:0;top:0;transform:scale(${SCALE})}
.m{position:absolute;left:${W / 2 - 6}px;top:${H / 2 - 6}px;width:12px;height:12px;border-radius:50%;background:var(--ac)}
.lv:not(.last) > .m{top:${H - 90}px}
#L0{background:none}
#seed{z-index:4;position:absolute;left:${W / 2 - 14}px;top:${300 + MON_H / 2 - 14}px;width:28px;height:28px;border-radius:50%;background:hsl(${hue(0)} 90% 64%)}
.last .end{position:absolute;left:0;width:${W}px;top:430px;text-align:center;font-size:96px;font-weight:800;color:var(--ac);white-space:nowrap}
.caret{display:inline-block;width:10px;height:84px;margin-left:12px;background:var(--ac);vertical-align:-10px}
`;

const markup = `<div class="world">
<p class="title">Every screen holds another.</p>
<i id="seed"></i>
${nest}
</div>`;

const script = `
const Z = ${ZOOM};
const home = S.center("#m${LEVELS}");
const homeAt = [(home.x / S.width) * 100, (home.y / S.height) * 100];
const words = S.split(".title", "words");
S.grid({ depth: 0.6, spacing: S.min(7), dot: 2, color: "#8b93b8", opacity: 0.16 });
tl.label("open", 0)
  .from(words, { y: S.h(5), opacity: 0, blur: 10, duration: 0.7, stagger: 0.09, ease: "expo.out" }, 0.2)
  .from("#seed", { scale: 0, duration: 0.5, ease: "back.out" }, 0.2)
  .morph("#seed", "#mon0", { duration: 1.1, ease: "expo.inOut" }, 0.9)
  .camera({ zoom: 1.05, duration: 2.4, ease: "sine.inOut" }, 0)
  .label("dive", 2.4)
  .hit("dive", "dive", { kind: "whoosh", pan: -0.3 })
  .camera({ anchor: "#m${LEVELS}", at: [50, 50], zoom: Z, duration: 4.2, ease: "inOut(3)" }, "dive")
  .hit("deep", "dive+=4.2", { kind: "land" })
  .shake("dive+=4.2", { amp: S.min(0.9), decay: 0.4, seed: 5 })
  .from(".end", { y: S.h(3), opacity: 0, duration: 0.5, ease: "expo.out" }, "dive+=3.6")
  .label("rest", 7.4)
  .rest("rest", "rest+=1.1", { allow: [".caret"] })
  .set(".caret", { opacity: 0 }, "rest+=0.3")
  .set(".caret", { opacity: 1 }, "rest+=0.7")
  .label("out", 8.6)
  .hit("out", "out", { kind: "whoosh", pan: 0.3 })
  .camera({ anchor: "#m${LEVELS}", at: homeAt, zoom: 1, duration: 3.6, ease: "inOut(3)" }, "out")
  .hit("home", "out+=3.6", { kind: "land" })
  .camera({ zoom: 1.04, duration: 1.6, ease: "sine.inOut" }, "out+=3.7")
  .handheld({ amount: S.min(0.25) }, 0, ${DURATION});
for (let n = 0; n <= ${LEVELS}; n++) {
  tl.to("#m" + n, { scale: 1.7, duration: 0.7, ease: "sine.inOut" }, 1.4 + n * 0.12).to("#m" + n, { scale: 1, duration: 0.7, ease: "sine.inOut" }, ">");
}
`;

const html = `<div class="stage" data-libs="stage" data-duration="${DURATION}" data-stage-version="2" style="width:${W}px;height:${H}px"><style>${css}</style>${markup}</div>\n<script>stage.build((tl, S) => {${script}});</script>`;
fs.writeFileSync(new URL("./sequence.html", import.meta.url), html);

const project = createProject({ width: W, height: H, fps: 30 });
project.transaction(() => {
  project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
  project.dispatch({ type: "clip/add", payload: { kind: "html", id: "dive", trackId: "v1", startUs: 0, durationUs: DURATION * 1_000_000, template: html, scripted: true } });
});
fs.writeFileSync(new URL("./video.miraiclip.json", import.meta.url), JSON.stringify(project.toJSON(), null, 2) + "\n");
console.log("wrote sequence.html and video.miraiclip.json");
