// A 19 s film for an invented desktop assistant, "Nudge": the mascot, Pip, is the pointer. Landing on an icon is
// the click, a hop along the input row types a word, carrying a file overhead is the drag, and stamping a window's
// yellow light sends it home to the dock. The story is one prompt that asks for a button that does nothing; the
// button does nothing, and the window shakes its head anyway. The camera chases Pip, rises for the window
// overview, and the film ends with Pip leaping off the first icon.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
import { writeExample } from "../_lib/write-example.mjs";

const W = 1920, H = 1080, DURATION = 19;
const ICONS = [["chat", "#7c9cff"], ["term", "#2d3340"], ["web", "#4cc2ff"], ["notes", "#ffd166"], ["files", "#8fe3b0"]];
const ix = (i) => 585 + i * 150; // icon left
const icons = ICONS.map(([n, c], i) => `<i class="ico" id="i${n}" style="left:${ix(i)}px;background:${c}"></i>`).join("");
const ghosts = ["term", "web"].map((n) => { const i = ICONS.findIndex(([k]) => k === n); return `<i class="abs ghost" id="g${n}" style="left:${ix(i)}px;top:905px;width:120px;height:120px;border-radius:30px;background:${ICONS[i][1]}"></i>`; }).join("");

const css = `
*{box-sizing:border-box;margin:0}
.stage{background:linear-gradient(160deg,#ffd9b8,#c9b8ff 55%,#8fc6ff);color:#1c1b22;font-family:Inter,"DejaVu Sans",system-ui,sans-serif;overflow:hidden}
.world{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
.abs{position:absolute}
.dock{position:absolute;left:560px;top:880px;width:800px;height:170px;border-radius:44px;background:rgba(255,255,255,.45);border:2px solid rgba(255,255,255,.7)}
.ico{position:absolute;top:905px;width:120px;height:120px;border-radius:30px;z-index:4}
.ghost{z-index:6}
.win{position:absolute;border-radius:30px;background:rgba(255,255,255,.82);border:2px solid #fff;box-shadow:0 40px 90px rgba(60,40,120,.28);z-index:5;overflow:hidden}
.bar{position:absolute;left:0;top:0;right:0;height:56px;background:rgba(255,255,255,.7)}
.lt{position:absolute;top:20px;width:18px;height:18px;border-radius:50%}
#winT{left:180px;top:130px;width:1000px;height:600px}
#winW{left:980px;top:180px;width:760px;height:520px}
.inp{position:absolute;left:40px;top:130px;width:920px;height:84px;border-radius:22px;background:#eef0f6;display:flex;align-items:center;gap:22px;padding:0 30px;font-size:46px;font-weight:600}
#send{position:absolute;left:860px;top:140px;width:84px;height:64px;border-radius:18px;background:#7c9cff;z-index:2}
.lines{position:absolute;left:40px;top:260px;font-size:38px;line-height:1.6;color:#3a3a48}
#verbs{position:absolute;left:100px;top:262px;font-size:40px;font-weight:700;color:#7c9cff}
#verbs b{position:absolute;left:0;top:0;white-space:nowrap}
#spin{position:absolute;left:40px;top:268px;width:40px;height:40px;border-radius:50%;border:6px solid #cfd6f5;border-top-color:#7c9cff}
#file{position:absolute;left:0;top:0;width:70px;height:90px;border-radius:12px;background:#fff;border:4px solid #4cc2ff;z-index:11}
#btn{position:absolute;left:200px;top:235px;width:360px;height:110px;border-radius:55px;background:#ff8a3d;color:#fff;font-size:44px;font-weight:800;display:flex;align-items:center;justify-content:center}
#banner{position:absolute;left:${(W - 640) / 2}px;top:40px;width:640px;height:96px;border-radius:48px;background:rgba(255,255,255,.9);border:2px solid #fff;box-shadow:0 20px 50px rgba(60,40,120,.25);display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:700;z-index:12}
#pip{position:absolute;left:0;top:0;width:110px;height:100px;border-radius:50% 50% 38% 38%;background:#ff8a3d;z-index:10;transform-origin:50% 100%}
.eye{position:absolute;top:30px;width:26px;height:30px;border-radius:50%;background:#fff;overflow:hidden}
.eye i{position:absolute;left:8px;top:8px;width:12px;height:14px;border-radius:50%;background:#1c1b22}
#e1{left:24px}#e2{left:60px}
#end{position:absolute;left:0;width:${W}px;top:360px;text-align:center;font:800 120px "DejaVu Sans Mono",ui-monospace,monospace;color:#1c1b22}
`;
const markup = `<div class="world">
<div class="dock"></div>${icons}${ghosts}
<div class="win" id="winT"><div class="bar"><i class="lt" style="left:28px;background:#ff5f57"></i><i class="lt" style="left:58px;background:#febc2e"></i><i class="lt" style="left:88px;background:#28c840"></i></div>
<div class="inp"><span id="w1">make</span><span id="w2">a button</span><span id="w3">that does</span><span id="w4">nothing</span></div><i id="send"></i>
<i id="spin"></i><div id="verbs"><b id="v1">Thinking…</b><b id="v2">Plotting…</b><b id="v3">Building…</b></div>
<div class="lines"><div id="l1">Write(nothing.html)</div><div id="l2">Done. It has one button.</div></div></div>
<div class="win" id="winW"><div class="bar"><i class="lt" style="left:28px;background:#ff5f57"></i><i class="lt" style="left:58px;background:#febc2e"></i><i class="lt" style="left:88px;background:#28c840"></i></div><div id="btn">Do nothing</div></div>
<div id="banner">Did nothing. ✓</div>
<i id="file"></i>
<div id="pip"><div class="eye" id="e1"><i></i></div><div class="eye" id="e2"><i></i></div></div>
<p id="end">&gt; pip did nothing.</p></div>`;

