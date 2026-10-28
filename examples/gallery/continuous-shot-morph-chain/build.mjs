// A 14 s film for an invented music app, "Lumen": one pill is the only thing that ever moves. It becomes a
// now-playing card, the card becomes a wide playlist panel, the panel becomes a round play button, and an iris
// opens from the button on the closing title. A chain of tl.morph hand-overs and nothing else cuts.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
import { writeExample } from "../_lib/write-example.mjs";

const W = 1920, H = 1080, DURATION = 14;
const css = `
*{box-sizing:border-box;margin:0}
.stage{background:#0e1320;color:#f3f6ff;font-family:Inter,"DejaVu Sans",system-ui,sans-serif;overflow:hidden}
.world{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
.title{position:absolute;left:0;width:${W}px;top:120px;text-align:center;font-size:72px;font-weight:800;letter-spacing:-.02em}
.abs{position:absolute;overflow:hidden}
#pill{left:${(W - 260) / 2}px;top:${(H - 90) / 2}px;width:260px;height:90px;border-radius:45px;background:#7c9cff;color:#0e1320;font-size:36px;font-weight:800;display:flex;align-items:center;justify-content:center}
#card{left:${(W - 760) / 2}px;top:${(H - 460) / 2}px;width:760px;height:460px;border-radius:44px;background:#1d2646;border:3px solid #7c9cff;padding:56px}
#card h2{white-space:nowrap;font-size:84px;font-weight:800;letter-spacing:-.02em}
#card p{font-size:36px;color:#b9c6ff;margin-top:14px}
#card .art{position:absolute;right:56px;bottom:56px;width:160px;height:160px;border-radius:28px;background:linear-gradient(135deg,#7c9cff,#c28bff)}
#panel{left:${(W - 1360) / 2}px;top:${(H - 560) / 2}px;width:1360px;height:560px;border-radius:36px;background:#18203a;border:3px solid #c28bff;padding:48px}
.tr{white-space:nowrap;font-size:46px;font-weight:600;padding:22px 0;border-bottom:2px solid #2c3764;display:flex;justify-content:space-between}
.tr em{font-style:normal;color:#b9c6ff}
#btn{left:${(W - 240) / 2}px;top:${(H - 240) / 2}px;width:240px;height:240px;border-radius:50%;background:#c28bff;display:flex;align-items:center;justify-content:center}
#btn i{width:0;height:0;border-left:70px solid #0e1320;border-top:44px solid transparent;border-bottom:44px solid transparent;margin-left:20px}
#end{position:absolute;inset:0;background:#7c9cff;color:#0e1320;display:flex;align-items:center;justify-content:center;font-size:150px;font-weight:800;letter-spacing:-.03em}
`;
const markup = `<div class="world"><p class="title">One thing, many shapes.</p>
<div class="abs" id="pill">Play</div>
<div class="abs" id="card"><h2>Night Drive</h2><p>Lumen · 3:42</p><i class="art"></i></div>
<div class="abs" id="panel"><div class="tr"><span>Night Drive</span><em>3:42</em></div><div class="tr"><span>Glass Hours</span><em>4:05</em></div><div class="tr"><span>Low Tide</span><em>2:58</em></div></div>
<div class="abs" id="btn"><i></i></div>
<div id="end">Press play.</div></div>`;

const script = `
tl.set("#card,#panel,#btn", { opacity: 0 }, 0)
  .label("pill", 0)
  .from(".title", { y: S.h(4), opacity: 0, duration: 0.8, ease: "expo.out" }, 0.2)
  .from("#pill", { scale: 0.4, opacity: 0, duration: 0.6, ease: "back.out" }, 0.3)
  .camera({ zoom: 1.05, duration: 2.6, ease: "sine.inOut" }, 0)
  .label("card", 1.9)
  .morph("#pill", "#card", { duration: 1.2, ease: "inOut(3)" }, "card")
  .label("panel", 5.0)
  .hit("m2", "panel", { kind: "whoosh", pan: -0.2 })
  .morph("#card", "#panel", { duration: 1.2, ease: "inOut(3)" }, "panel")
  .label("btn", 9.0)
  .hit("m3", "btn", { kind: "whoosh", pan: 0.2 })
  .morph("#panel", "#btn", { duration: 1.2, ease: "inOut(3)" }, "btn")
  .label("end", 11.4)
  .press("#btn", 11.4)
  .iris("#end", { from: "#btn", duration: 1.1, ease: "inOut(3)" }, "end+=0.2")
  .hit("end", "end+=1.3", { kind: "land" })
  .handheld({ amount: S.min(0.18) }, 0, ${DURATION});
`;
const html = `<div class="stage" data-libs="stage" data-duration="${DURATION}" data-stage-version="2" style="width:${W}px;height:${H}px"><style>${css}</style>${markup}</div>\n<script>stage.build((tl, S) => {${script}});</script>`;
writeExample(import.meta.url, { html, duration: DURATION, id: "lumen" });
