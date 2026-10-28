// A 14 s film for an invented team app, "Huddle": five avatars hop from a bench into their slots one after
// another, six task chips fly into an inbox, and the whole board lifts away on one camera whip. Carries every
// beat with hop, impact and gather, and puts a hit on every landing so sound can follow.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
import { writeExample } from "../_lib/write-example.mjs";

const W = 1920, H = 1080, DURATION = 14;
const names = ["Ana", "Ben", "Chi", "Dev", "Eli"];
const hues = [8, 45, 150, 205, 285];
const slotX = (i) => 230 + i * 300;
const slots = names.map((_, i) => `<div class="slot" id="slot${i}" style="left:${slotX(i)}px"></div>`).join("");
const pegs = names.map((n, i) => `<div class="peg" id="peg${i}" style="left:${slotX(i) + 10}px;--h:${hues[i]}">${n[0]}</div>`).join("");
const chips = [0, 1, 2, 3, 4, 5].map((i) => `<div class="chip" style="left:${180 + i * 120}px;top:${565 + (i % 2) * 80}px">Task ${i + 1}</div>`).join("");

const css = `
*{box-sizing:border-box;margin:0}
.stage{background:#14101f;color:#f4effc;font-family:Inter,"DejaVu Sans",system-ui,sans-serif;overflow:hidden}
.world{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
.title{position:absolute;left:0;width:${W}px;top:90px;text-align:center;font-size:70px;font-weight:800;letter-spacing:-.02em}
.slot{position:absolute;top:220px;width:260px;height:260px;border-radius:50%;border:5px dashed #5b4f7d}
.peg{position:absolute;top:800px;width:240px;height:240px;border-radius:50%;background:hsl(var(--h) 70% 55%);color:#14101f;font-size:120px;font-weight:800;display:flex;align-items:center;justify-content:center}
.bench{position:absolute;left:150px;top:1010px;width:1620px;height:14px;border-radius:7px;background:#2a2340}
#inbox{position:absolute;left:1380px;top:520px;width:400px;height:230px;border-radius:30px;background:#2a2340;border:4px solid #b49bff;display:flex;align-items:flex-start;justify-content:center;padding-top:20px;font-size:34px;letter-spacing:.2em;color:#b49bff;font-weight:700}
.chip{position:absolute;width:150px;height:60px;border-radius:30px;background:#b49bff;color:#14101f;font-size:26px;font-weight:700;display:flex;align-items:center;justify-content:center}
`;
const markup = `<div class="world"><p class="title">Everyone has a seat.</p>${slots}<i class="bench"></i>${pegs}<div id="inbox">INBOX</div>${chips}</div>`;

const script = `
tl.label("open", 0)
  .from(".title", { y: S.h(4), opacity: 0, duration: 0.8, ease: "expo.out" }, 0.2)
  .from(".peg", { y: S.h(12), opacity: 0, duration: 0.6, stagger: 0.1, ease: "expo.out" }, 0.3)
  .from(".slot", { scale: 0.6, opacity: 0, duration: 0.6, stagger: 0.08, ease: "back.out" }, 0.4)
  .camera({ zoom: 1.04, duration: 3, ease: "sine.inOut" }, 0);
for (let i = 0; i < ${names.length}; i++) {
  const t = 1.6 + i * 0.85;
  tl.label("hop" + i, t)
    .hop("#peg" + i, { to: "#slot" + i, height: S.h(16), duration: 0.8, squash: 0.2 }, "hop" + i)
    .hit("land" + i, "hop" + i + "+=0.8", { kind: "land", pan: -0.6 + i * 0.3 });
}
tl.label("flush", 6.4)
  .gather(".chip", { into: "#inbox", arc: 0.3, stagger: 0.07, duration: 1.0, spin: 0.2 }, "flush")
  .impact("#inbox", "flush+=1.4", { squash: 0.12 })
  .label("lift", 9.4)
  .hit("lift", "lift", { kind: "whoosh", pan: 0.3 })
  .whip("#inbox", { duration: 0.9 }, "lift")
  .camera({ zoom: 1.6, duration: 2.2, ease: "inOut(3)" }, "lift+=1")
  .handheld({ amount: S.min(0.2) }, 0, ${DURATION});
`;
const html = `<div class="stage" data-libs="stage" data-duration="${DURATION}" data-stage-version="2" style="width:${W}px;height:${H}px"><style>${css}</style>${markup}</div>\n<script>stage.build((tl, S) => {${script}});</script>`;
writeExample(import.meta.url, { html, duration: DURATION, id: "huddle" });