const script = `
const P = (v) => S.w(v / 19.2), Q = (v) => S.h(v / 10.8);
let cx = 645, cy = -200;
const hopTo = (x, y, t, d, h) => {
  tl.to("#pip", { x: P(x - 55), duration: d, ease: "sine.inOut" }, t)
    .to("#pip", { y: [Q(cy - 50), Q(Math.min(cy, y) - 50 - h), Q(y - 50)], duration: d, ease: "none" }, t)
    .to("#pip", { scaleY: 0.8, scaleX: 1.12, duration: 0.07, ease: "power2.out" }, t + d)
    .to("#pip", { scaleY: 1, scaleX: 1, duration: 0.22, ease: "expo.out" }, t + d + 0.07)
    .hit("land@" + t, t + d, { kind: "land" });
  cx = x; cy = y;
};
const ripple = (t) => tl.to(".ico", { y: -Q(14), duration: 0.14, stagger: { each: 0.06, from: "center" }, ease: "power2.out" }, t).to(".ico", { y: 0, duration: 0.3, stagger: { each: 0.06, from: "center" }, ease: "expo.out" }, t + 0.14);
const iconCx = (i) => 585 + i * 150 + 60;
tl.set("#pip", { x: P(iconCx(0) - 55), y: Q(-200) }, 0)
  .set("#file", { opacity: 0 }, 0).set("#send", { opacity: 1 }, 0)
  .set("#w1,#w2,#w3,#w4,#v2,#v3,#l1,#l2,#spin,#end", { opacity: 0 }, 0)
  .set("#v1", { opacity: 0 }, 0)
  .camera({ zoom: 1.0, duration: 0.01 }, 0);

// 1. the fall, the dock's ripple, the run
tl.label("fall", 0)
  .to("#pip", { y: Q(855 - 50), duration: 0.5, ease: "power2.in" }, 0.1);
cy = 855;
tl.to("#pip", { scaleY: 0.8, scaleX: 1.12, duration: 0.07 }, 0.6).to("#pip", { scaleY: 1, scaleX: 1, duration: 0.25, ease: "expo.out" }, 0.67).hit("drop", 0.6, { kind: "impact" });
ripple(0.6);
tl.label("run", 1.2).camera({ zoom: 1.35, duration: 0.9, ease: "inOut(3)" }, "run").follow("#pip", { lead: 0.12, from: 1.2, to: 3.2 }, 0);
hopTo(iconCx(1), 855, 1.2, 0.4, 40); hopTo(iconCx(2), 855, 1.6, 0.4, 40); hopTo(iconCx(3), 855, 2.0, 0.4, 40);
hopTo(iconCx(1), 855, 2.4, 0.5, 70);
tl.to("#iterm", { y: [0, -Q(50), 0, -Q(24), 0], duration: 0.8, ease: "none" }, 2.9)
  .to("#pip", { y: [Q(805), Q(755), Q(805), Q(781), Q(805)], duration: 0.8, ease: "none" }, 2.9)
  .hit("bounce", 3.3, { kind: "impact" });

// 2. the window pops out of the icon
tl.label("window", 3.4).camera({ zoom: 1.0, duration: 1.0, ease: "inOut(3)" }, "window")
  .hit("pop", "window", { kind: "whoosh", pan: -0.3 })
  .morph("#gterm", "#winT", { duration: 0.8, ease: "inOut(3)" }, "window");

// 3. four hops type the prompt, a stamp sends it
tl.label("type", 4.4);
const words = ["#w1", "#w2", "#w3", "#w4"], xs = [330, 500, 690, 880];
hopTo(xs[0], 215, 4.0, 0.4, 150);
for (let i = 1; i < 4; i++) hopTo(xs[i], 215, 4.4 + (i - 1) * 0.3, 0.3, 50);
words.forEach((w, i) => tl.set(w, { opacity: 1 }, 4.4 + i * 0.3 + (i === 0 ? -0.35 : 0)));
hopTo(1100, 205, 5.6, 0.3, 60);
tl.label("send", 5.9).press("#send", 5.9).set("#w1,#w2,#w3,#w4", { opacity: 1 }, 5.9);

// 4. the spinner, three verbs, the reply
tl.label("think", 6.1)
  .set("#spin", { opacity: 1 }, 6.1).set("#v1", { opacity: 1 }, 6.1)
  .to("#spin", { rotate: 720, duration: 1.4, ease: "none" }, 6.1)
  .set("#v1", { opacity: 0 }, 6.5).set("#v2", { opacity: 1 }, 6.5)
  .set("#v2", { opacity: 0 }, 6.9).set("#v3", { opacity: 1 }, 6.9);
hopTo(1000, 205, 6.4, 0.3, 40); hopTo(1060, 205, 6.8, 0.3, 40);
tl.set("#spin,#v3", { opacity: 0 }, 7.4)
  .from("#l1", { opacity: 0, y: Q(10), duration: 0.5, ease: "expo.out" }, 7.4)
  .from("#l2", { opacity: 0, y: Q(10), duration: 0.5, ease: "expo.out" }, 7.8);

// 5. a file is stamped out and carried overhead to the web icon
tl.label("file", 8.3);
tl.set("#file", { opacity: 1, x: P(1100 - 35), y: Q(205 - 150) }, 8.3)
  .from("#file", { scale: 0, duration: 0.3, ease: "back.out" }, 8.3)
  .to("#file", { x: P(iconCx(2) - 35), duration: 1.3, ease: "sine.inOut" }, 8.7)
  .to("#file", { y: [Q(55), Q(205 - 150 - 110), Q(855 - 150)], duration: 1.3, ease: "none" }, 8.7);
hopTo(iconCx(2), 855, 8.7, 1.3, 180);
tl.to("#file", { y: Q(930), scale: 0.3, opacity: 0, duration: 0.3, ease: "power2.in" }, 10.05);
ripple(10.1);
tl.label("web", 10.2).hit("web", "web", { kind: "whoosh", pan: 0.3 })
  .morph("#gweb", "#winW", { duration: 0.8, ease: "inOut(3)" }, "web");

// 6. the leap onto the button, the shake, the banner, a look and a blink
tl.label("leap", 10.9);
hopTo(1360, 365, 10.9, 0.8, 240);
tl.press("#btn", 11.8)
  .label("no", 11.9)
  .to("#winW", { x: [0, -P(26), P(26), -P(18), P(18), -P(8), 0], duration: 0.7, ease: "none" }, "no")
  .from("#banner", { y: -Q(160), duration: 0.5, ease: "expo.out" }, 12.5)
  .to("#e1 i,#e2 i", { x: -P(6), duration: 0.2 }, 13.1).to("#e1 i,#e2 i", { x: P(6), duration: 0.3 }, 13.4).to("#e1 i,#e2 i", { x: 0, duration: 0.2 }, 13.8)
  .to(".eye", { scaleY: 0.1, duration: 0.08 }, 14.0).to(".eye", { scaleY: 1, duration: 0.12 }, 14.1);

// 7. the overview: the camera rises, each window is stamped away into the dock
tl.label("over", 14.4)
  .to("#banner", { opacity: 0, duration: 0.4 }, "over")
  .camera({ zoom: 0.62, duration: 1.0, ease: "inOut(3)" }, "over")
  .hit("rise", "over", { kind: "whoosh", pan: 0 });
hopTo(1038, 145, 14.9, 0.6, 140);
tl.label("stamp1", 15.5)
  .to("#winW", { scale: 0.02, x: P(945 - 1360), y: Q(965 - 440), duration: 0.5, ease: "inOut(3)" }, "stamp1")
  .set("#winW", { clipPath: "inset(50%)" }, "stamp1+=0.5")
  .hit("s1", "stamp1", { kind: "click" });
hopTo(238, 105, 16.0, 0.6, 160);
tl.label("stamp2", 16.6)
  .to("#winT", { scale: 0.02, x: P(765 - 680), y: Q(965 - 430), duration: 0.5, ease: "inOut(3)" }, "stamp2")
  .set("#winT", { clipPath: "inset(50%)" }, "stamp2+=0.5")
  .hit("s2", "stamp2", { kind: "click" })
  .camera({ zoom: 1, duration: 0.9, ease: "inOut(3)" }, 16.6);
hopTo(iconCx(1), 855, 16.6, 0.5, 60);
ripple(17.1);

// 8. home, the end line types itself, the leap that closes the loop
tl.label("home", 17.4);
hopTo(iconCx(0), 855, 17.4, 0.5, 60);
tl.from("#end", { opacity: 0, duration: 0.01 }, 17.9).set("#end", { opacity: 1 }, 17.9)
  .from("#end", { y: Q(6), duration: 0.6, ease: "expo.out" }, 17.9)
  .label("leapoff", 18.4).hit("up", "leapoff", { kind: "whoosh", pan: 0 })
  .to("#pip", { y: [Q(805), Q(330), Q(150)], duration: 0.6, ease: "power2.out" }, "leapoff")
  .handheld({ amount: S.min(0.12) }, 0, ${DURATION});
`;
const html = `<div class="stage" data-libs="stage" data-duration="${DURATION}" data-stage-version="2" style="width:${W}px;height:${H}px"><style>${css}</style>${markup}</div>\n<script>stage.build((tl, S) => {${script}});</script>`;
writeExample(import.meta.url, { html, duration: DURATION, id: "nudge" });
