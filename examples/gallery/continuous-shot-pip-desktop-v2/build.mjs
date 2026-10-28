// Pip v2: the same 19 s film as continuous-shot-pip-desktop, rebuilt as a lit, tilted tabletop. The desktop is a
// slab-built plane seen at an angle from a low, close, always-moving camera; Pip is a real CSS box with a contact
// shadow that shrinks as it jumps; the dock, windows and icons have thickness; the type is big monospace; and the
// camera follows Pip, pushes in on every beat and rises once for the overview.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
import { writeExample } from "../_lib/write-example.mjs";

const W = 1920, H = 1080, DURATION = 19;

// --- geometry helpers: everything lies on the table plane (x right, y towards the camera, z up) ---
const slab = (id, x, y, w, h, r, depth, top, side, face = "", z0 = 0, cls = "") => {
  const n = Math.max(2, Math.round(depth / 3));
  let layers = "";
  for (let k = 0; k < n; k++) layers += `<i class="ly" style="transform:translateZ(${z0 + (k * depth) / n}px);border-radius:${r}px;background:${side}"></i>`;
  return `<div class="slab ${cls}" id="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${layers}<div class="tp" style="transform:translateZ(${z0 + depth}px);border-radius:${r}px;background:${top}">${face}</div></div>`;
};
// a box standing on the plane: top, front (towards camera), left, right
const box = (w, d, h, c) => `<div class="bx" style="width:${w}px;height:${d}px">
  <div class="f top" style="width:${w}px;height:${d}px;transform:translateZ(${h}px);background:${c.top}"></div>
  <div class="f front" style="left:0;top:${d}px;width:${w}px;height:${h}px;transform-origin:0 0;transform:rotateX(90deg);background:${c.front}"><i class="eye" id="e1"><b></b></i><i class="eye" id="e2"><b></b></i></div>
  <div class="f side" style="left:0;top:0;width:${h}px;height:${d}px;transform-origin:0 0;transform:rotateY(-90deg);background:${c.side}"></div>
  <div class="f side" style="left:${w}px;top:0;width:${h}px;height:${d}px;transform-origin:0 0;transform:rotateY(-90deg);background:${c.side}"></div></div>`;

const ICONS = [["chat", "#6f8dff", "#4d6be0", `<i class="g bubble"></i>`], ["term", "#2b2f3a", "#171a22", `<i class="g mono">&gt;_</i>`], ["web", "#47bfff", "#2a9be0", `<i class="g compass"></i>`], ["notes", "#ffd45f", "#e3b23a", `<i class="g lines"></i>`], ["files", "#82e0ac", "#4fbf84", `<i class="g folder"></i>`]];
const IX = (i) => 575 + i * 165, IY = 880, IS = 132;
const PLATE = { x: 530, y: 850, w: 860, h: 200 };
const icons = ICONS.map(([n, top, side, glyph], i) => slab("i" + n, IX(i), IY, IS, IS, 34, 22, `linear-gradient(160deg,${top},${side})`, side, glyph, 16, "ico")).join("");
const WT = { x: 190, y: 70, w: 1120, h: 600 }, WW = { x: 1040, y: 360, w: 760, h: 420 };
const lights = `<i class="lt" style="left:30px;background:#ff5f57"></i><i class="lt" style="left:64px;background:#febc2e"></i><i class="lt" style="left:98px;background:#28c840"></i>`;
const winT = slab("winT", WT.x, WT.y, WT.w, WT.h, 28, 14, "linear-gradient(180deg,#fbfaf7,#f1eeea)", "#cfc6bd", `<div class="bar">${lights}</div>
  <div class="row"><span id="prompt"><u>&gt;</u> <span id="w1">make</span> <span id="w2">a button</span> <span id="w3">that does</span> <span id="w4">nothing</span><s id="caret"></s></span></div>
  <div id="verbs"><b id="v1">+ Thinking…</b><b id="v2">+ Plotting…</b><b id="v3">+ Building…</b></div>
  <div class="lines"><div id="l1">Write(nothing.html)</div><div id="l2">Done. One button.</div></div>`, 0, "win");
