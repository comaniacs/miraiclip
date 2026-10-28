// A 14 s route film for an invented trip planner, "Wayfinder": four stops sit along one long line, and the
// camera whips from stop to stop, then pulls back to show the whole route. Nothing cuts: the line is the
// thing that survives every beat.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
import { writeExample } from "../_lib/write-example.mjs";

const W = 1920, H = 1080, DURATION = 14;
const stops = [
  { n: "01", name: "Lisbon", note: "Arrive, tram 28 to the old town", hue: 18 },
  { n: "02", name: "Porto", note: "Two hours north by train", hue: 200 },
  { n: "03", name: "Douro", note: "A river valley of terraced vineyards", hue: 140 },
  { n: "04", name: "Braga", note: "Last night: stairs, lights, dinner", hue: 285 },
];
const cell = (s, i) => `<section class="stop" id="s${i + 1}" style="left:${i * W}px;--h:${s.hue}">
  <div class="hero" id="h${i + 1}"><p class="num">${s.n}</p><h2>${s.name}</h2><p class="note">${s.note}</p></div>
</section>`;

const css = `
*{box-sizing:border-box;margin:0}
.stage{background:#0b0e14;color:#f3efe6;font-family:Inter,"DejaVu Sans",system-ui,sans-serif;overflow:hidden}
.world{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
#route{position:absolute;left:0;top:${H / 2 - 5}px;width:${W * stops.length}px;height:10px;background:linear-gradient(90deg,#f3efe6 0 100%);opacity:.35}
.stop{position:absolute;top:0;width:${W}px;height:${H}px}
.hero{position:absolute;left:${(W - 760) / 2}px;top:${(H - 440) / 2}px;width:760px;height:440px;border-radius:36px;padding:56px;background:hsl(var(--h) 45% 20%);border:3px solid hsl(var(--h) 80% 62%);box-shadow:0 30px 80px hsl(var(--h) 80% 10% / .6)}
.num{font-size:34px;letter-spacing:.3em;color:hsl(var(--h) 90% 70%);font-weight:700}
h2{font-size:150px;font-weight:800;letter-spacing:-.03em;margin-top:10px}
.note{font-size:36px;margin-top:18px;color:#dcd6c8}
.pin{position:absolute;top:${H / 2 - 22}px;width:44px;height:44px;border-radius:50%;background:#f3efe6;border:8px solid #0b0e14}
`;
const pins = stops.map((_, i) => `<i class="pin" id="pin${i + 1}" style="left:${i * W + W / 2 - 22}px"></i>`).join("");
const markup = `<div class="world"><i id="route"></i>${pins}${stops.map(cell).join("")}</div>`;

const script = `
tl.label("s1", 0)
  .from("#h1", { y: S.h(6), opacity: 0, duration: 0.8, ease: "expo.out" }, 0.2)
  .camera({ zoom: 1.06, duration: 3, ease: "sine.inOut" }, 0)
  .label("s2", 2.4)
  .hit("w1", "s2", { kind: "whoosh", pan: -0.4 })
  .whip("#h2", { duration: 0.9 }, "s2")
  .from("#h2", { scale: 0.92, opacity: 0.2, duration: 0.7, ease: "expo.out" }, "s2+=0.3")
  .label("s3", 6.4)
  .hit("w2", "s3", { kind: "whoosh", pan: 0 })
  .whip("#h3", { duration: 0.9 }, "s3")
  .from("#h3", { scale: 0.92, opacity: 0.2, duration: 0.7, ease: "expo.out" }, "s3+=0.3")
  .label("s4", 8.4)
  .hit("w3", "s4", { kind: "whoosh", pan: 0.4 })
  .whip("#h4", { duration: 0.9 }, "s4")
  .from("#h4", { scale: 0.92, opacity: 0.2, duration: 0.7, ease: "expo.out" }, "s4+=0.3")
  .label("route", 11.9)
  .hit("out", "route", { kind: "land" })
  .camera({ anchor: "#route", at: [50, 50], zoom: ${(1 / 4).toFixed(3)} * 1.02, duration: 2, ease: "inOut(3)" }, "route")
  .handheld({ amount: S.min(0.2) }, 0, ${DURATION});
`;
const html = `<div class="stage" data-libs="stage" data-duration="${DURATION}" data-stage-version="2" style="width:${W}px;height:${H}px"><style>${css}</style>${markup}</div>\n<script>stage.build((tl, S) => {${script}});</script>`;
writeExample(import.meta.url, { html, duration: DURATION, id: "route" });
