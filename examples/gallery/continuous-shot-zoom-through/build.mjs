// A 14 s film for an invented analytics tool, "Tidepool": a laptop sits on a desk, the camera pushes into its
// screen until the dashboard inside takes over the frame, the panels fill in, a click ships the report, and an
// iris opens on the confirmation. Uses zoomThrough with `into` for the hand-over.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
import { writeExample } from "../_lib/write-example.mjs";

const W = 1920, H = 1080, DURATION = 14;
const css = `
*{box-sizing:border-box;margin:0}
.stage{background:#10151f;color:#eef2f7;font-family:Inter,"DejaVu Sans",system-ui,sans-serif;overflow:hidden}
.world{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
.title{position:absolute;left:0;width:${W}px;top:110px;text-align:center;font-size:72px;font-weight:800;letter-spacing:-.02em}
.desk{position:absolute;left:0;top:760px;width:${W}px;height:320px;background:#1a2230}
#lap{position:absolute;left:${(W - 760) / 2}px;top:330px;width:760px;height:430px;border-radius:26px;background:#2a3446;padding:22px}
#screen{position:absolute;inset:22px;border-radius:12px;background:#0d2a35;overflow:hidden}
#screen i{position:absolute;left:40px;top:50px;height:18px;border-radius:9px;background:#3fb8c9;opacity:.8}
.base{position:absolute;left:${(W - 920) / 2}px;top:760px;width:920px;height:26px;border-radius:0 0 26px 26px;background:#3a455b}
#roomB{position:absolute;inset:0;opacity:0;background:#0d2a35}
.top{position:absolute;left:120px;top:70px;font-size:44px;font-weight:800;color:#8fe3f0}
.card{position:absolute;top:210px;width:520px;height:360px;border-radius:28px;background:#14394a;border:3px solid #3fb8c9;padding:36px}
.card h3{font-size:30px;letter-spacing:.2em;color:#8fe3f0}
.card p{font-size:96px;font-weight:800;margin-top:20px}
.bar{position:absolute;left:36px;bottom:40px;height:22px;border-radius:11px;background:#3fb8c9;transform-origin:0 50%}
#c1{left:120px}#c2{left:700px}#c3{left:1280px}
#ship{position:absolute;left:${(W - 520) / 2}px;top:700px;width:520px;height:130px;border-radius:65px;background:#ffd166;color:#10151f;font-size:48px;font-weight:800;display:flex;align-items:center;justify-content:center}
#done{position:absolute;inset:0;background:#ffd166;color:#10151f;display:flex;align-items:center;justify-content:center;font-size:140px;font-weight:800;letter-spacing:-.03em}
`;
const markup = `<div class="world"><p class="title">One screen, all your tides.</p><div class="desk"></div>
<div id="lap"><div id="screen"><i style="width:340px"></i><i style="width:220px;top:100px"></i><i style="width:420px;top:150px"></i></div></div><div class="base"></div></div>
<div id="roomB"><p class="top">Tidepool</p>
<div class="card" id="c1"><h3>VISITS</h3><p>48.2k</p><i class="bar" style="width:380px"></i></div>
<div class="card" id="c2"><h3>SIGN-UPS</h3><p>3,910</p><i class="bar" style="width:290px"></i></div>
<div class="card" id="c3"><h3>RETAINED</h3><p>71%</p><i class="bar" style="width:330px"></i></div>
<div id="ship">Ship report</div><div id="done">Sent.</div></div>`;

const script = `
tl.label("desk", 0)
  .from(".title", { y: S.h(4), opacity: 0, duration: 0.8, ease: "expo.out" }, 0.2)
  .from("#lap", { y: S.h(10), opacity: 0, duration: 0.9, ease: "expo.out" }, 0.4)
  .camera({ zoom: 1.08, duration: 2.2, ease: "sine.inOut" }, 0)
  .label("push", 2.2)
  .hit("push", "push", { kind: "whoosh", pan: -0.2 })
  .zoomThrough("#screen", { fit: "cover", into: "#roomB", duration: 2.4, ease: "inOut(3)" }, "push")
  .label("fill", 4.6)
  .from("#c1", { y: S.h(6), opacity: 0, duration: 0.6, ease: "expo.out" }, "fill+=0.3")
  .from("#c2", { y: S.h(6), opacity: 0, duration: 0.6, ease: "expo.out" }, "fill+=0.65")
  .from("#c3", { y: S.h(6), opacity: 0, duration: 0.6, ease: "expo.out" }, "fill+=1.0")
  .from(".bar", { scaleX: 0, duration: 0.9, stagger: 0.15, ease: "expo.out" }, "fill+=0.8")
  .from("#ship", { y: S.h(8), opacity: 0, duration: 0.6, ease: "expo.out" }, "fill+=2.1")
  .pointer({ path: [{ t: 0, x: S.w(104), y: S.h(96) }, { t: 8.2, x: S.w(80), y: S.h(86) }, { t: 9.4, x: S.w(50), y: S.h(76) }, { t: 10.6, x: S.w(50), y: S.h(76) }, { t: 11.4, x: S.w(104), y: S.h(98) }], clicks: [10.1] })
  .label("ship", 10.1)
  .press("#ship", 10.1)
  .label("sent", 10.3)
  .iris("#done", { from: "#ship", duration: 1.1, ease: "inOut(3)" }, "sent")
  .hit("sent", "sent+=1.1", { kind: "land" });
`;
const html = `<div class="stage" data-libs="stage" data-duration="${DURATION}" data-stage-version="2" style="width:${W}px;height:${H}px"><style>${css}</style>${markup}</div>\n<script>stage.build((tl, S) => {${script}});</script>`;
writeExample(import.meta.url, { html, duration: DURATION, id: "push" });