const winW = slab("winW", WW.x, WW.y, WW.w, WW.h, 26, 14, "linear-gradient(180deg,#ffffff,#f3f1ee)", "#cfc6bd", `<div class="bar">${lights}</div><div id="btn">do nothing</div>`, 0, "win");

const css = `
*{box-sizing:border-box;margin:0}
.stage{background:linear-gradient(180deg,#e1e8f2 0%,#f1e6e0 38%,#f6d4bd 100%);color:#2a2630;font-family:Inter,"DejaVu Sans",system-ui,sans-serif;overflow:hidden}
.world{position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:1500px;perspective-origin:50% 38%}
.table{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-style:preserve-3d;transform-origin:50% 88%;transform:rotateX(58deg)}
.floor{position:absolute;left:-3600px;top:-3400px;width:9200px;height:8000px;background:linear-gradient(rgba(120,60,40,.07) 3px,transparent 3px) 0 0/200px 200px,linear-gradient(90deg,rgba(120,60,40,.07) 3px,transparent 3px) 0 0/200px 200px,linear-gradient(180deg,#e4e9f3 0%,#f3dccd 34%,#f7c9ab 62%,#f4b898 100%);transform:translateZ(-1px)}
.slab{position:absolute;transform-style:preserve-3d}
.ly,.tp{position:absolute;left:0;top:0;width:100%;height:100%}
.tp{box-shadow:inset 0 0 0 3px rgba(255,255,255,.55),inset 0 -6px 14px rgba(0,0,0,.06);overflow:hidden}
.plate .tp{background:linear-gradient(180deg,rgba(255,255,255,.75),rgba(255,236,224,.7))!important}
.bar{position:absolute;left:0;top:0;right:0;height:64px;background:rgba(236,232,226,.9)}
.lt{position:absolute;top:22px;width:22px;height:22px;border-radius:50%}
.row{position:absolute;left:44px;top:120px;width:1040px;font:500 50px "DejaVu Sans Mono",ui-monospace,monospace;color:#3d3a44;white-space:nowrap}
.row u{text-decoration:none;color:#c98c6c;margin-right:6px}
#caret{display:inline-block;width:26px;height:50px;background:#ff7a3d;vertical-align:-8px;margin-left:8px}
#verbs{position:absolute;left:44px;top:220px;font:500 46px "DejaVu Sans Mono",ui-monospace,monospace;color:#ff7a3d}
#verbs b{position:absolute;left:0;top:0;font-weight:500;white-space:nowrap}
.lines{position:absolute;left:44px;top:290px;font:500 46px/1.6 "DejaVu Sans Mono",ui-monospace,monospace;color:#6b6672}
#btn{position:absolute;left:200px;top:160px;width:360px;height:120px;border-radius:60px;background:linear-gradient(180deg,#5b86ff,#2f5be6);color:#fff;font:800 48px "DejaVu Sans Mono",ui-monospace,monospace;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 4px 0 rgba(255,255,255,.4),0 10px 0 #1c3fae}
.g{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.bubble{background:radial-gradient(ellipse 34% 28% at 50% 46%,#fff 0 98%,transparent 100%),linear-gradient(#fff,#fff) 38% 66%/14% 16% no-repeat;clip-path:none}
.mono{font:800 54px/132px "DejaVu Sans Mono",monospace;color:#f4f1ec;text-align:center;font-style:normal}
.compass{background:radial-gradient(circle at 50% 50%,transparent 0 30%,#fff 31% 38%,transparent 39%),conic-gradient(from 40deg at 50% 50%,#fff 0 9%,transparent 9% 50%,rgba(255,255,255,.6) 50% 59%,transparent 59%);-webkit-mask:radial-gradient(circle,#000 0 40%,transparent 41%);mask:radial-gradient(circle,#000 0 40%,transparent 41%)}
.lines{}
.g.lines{background:repeating-linear-gradient(180deg,transparent 0 26px,rgba(255,255,255,.85) 26px 34px);margin:22px 22px;width:calc(100% - 44px);height:calc(100% - 44px)}
.folder{background:linear-gradient(#fff,#fff) 26px 40px/80px 52px no-repeat}
#pip{position:absolute;left:0;top:0;width:110px;height:100px;transform-style:preserve-3d}
.pb{position:absolute;left:0;top:0;transform-style:preserve-3d;transform-origin:55px 50px 0;transform:scale3d(calc(1 + var(--sq,0)*0.14),calc(1 + var(--sq,0)*0.14),calc(1 - var(--sq,0)*0.26))}
.bx{position:absolute;left:0;top:0;transform-style:preserve-3d}
.f{position:absolute;border-radius:10px}
.eye{position:absolute;top:30px;width:20px;height:34px;border-radius:10px;background:#fff;overflow:hidden;font-style:normal}
.eye b{position:absolute;left:5px;top:10px;width:10px;height:16px;border-radius:5px;background:#211a1a}
#e1{left:24px}#e2{left:68px}
#sh{position:absolute;left:0;top:0;width:150px;height:110px;border-radius:50%;background:radial-gradient(closest-side,rgba(60,30,20,.55),rgba(60,30,20,0))}
#file{position:absolute;left:0;top:0;width:80px;height:104px;transform-style:preserve-3d}
#end{position:absolute;left:150px;top:110px;width:1500px;text-align:center;font:800 150px "DejaVu Sans Mono",ui-monospace,monospace;color:#3a2f33;transform:translateZ(1px);white-space:nowrap}
#banner{position:absolute;left:${(W - 760) / 2}px;top:60px;width:760px;height:110px;border-radius:55px;background:rgba(255,255,255,.92);border:2px solid #fff;box-shadow:0 24px 60px rgba(120,60,40,.3);display:flex;align-items:center;justify-content:center;font:700 44px Inter,"DejaVu Sans",sans-serif;z-index:20}
`;
const body = box(110, 100, 100, { top: "#ffa365", front: "#f07b3a", side: "#c75f27" });
const fileBox = `<div class="f top" style="width:80px;height:104px;background:#fff;border:5px solid #47bfff;transform:translateZ(0)"></div>`;
const markup = `<div class="world"><div class="table"><i class="floor"></i>
${slab("plate", PLATE.x, PLATE.y, PLATE.w, PLATE.h, 46, 14, "rgba(255,255,255,.7)", "#e3c8b8", "", 0, "plate")}${icons}
${winT}${winW}
<i id="sh"></i><div id="file">${fileBox}</div><div id="pip"><div class="pb">${body}</div></div>
<p id="end">&gt; pip did nothing.</p></div></div>
<div id="banner">Did nothing. ✓</div>`;

const script = `
const P = (v) => S.w(v / 19.2), Q = (v) => S.h(v / 10.8), Z = (v) => S.min(v / 10.8);
const iconCx = (i) => ${575 + 66} + i * 165, ICON_Y = ${IY + IS / 2}, ICON_TOP = 16 + 22 + 14 + 0;
const Z_ICON = 38, Z_WIN = 14, Z_BTN = 14;
let cx = iconCx(0), cy = ICON_Y, cz = Z_ICON;
// the character's footprint is 110 x 100 and its shadow 150 x 110, both centred on (cx, cy)
tl.set("#pip", { x: P(cx - 55), y: Q(cy - 50), z: Z(500) }, 0)
  .set("#sh", { x: P(cx - 75), y: Q(cy - 55), z: Z(Z_ICON + 0.5), opacity: 0 }, 0)
  .set("#file", { opacity: 0 }, 0)
  .set("#winT", { scale: 0.001 }, 0).set("#winW", { scale: 0.001 }, 0)
  .set("#w1,#w2,#w3,#w4,#v1,#v2,#v3,#l1,#l2,#caret", { opacity: 0 }, 0)
  .set("#end", { opacity: 0 }, 0).set("#banner", { opacity: 0 }, 0);
const land = (t, z) => tl.to("#pip", { "--sq": 1, duration: 0.07, ease: "power2.out" }, t).to("#pip", { "--sq": 0, duration: 0.3, ease: "expo.out" }, t + 0.07).hit("land@" + t.toFixed(2), t, { kind: "land" });
const hopTo = (x, y, z, t, d, h, surf) => {
  tl.to("#pip", { x: P(x - 55), y: Q(y - 50), duration: d, ease: "sine.inOut" }, t)
    .to("#pip", { z: [Z(cz), Z(Math.max(cz, z) + h), Z(z)], duration: d, ease: "none" }, t)
    .to("#sh", { x: P(x - 75), y: Q(y - 55), duration: d, ease: "sine.inOut" }, t)
    .to("#sh", { z: Z((surf ?? z) + 0.5), duration: d, ease: "none" }, t)
    .to("#sh", { opacity: [0.9, 0.35, 0.9], scale: [1, 0.55, 1], duration: d, ease: "none" }, t);
  land(t + d, z);
  cx = x; cy = y; cz = z;
};
const ripple = (t) => tl.to(".ico", { z: Z(26), duration: 0.14, stagger: { each: 0.06, from: "center" }, ease: "power2.out" }, t).to(".ico", { z: 0, duration: 0.34, stagger: { each: 0.06, from: "center" }, ease: "expo.out" }, t + 0.14);

// 1. the drop onto the first icon, the dock ripples
tl.label("fall", 0)
  .to("#pip", { z: Z(Z_ICON), duration: 0.5, ease: "power2.in" }, 0.1)
  .to("#sh", { opacity: [0, 0.9], scale: [0.3, 1], duration: 0.5, ease: "power2.in" }, 0.1);
land(0.6, Z_ICON); cz = Z_ICON;
ripple(0.6);
tl.hit("drop", 0.6, { kind: "impact" });

// 2. the run along the dock, stamping the terminal, which bounces twice with it riding
tl.label("run", 1.2);
hopTo(iconCx(1), ICON_Y, Z_ICON, 1.2, 0.4, 50); hopTo(iconCx(2), ICON_Y, Z_ICON, 1.6, 0.4, 50); hopTo(iconCx(3), ICON_Y, Z_ICON, 2.0, 0.4, 50);
hopTo(iconCx(1), ICON_Y, Z_ICON, 2.4, 0.5, 90);
tl.to("#iterm", { z: [0, Z(70), 0, Z(34), 0], duration: 0.8, ease: "none" }, 2.9)
  .to("#pip", { z: [Z(Z_ICON), Z(Z_ICON + 70), Z(Z_ICON), Z(Z_ICON + 34), Z(Z_ICON)], duration: 0.8, ease: "none" }, 2.9)
  .to("#sh", { opacity: [0.9, 0.4, 0.9, 0.6, 0.9], duration: 0.8, ease: "none" }, 2.9)
  .hit("bounce", 3.3, { kind: "impact" });

// 3. the window springs out of the icon and lands
const winC = (r) => [r.x + r.w / 2, r.y + r.h / 2];
tl.label("window", 3.4).hit("pop", "window", { kind: "whoosh", pan: -0.3 })
  .fromTo("#winT", { scale: 0.05, x: P(iconCx(1) - ${WT.x + WT.w / 2}), y: Q(ICON_Y - ${WT.y + WT.h / 2}) }, { scale: 1, x: 0, y: 0, duration: 0.8, ease: "back.out" }, "window");

// 4. four hops type the prompt, a stamp sends it
tl.label("type", 4.4);
const xs = [${WT.x + 130}, ${WT.x + 330}, ${WT.x + 640}, ${WT.x + 900}], ROW_Y = ${WT.y + 128};
hopTo(xs[0], ROW_Y, Z_WIN, 3.95, 0.45, 170, Z_WIN);
const words = ["#w1", "#w2", "#w3", "#w4"];
tl.set("#caret", { opacity: 1 }, 4.4);
words.forEach((w, i) => { if (i) hopTo(xs[i], ROW_Y, Z_WIN, 4.4 + (i - 1) * 0.3, 0.3, 60, Z_WIN); tl.set(w, { opacity: 1 }, 4.4 + i * 0.3 - (i === 0 ? 0.0 : 0)); });
hopTo(${WT.x + WT.w - 80}, ROW_Y, Z_WIN, 5.6, 0.3, 70, Z_WIN);
tl.label("send", 5.9).set("#caret", { opacity: 0 }, 5.9);

// 5. the verbs and the reply
tl.label("think", 6.1)
  .set("#v1", { opacity: 1 }, 6.1).set("#v1", { opacity: 0 }, 6.5).set("#v2", { opacity: 1 }, 6.5)
  .set("#v2", { opacity: 0 }, 6.9).set("#v3", { opacity: 1 }, 6.9);
hopTo(${WT.x + WT.w - 160}, ROW_Y + 20, Z_WIN, 6.35, 0.3, 50, Z_WIN); hopTo(${WT.x + WT.w - 240}, ROW_Y + 20, Z_WIN, 6.8, 0.3, 50, Z_WIN);
tl.set("#v3", { opacity: 0 }, 7.4)
  .from("#l1", { opacity: 0, x: -P(24), duration: 0.5, ease: "expo.out" }, 7.4)
  .from("#l2", { opacity: 0, x: -P(24), duration: 0.5, ease: "expo.out" }, 7.8);

// 6. the file is stamped out of the window and carried overhead to the web icon
tl.label("file", 8.3);
const FX = ${WT.x + WT.w - 120}, FY = ${WT.y + 330};
tl.set("#file", { x: P(FX), y: Q(FY), z: Z(Z_WIN), opacity: 1 }, 8.3)
  .from("#file", { scale: 0.01, duration: 0.3, ease: "back.out" }, 8.3)
  .to("#file", { z: Z(Z_WIN + 150), duration: 0.35, ease: "expo.out" }, 8.4);
hopTo(FX + 40, FY - 30, Z_WIN, 8.4, 0.3, 40, Z_WIN);
tl.to("#file", { x: P(iconCx(2) - 40), y: Q(ICON_Y - 52), duration: 1.2, ease: "sine.inOut" }, 8.8)
  .to("#file", { z: [Z(Z_WIN + 150), Z(Z_WIN + 340), Z(Z_ICON + 130)], duration: 1.2, ease: "none" }, 8.8);
hopTo(iconCx(2), ICON_Y, Z_ICON, 8.8, 1.2, 200, Z_ICON);
tl.to("#file", { z: Z(Z_ICON + 4), scale: 0.3, duration: 0.3, ease: "power2.in" }, 10.05).set("#file", { opacity: 0 }, 10.4);
ripple(10.1);
tl.label("web", 10.2).hit("web", "web", { kind: "whoosh", pan: 0.3 })
  .fromTo("#winW", { scale: 0.05, x: P(iconCx(2) - ${WW.x + WW.w / 2}), y: Q(ICON_Y - ${WW.y + WW.h / 2}) }, { scale: 1, x: 0, y: 0, duration: 0.8, ease: "back.out" }, "web");

// 7. the leap onto the button, the shake, the banner, a look and a blink
tl.label("leap", 10.9);
const BX = ${WW.x + 380}, BY = ${WW.y + 190};
hopTo(BX, BY, Z_WIN + 10, 10.9, 0.8, 300, Z_WIN);
tl.to("#btn", { y: Q(8), duration: 0.12, ease: "power2.out" }, 11.7).to("#btn", { y: 0, duration: 0.35, ease: "expo.out" }, 11.82)
  .hit("press", 11.7, { kind: "click" })
  .label("no", 11.9)
  .to("#winW", { x: [0, -P(40), P(40), -P(28), P(28), -P(12), 0], duration: 0.7, ease: "none" }, "no")
  .to("#pip", { x: [P(BX - 55), P(BX - 55 - 40), P(BX - 55 + 40), P(BX - 55 - 28), P(BX - 55 + 28), P(BX - 55 - 12), P(BX - 55)], duration: 0.7, ease: "none" }, "no")
  .set("#banner", { opacity: 1 }, 12.5)
  .from("#banner", { y: -Q(180), duration: 0.5, ease: "expo.out" }, 12.5)
  .to("#e1 b,#e2 b", { x: -P(6), duration: 0.2 }, 13.1).to("#e1 b,#e2 b", { x: P(6), duration: 0.3 }, 13.4).to("#e1 b,#e2 b", { x: 0, duration: 0.2 }, 13.8)
  .to(".eye", { scaleY: 0.1, duration: 0.08 }, 14.0).to(".eye", { scaleY: 1, duration: 0.12 }, 14.1);

// 8. the overview: the camera rises, each window is stamped home into the dock
tl.label("over", 14.4)
  .to("#banner", { opacity: 0, duration: 0.4 }, "over")
  .hit("rise", "over", { kind: "whoosh", pan: 0 });
hopTo(${WW.x + 62}, ${WW.y + 34}, Z_WIN, 14.9, 0.6, 150, Z_WIN);
tl.label("stamp1", 15.5)
  .to("#winW", { scale: 0.001, x: P(iconCx(2) - ${WW.x + WW.w / 2}), y: Q(ICON_Y - ${WW.y + WW.h / 2}), duration: 0.5, ease: "inOut(3)" }, "stamp1")
  .hit("s1", "stamp1", { kind: "click" });
hopTo(${WT.x + 62}, ${WT.y + 34}, Z_WIN, 16.0, 0.6, 170, Z_WIN);
tl.label("stamp2", 16.6)
  .to("#winT", { scale: 0.001, x: P(iconCx(1) - ${WT.x + WT.w / 2}), y: Q(ICON_Y - ${WT.y + WT.h / 2}), duration: 0.5, ease: "inOut(3)" }, "stamp2")
  .hit("s2", "stamp2", { kind: "click" });
hopTo(iconCx(1), ICON_Y, Z_ICON, 16.6, 0.5, 70, Z_ICON);
ripple(17.1);

// 9. home, the end line, the leap
tl.label("home", 17.4);
hopTo(iconCx(0), ICON_Y, Z_ICON, 17.4, 0.5, 60, Z_ICON);
tl.set("#end", { opacity: 1 }, 17.9).from("#end", { x: -P(60), duration: 0.8, ease: "expo.out" }, 17.9)
  .label("leapoff", 18.4).hit("up", "leapoff", { kind: "whoosh", pan: 0 })
  .to("#pip", { z: [Z(Z_ICON), Z(Z_ICON + 260), Z(Z_ICON + 360)], duration: 0.6, ease: "power2.out" }, "leapoff")
  .to("#sh", { opacity: 0.2, scale: 0.4, duration: 0.6 }, "leapoff");

// the camera: close, always moving, following the character, rising for the overview
tl.camera({ zoom: 1.9, duration: 0.01 }, 0)
  .follow("#pip", { lead: 0.12, from: 0.2, to: 14.2 }, 0)
  .camera({ zoom: 1.6, rotate: -2.5, duration: 1.2, ease: "inOut(3)" }, 1.2)
  .camera({ zoom: 2.2, rotate: 1.5, duration: 1.4, ease: "inOut(3)" }, 3.4)
  .camera({ zoom: 2.4, rotate: -1.5, duration: 1.6, ease: "inOut(3)" }, 4.4)
  .camera({ zoom: 2.0, rotate: 2.0, duration: 1.6, ease: "inOut(3)" }, 6.3)
  .camera({ zoom: 1.6, rotate: -1.5, duration: 1.6, ease: "inOut(3)" }, 8.3)
  .camera({ zoom: 1.9, rotate: 1.0, duration: 1.0, ease: "inOut(3)" }, 10.7)
  .camera({ zoom: 2.3, rotate: -1.0, duration: 1.4, ease: "inOut(3)" }, 11.7)
  .camera({ zoom: 0.62, rotate: 0, x: 0, y: 0, duration: 1.1, ease: "inOut(3)" }, 14.4)
  .follow("#pip", { lead: 0.1, from: 16.5, to: 17.6 }, 0)
  .camera({ zoom: 1.7, rotate: 0, duration: 1.2, ease: "inOut(3)" }, 16.5)
  .camera({ zoom: 0.95, rotate: 0, duration: 1.4, ease: "inOut(3)" }, 17.5)
  .handheld({ amount: S.min(0.35) }, 0, ${DURATION});
`;
const html = `<div class="stage" data-libs="stage" data-duration="${DURATION}" data-stage-version="2" style="width:${W}px;height:${H}px"><style>${css}</style>${markup}</div>\n<script>stage.build((tl, S) => {${script}});</script>`;
writeExample(import.meta.url, { html, duration: DURATION, id: "nudge2" });
