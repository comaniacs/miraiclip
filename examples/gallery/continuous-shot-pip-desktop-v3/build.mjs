// Pip v3: the 19 s mascot-is-the-pointer film again, now with an orbiting camera angle, depth of field, a
// glossy button with a light sweep and a real squash, an in-world notification card, a file left on the desktop,
// a mascot with arms, feet, a crouch and a lean, cast shadows under every slab, glassy windows, letter-by-letter
// typing behind a block cursor, and a twelve-icon dock of original icons.
//
//   node build.mjs   writes sequence.html and video.miraiclip.json
import { writeExample } from "../_lib/write-example.mjs";

const W = 1920, H = 1080, DURATION = 19;

// --- geometry helpers: everything lies on the table plane (x right, y towards the camera, z up) ---
// a slab: stacked layers for thickness, a top face, and a soft cast shadow on whatever is below it
const slab = (id, x, y, w, h, r, depth, top, side, face = "", z0 = 0, cls = "", o = {}) => {
  const n = Math.max(2, Math.round(depth / 3));
  let layers = "";
  for (let k = 0; k < n; k++) layers += `<i class="ly" style="transform:translateZ(${z0 + (k * depth) / n}px);border-radius:${r}px;background:${side}"></i>`;
  const sh = o.noShadow ? "" : `<i class="cs" style="left:${depth * 0.6}px;top:${depth * 1.4}px;border-radius:${r}px;transform:translateZ(${Math.max(0.2, z0 - 0.5)}px);filter:blur(${Math.round(8 + depth * 0.7)}px)"></i>`;
  const inner = `${sh}${layers}<div class="tp" style="transform:translateZ(${z0 + depth}px);border-radius:${r}px;background:${top}">${face}</div>`;
  return `<div class="slab ${cls}" id="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${o.wrap ? `<div class="sq" id="${id}sq">${inner}</div>` : inner}</div>`;
};
const bxf = (w, d, h, c, front = "") => `<div class="bx" style="width:${w}px;height:${d}px">
  <div class="f top" style="width:${w}px;height:${d}px;transform:translateZ(${h}px);background:${c.top}"></div>
  <div class="f front" style="left:0;top:${d}px;width:${w}px;height:${h}px;transform-origin:0 0;transform:rotateX(90deg);background:${c.front}">${front}</div>
  <div class="f side" style="left:0;top:0;width:${h}px;height:${d}px;transform-origin:0 0;transform:rotateY(-90deg);background:${c.side}"></div>
  <div class="f side" style="left:${w}px;top:0;width:${h}px;height:${d}px;transform-origin:0 0;transform:rotateY(-90deg);background:${c.side}"></div></div>`;

// --- the dock: twelve original icons ---
const ICONS = [
  ["chat", "linear-gradient(160deg,#6fe58a,#2fb55a)", "#27a04e", `<i class="g bubble"></i>`],
  ["photos", "linear-gradient(160deg,#ffffff,#eee9e4)", "#d5cdc6", `<i class="g petals"></i>`],
  ["maps", "linear-gradient(135deg,#bfeccd 0 38%,#fff 38% 46%,#9ed4ff 46% 100%)", "#7db6e6", `<i class="g arrow"></i>`],
  ["term", "linear-gradient(160deg,#343845,#14161d)", "#0d0f14", `<i class="g mono">&gt;_</i>`],
  ["cal", "linear-gradient(180deg,#ff5a52 0 26%,#fff 26% 100%)", "#d9d2cb", `<i class="g cal">28</i>`],
  ["music", "linear-gradient(160deg,#ff6a8c,#e8284f)", "#c21d40", `<i class="g mono note">♪</i>`],
  ["mail", "linear-gradient(160deg,#5eb1ff,#2b6ee8)", "#1f56bf", `<i class="g mail"></i>`],
  ["web", "linear-gradient(160deg,#58c4ff,#2a86e8)", "#1f6dc2", `<i class="g compass"></i>`],
  ["notes", "linear-gradient(180deg,#ffe06a 0 24%,#fffdf2 24% 100%)", "#e0cf8a", `<i class="g lines"></i>`],
  ["files", "linear-gradient(160deg,#8ed3ff,#4aa0e8)", "#3a86c8", `<i class="g folder"></i>`],
  ["sky", "linear-gradient(180deg,#4aa8ff,#a8dcff)", "#3a86c8", `<i class="g cloud"></i>`],
  ["gear", "linear-gradient(160deg,#c9ccd4,#868b97)", "#6c707b", `<i class="g gear"></i>`],
];
const IS = 120, PITCH = 150, X0 = 60, IY = 885;
const IX = (i) => X0 + i * PITCH, iconCx = (i) => IX(i) + IS / 2;
const PLATE = { x: 20, y: 850, w: 1880, h: 190 };
const icons = ICONS.map(([n, top, side, glyph], i) => slab("i" + n, IX(i), IY, IS, IS, 30, 22, top, side, glyph, 16, "ico dk")).join("");

const WT = { x: 190, y: 70, w: 1120, h: 600 }, WW = { x: 1040, y: 360, w: 760, h: 420 };
const BTN = { x: WW.x + 200, y: WW.y + 150, w: 360, h: 120 };
const lights = `<i class="lt" style="left:30px;background:#ff5f57"></i><i class="lt" style="left:64px;background:#febc2e"></i><i class="lt" style="left:98px;background:#28c840"></i>`;
const text = "make a button that does nothing";
const chars = [...text].map((c, i) => `<b class="ch" style="left:${i * 30.1}px">${c === " " ? "&nbsp;" : c}</b>`).join("");
const winT = slab("winT", WT.x, WT.y, WT.w, WT.h, 28, 14, "linear-gradient(180deg,rgba(255,255,255,.86),rgba(246,242,238,.8))", "rgba(220,212,205,.7)", `<div class="bar">${lights}</div>
  <div class="row"><u>&gt;</u><div id="typed">${chars}</div><s id="caret"></s></div>
  <div id="verbs"><b id="v1">+ Thinking…</b><b id="v2">+ Plotting…</b><b id="v3">+ Building…</b></div>
  <div class="lines"><div id="l1">Write(nothing.html)</div><div id="l2">Done. One button.</div></div>`, 0, "win wt");
const winW = slab("winW", WW.x, WW.y, WW.w, WW.h, 26, 14, "linear-gradient(180deg,rgba(255,255,255,.9),rgba(246,243,240,.82))", "rgba(220,212,205,.7)", `<div class="bar">${lights}</div>`, 0, "win ww");
const button = slab("btnS", BTN.x, BTN.y, BTN.w, BTN.h, 60, 20, "linear-gradient(180deg,#7da2ff 0 46%,#3f6df0 50% 100%)", "#2549b8", `<span class="bl">do nothing</span><i class="sweep"></i>`, 14, "ww", { wrap: true });
const banner = slab("banner", 1110, 150, 660, 130, 44, 12, "linear-gradient(180deg,#ffffff,#f4f1ee)", "#d9d2cb", `<i class="bic"></i><div class="bt"><b>nothing.html</b><span>Did nothing. ✓</span></div><em>now</em>`, 40, "", {});
const fileD = slab("fileD", 1565, 110, 100, 128, 14, 8, "linear-gradient(180deg,#ffffff,#eef0f4)", "#c9ced9", `<i class="fold"></i><i class="fl"></i><i class="fl" style="top:70px"></i>`, 0, "", {});

const css = `
*{box-sizing:border-box;margin:0}
.stage{background:linear-gradient(180deg,#dfe7f2 0%,#f1e6e0 38%,#f6d4bd 100%);color:#2a2630;font-family:Inter,"DejaVu Sans",system-ui,sans-serif;overflow:hidden}
.world{position:absolute;left:0;top:0;width:${W}px;height:${H}px;perspective:1500px;perspective-origin:50% 38%;--bdk:0;--bwt:0;--bww:0}
.table,.spin{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-style:preserve-3d}
.table{transform-origin:50% 88%}
.floor{position:absolute;left:-3600px;top:-3400px;width:9200px;height:8000px;background:linear-gradient(rgba(120,60,40,.07) 3px,transparent 3px) 0 0/200px 200px,linear-gradient(90deg,rgba(120,60,40,.07) 3px,transparent 3px) 0 0/200px 200px,linear-gradient(180deg,#e4e9f3 0%,#f3dccd 34%,#f7c9ab 62%,#f4b898 100%);transform:translateZ(-1px)}
.slab{position:absolute;transform-style:preserve-3d}
.sq{position:absolute;left:0;top:0;width:100%;height:100%;transform-style:preserve-3d;transform-origin:50% 50% 14px;transform:scale3d(calc(1 + var(--sqb,0)*.06),calc(1 + var(--sqb,0)*.06),calc(1 - var(--sqb,0)*.7))}
.ly,.tp,.cs{position:absolute;left:0;top:0;width:100%;height:100%}
.cs{background:rgba(90,45,30,.34)}
.tp{box-shadow:inset 0 0 0 3px rgba(255,255,255,.7),inset 0 -8px 16px rgba(0,0,0,.07),inset 0 6px 10px rgba(255,255,255,.5);overflow:hidden}
.plate .tp{background:linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,236,224,.72))!important}
.dk .tp,.dk .ly,.dk .cs{filter:blur(calc(var(--bdk)*1px))}
.wt .tp,.wt .ly,.wt .cs{filter:blur(calc(var(--bwt)*1px))}
.ww .tp,.ww .ly,.ww .cs{filter:blur(calc(var(--bww)*1px))}
.bar{position:absolute;left:0;top:0;right:0;height:64px;background:rgba(238,234,228,.85)}
.lt{position:absolute;top:22px;width:22px;height:22px;border-radius:50%}
.row{position:absolute;left:44px;top:120px;width:1040px;height:60px;font:500 50px/60px "DejaVu Sans Mono",ui-monospace,monospace;color:#3d3a44;white-space:nowrap}
.row u{position:absolute;left:0;top:0;text-decoration:none;color:#c98c6c}
#typed{position:absolute;left:46px;top:0;height:60px}
.ch{position:absolute;top:0;font-weight:500}
#caret{position:absolute;left:46px;top:6px;width:28px;height:50px;background:#ff7a3d}
#verbs{position:absolute;left:44px;top:220px;font:500 46px "DejaVu Sans Mono",ui-monospace,monospace;color:#ff7a3d}
#verbs b{position:absolute;left:0;top:0;font-weight:500;white-space:nowrap}
.lines{position:absolute;left:44px;top:290px;font:500 46px/1.6 "DejaVu Sans Mono",ui-monospace,monospace;color:#6b6672}
#btnS .tp{clip-path:inset(0 round 60px)}
.bl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 50px "DejaVu Sans Mono",ui-monospace,monospace;color:#fff;text-shadow:0 2px 0 rgba(20,40,120,.5)}
.sweep{position:absolute;left:-50%;top:-20%;width:26%;height:140%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.95),transparent);transform:skewX(-24deg);opacity:0}
.bic{position:absolute;left:26px;top:25px;width:80px;height:80px;border-radius:22px;background:linear-gradient(160deg,#58c4ff,#2a86e8)}
.bic::after{content:"";position:absolute;left:18px;top:18px;width:44px;height:44px;border-radius:50%;border:6px solid #fff}
.bt{position:absolute;left:126px;top:22px;font:600 38px Inter,"DejaVu Sans",sans-serif;display:flex;flex-direction:column;gap:6px}
.bt b{font-weight:800}.bt span{font-weight:500;color:#5a5560;font-size:34px}
#banner em{position:absolute;right:34px;top:20px;font:500 28px Inter,sans-serif;color:#9a949e;font-style:normal}
.fold{position:absolute;right:0;top:0;width:34px;height:34px;background:linear-gradient(225deg,#d8dce6 50%,transparent 50%)}
.fl{position:absolute;left:16px;top:46px;width:68px;height:8px;border-radius:4px;background:#47bfff}
.lbl{position:absolute;left:1520px;top:250px;width:190px;text-align:center;font:700 30px Inter,"DejaVu Sans",sans-serif;color:#3a2f33;transform:translateZ(1px)}
.g{position:absolute;left:0;top:0;width:100%;height:100%;display:block;font-style:normal}
.bubble{background:radial-gradient(ellipse 36% 29% at 50% 46%,#fff 0 98%,transparent 100%),linear-gradient(135deg,#fff 50%,transparent 50%) 30% 66%/16% 16% no-repeat}
.petals{background:conic-gradient(#ff5a52,#ffb340,#ffe14a,#7bdc5a,#3fc1ff,#8a6bff,#ff5fa8,#ff5a52);-webkit-mask:radial-gradient(circle,transparent 0 16%,#000 17% 44%,transparent 45%);mask:radial-gradient(circle,transparent 0 16%,#000 17% 44%,transparent 45%)}
.arrow{background:#2f7cf5;clip-path:polygon(50% 16%,74% 78%,50% 64%,26% 78%)}
.mono{font:800 54px/120px "DejaVu Sans Mono",monospace;color:#f4f1ec;text-align:center}
.note{font-size:70px;line-height:118px}
.cal{font:800 62px/160px "DejaVu Sans",sans-serif;color:#2a2630;text-align:center}
.mail{background:linear-gradient(#fff,#fff) 50% 55%/62% 44% no-repeat}
.mail::after{content:"";position:absolute;left:19%;top:27%;width:62%;height:22%;background:#2b6ee8;clip-path:polygon(0 0,100% 0,50% 100%);opacity:.9}
.compass{background:radial-gradient(circle,transparent 0 30%,#fff 31% 38%,transparent 39%),conic-gradient(from 40deg at 50% 50%,#fff 0 9%,transparent 9% 50%,rgba(255,90,82,.95) 50% 59%,transparent 59%);-webkit-mask:radial-gradient(circle,#000 0 42%,transparent 43%);mask:radial-gradient(circle,#000 0 42%,transparent 43%)}
.lines{}
.g.lines{background:repeating-linear-gradient(180deg,transparent 0 22px,rgba(110,100,90,.4) 22px 26px);margin:36px 18px 14px;width:calc(100% - 36px);height:calc(100% - 50px)}
.folder{background:linear-gradient(#fff,#fff) 22px 40px/76px 50px no-repeat;border-radius:8px}
.cloud{background:radial-gradient(circle at 34% 34%,#ffd84a 0 12%,transparent 13%),radial-gradient(ellipse 22% 16% at 40% 66%,#fff 0 98%,transparent 100%),radial-gradient(ellipse 24% 18% at 62% 64%,#fff 0 98%,transparent 100%)}
.gear{background:repeating-conic-gradient(#fff 0 9deg,transparent 9deg 30deg);-webkit-mask:radial-gradient(circle,transparent 0 22%,#000 23% 46%,transparent 47%);mask:radial-gradient(circle,transparent 0 22%,#000 23% 46%,transparent 47%)}
#pip{position:absolute;left:0;top:0;width:110px;height:100px;transform-style:preserve-3d}
.pb{position:absolute;left:0;top:0;width:110px;height:100px;transform-style:preserve-3d;transform-origin:55px 50px 0;transform:rotateX(calc(var(--lean,0)*1deg)) scale3d(calc(1 + var(--sq,0)*0.14),calc(1 + var(--sq,0)*0.14),calc(1 - var(--sq,0)*0.26))}
.bx{position:absolute;left:0;top:0;transform-style:preserve-3d}
.f{position:absolute;border-radius:10px}
.eye{position:absolute;top:30px;width:20px;height:34px;border-radius:10px;background:#fff;overflow:hidden;font-style:normal}
.eye b{position:absolute;left:5px;top:10px;width:10px;height:16px;border-radius:5px;background:#211a1a}
#e1{left:24px}#e2{left:68px}
.body{position:absolute;left:0;top:0;transform-style:preserve-3d;transform:translateZ(12px)}
.arm{position:absolute;top:32px;transform-style:preserve-3d;transform-origin:12px 17px 44px}
#aL{left:-26px;transform:translateZ(36px) rotateY(calc(var(--ar,0)*1deg))}
#aR{left:112px;transform:translateZ(36px) rotateY(calc(var(--ar,0)*-1deg))}
.foot{position:absolute;top:58px;transform-style:preserve-3d}
#sh{position:absolute;left:0;top:0;width:150px;height:110px;border-radius:50%;background:radial-gradient(closest-side,rgba(60,30,20,.55),rgba(60,30,20,0))}
#file{position:absolute;left:0;top:0;width:100px;height:128px;transform-style:preserve-3d}
#end{position:absolute;left:-250px;top:260px;width:1500px;text-align:center;font:800 150px "DejaVu Sans Mono",ui-monospace,monospace;color:#3a2f33;transform:translateZ(1px);white-space:nowrap}
`;
const PC = { top: "#ffa365", front: "#f07b3a", side: "#c75f27" }, PD = { top: "#f08a4c", front: "#d9662a", side: "#a94c1b" };
const pipBody = `<div class="foot" style="left:14px">${bxf(32, 30, 12, PD)}</div><div class="foot" style="left:64px">${bxf(32, 30, 12, PD)}</div>
<div class="body">${bxf(110, 100, 100, PC, `<i class="eye" id="e1"><b></b></i><i class="eye" id="e2"><b></b></i>`)}</div>
<div class="arm" id="aL">${bxf(24, 34, 44, PD)}</div><div class="arm" id="aR">${bxf(24, 34, 44, PD)}</div>`;
const fileGhost = `<div class="f top" style="width:100px;height:128px;background:#fff;border:5px solid #47bfff;transform:translateZ(0)"></div>`;
const markup = `<div class="world"><div class="table"><div class="spin"><i class="floor"></i>
${slab("plate", PLATE.x, PLATE.y, PLATE.w, PLATE.h, 46, 14, "rgba(255,255,255,.7)", "rgba(227,200,184,.8)", "", 0, "plate dk")}${icons}
${winT}${winW}${button}${fileD}<p class="lbl" id="flbl">nothing.html</p>${banner}
<i id="sh"></i><div id="file">${fileGhost}</div><div id="pip"><div class="pb">${pipBody}</div></div>
<p id="end">&gt; pip did nothing.</p></div></div></div>`;

const script = `
const P = (v) => S.w(v / 19.2), Q = (v) => S.h(v / 10.8), Z = (v) => S.min(v / 10.8);
const iconCx = (i) => ${X0 + IS / 2} + i * ${PITCH}, ICON_Y = ${IY + IS / 2};
const Z_ICON = 38, Z_WIN = 14, Z_BTN = 34;
let cx = iconCx(0), cy = ICON_Y, cz = Z_ICON;
tl.set(".table", { rotateX: 58 }, 0)
  .set("#pip", { x: P(cx - 55), y: Q(cy - 50), z: Z(500) }, 0)
  .set("#sh", { x: P(cx - 75), y: Q(cy - 55), z: Z(Z_ICON + 0.5), opacity: 0 }, 0)
  .set("#file,#fileD,#flbl,#banner", { opacity: 0 }, 0)
  .set("#winT", { scale: 0.001 }, 0).set("#winW", { scale: 0.001 }, 0).set("#btnS", { scale: 0.001 }, 0)
  .set("#typed .ch,#v1,#v2,#v3,#l1,#l2,#caret", { opacity: 0 }, 0)
  .set("#end", { opacity: 0 }, 0)
  .set(".world", { "--bwt": 7, "--bww": 7 }, 0);

// the character: crouch before a jump, stretch in the air, lean and arms, squash on landing
const land = (t) => tl.to("#pip", { "--sq": 1, duration: 0.07, ease: "power2.out" }, t).to("#pip", { "--sq": 0, duration: 0.3, ease: "expo.out" }, t + 0.07)
  .to("#pip", { "--lean": 9, "--ar": 0, duration: 0.07 }, t).to("#pip", { "--lean": 0, duration: 0.3, ease: "expo.out" }, t + 0.07).hit("land@" + t.toFixed(2), t, { kind: "land" });
const hopTo = (x, y, z, t, d, h, surf) => {
  tl.to("#pip", { "--sq": 0.8, duration: 0.1, ease: "power2.in" }, t - 0.1)
    .to("#pip", { "--sq": -0.35, "--ar": 68, "--lean": -10, duration: 0.14, ease: "power2.out" }, t)
    .to("#pip", { x: P(x - 55), y: Q(y - 50), duration: d, ease: "sine.inOut" }, t)
    .to("#pip", { z: [Z(cz), Z(Math.max(cz, z) + h), Z(z)], duration: d, ease: "none" }, t)
    .to("#sh", { x: P(x - 75), y: Q(y - 55), duration: d, ease: "sine.inOut" }, t)
    .to("#sh", { z: Z((surf ?? z) + 0.5), duration: d, ease: "none" }, t)
    .to("#sh", { opacity: [0.9, 0.35, 0.9], scale: [1, 0.55, 1], duration: d, ease: "none" }, t);
  land(t + d);
  cx = x; cy = y; cz = z;
};
const ripple = (t) => tl.to(".ico", { z: Z(26), duration: 0.14, stagger: { each: 0.05, from: "center" }, ease: "power2.out" }, t).to(".ico", { z: 0, duration: 0.34, stagger: { each: 0.05, from: "center" }, ease: "expo.out" }, t + 0.14);

// 1. the drop onto the first icon, the dock ripples
tl.label("fall", 0)
  .to("#pip", { z: Z(Z_ICON), duration: 0.5, ease: "power2.in" }, 0.1)
  .to("#sh", { opacity: [0, 0.9], scale: [0.3, 1], duration: 0.5, ease: "power2.in" }, 0.1);
land(0.6); cz = Z_ICON;
ripple(0.6);
tl.hit("drop", 0.6, { kind: "impact" });

// 2. the run along the dock, stamping the terminal, which bounces twice with it riding
tl.label("run", 1.1);
hopTo(iconCx(1), ICON_Y, Z_ICON, 1.1, 0.3, 50); hopTo(iconCx(2), ICON_Y, Z_ICON, 1.4, 0.3, 50);
hopTo(iconCx(4), ICON_Y, Z_ICON, 1.7, 0.3, 60); hopTo(iconCx(5), ICON_Y, Z_ICON, 2.0, 0.3, 60);
hopTo(iconCx(3), ICON_Y, Z_ICON, 2.4, 0.5, 90);
tl.to("#iterm", { z: [0, Z(70), 0, Z(34), 0], duration: 0.8, ease: "none" }, 2.9)
  .to("#pip", { z: [Z(Z_ICON), Z(Z_ICON + 70), Z(Z_ICON), Z(Z_ICON + 34), Z(Z_ICON)], duration: 0.8, ease: "none" }, 2.9)
  .to("#sh", { opacity: [0.9, 0.4, 0.9, 0.6, 0.9], duration: 0.8, ease: "none" }, 2.9)
  .hit("bounce", 3.3, { kind: "impact" });

// 3. the window springs out of the icon; focus moves from the dock to the window
tl.label("window", 3.4).hit("pop", "window", { kind: "whoosh", pan: -0.3 })
  .fromTo("#winT", { scale: 0.05, x: P(iconCx(3) - ${WT.x + WT.w / 2}), y: Q(ICON_Y - ${WT.y + WT.h / 2}) }, { scale: 1, x: 0, y: 0, duration: 0.8, ease: "back.out" }, "window")
  .to(".world", { "--bwt": 0, "--bdk": 7, duration: 0.8, ease: "inOut(2)" }, "window");

// 4. four hops type the prompt letter by letter behind a block cursor, a stamp sends it
tl.label("type", 4.4);
const CH = 30.1, groups = [[0, 5], [5, 14], [14, 24], [24, 31]];
const xs = [${WT.x + 130}, ${WT.x + 330}, ${WT.x + 640}, ${WT.x + 900}], ROW_Y = ${WT.y + 128};
hopTo(xs[0], ROW_Y, Z_WIN, 3.95, 0.45, 170, Z_WIN);
tl.set("#caret", { opacity: 1 }, 4.4);
groups.forEach(([a, b], i) => {
  if (i) hopTo(xs[i], ROW_Y, Z_WIN, 4.4 + (i - 1) * 0.3, 0.3, 60, Z_WIN);
  const t0 = 4.4 + i * 0.3;
  for (let k = a; k < b; k++) {
    const t = t0 + ((k - a) / (b - a)) * 0.28;
    tl.set("#typed .ch:nth-child(" + (k + 1) + ")", { opacity: 1 }, t).set("#caret", { x: P((k + 1) * CH) }, t);
  }
});
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

// 6. a file icon appears on the desktop and stays; its ghost is carried overhead to the web icon
tl.label("file", 8.3);
const FX = 1615, FY = 175;
tl.set("#fileD,#flbl", { opacity: 1 }, 8.3).from("#fileD", { scale: 0.01, duration: 0.35, ease: "back.out" }, 8.3).from("#flbl", { opacity: 0, duration: 0.3 }, 8.4)
  .hit("file", 8.3, { kind: "impact" });
hopTo(FX - 110, FY + 40, 0, 8.3, 0.4, 70, 0);
tl.set("#file", { x: P(FX - 50), y: Q(FY - 64), z: Z(8), opacity: 1 }, 8.75)
  .to("#file", { z: Z(130), duration: 0.3, ease: "expo.out" }, 8.75);
tl.to("#file", { x: P(iconCx(7) - 50), y: Q(ICON_Y - 64), duration: 1.15, ease: "sine.inOut" }, 9.05)
  .to("#file", { z: [Z(130), Z(330), Z(Z_ICON + 126)], duration: 1.15, ease: "none" }, 9.05);
hopTo(iconCx(7), ICON_Y, Z_ICON, 9.05, 1.15, 200, Z_ICON);
tl.to("#file", { z: Z(Z_ICON + 4), scale: 0.3, duration: 0.3, ease: "power2.in" }, 10.2).set("#file", { opacity: 0 }, 10.5);
ripple(10.25);
tl.label("web", 10.4).hit("web", "web", { kind: "whoosh", pan: 0.3 })
  .fromTo("#winW", { scale: 0.05, x: P(iconCx(7) - ${WW.x + WW.w / 2}), y: Q(ICON_Y - ${WW.y + WW.h / 2}) }, { scale: 1, x: 0, y: 0, duration: 0.8, ease: "back.out" }, "web")
  .fromTo("#btnS", { scale: 0.05, x: P(iconCx(7) - ${BTN.x + BTN.w / 2}), y: Q(ICON_Y - ${BTN.y + BTN.h / 2}) }, { scale: 1, x: 0, y: 0, duration: 0.8, ease: "back.out" }, "web")
  .to(".world", { "--bww": 0, "--bwt": 6, "--bdk": 8, duration: 0.8 }, "web");

// 7. the leap onto the button: it squashes under the landing, the light sweeps across, the window shakes "no",
//    a card slides in, a look left and right, a blink
tl.label("leap", 11.0);
const BX = ${BTN.x + Math.round(BTN.w * 0.78)}, BY = ${BTN.y + BTN.h / 2};
hopTo(BX, BY, Z_BTN, 11.0, 0.8, 300, Z_BTN);
tl.to("#btnS", { "--sqb": 1, duration: 0.07, ease: "power2.out" }, 11.8).to("#btnS", { "--sqb": 0, duration: 0.5, ease: "expo.out" }, 11.87)
  .to("#btnS .sweep", { opacity: [0.9, 0.9, 0], x: [0, P(560), P(560)], duration: 0.55, ease: "power2.inOut" }, 11.85)
  .hit("press", 11.8, { kind: "click" })
  .label("no", 12.0)
  .to("#winW", { x: [0, -P(40), P(40), -P(28), P(28), -P(12), 0], duration: 0.7, ease: "none" }, "no")
  .to("#btnS", { x: [0, -P(40), P(40), -P(28), P(28), -P(12), 0], duration: 0.7, ease: "none" }, "no")
  .to("#pip", { x: [P(BX - 55), P(BX - 55 - 40), P(BX - 55 + 40), P(BX - 55 - 28), P(BX - 55 + 28), P(BX - 55 - 12), P(BX - 55)], duration: 0.7, ease: "none" }, "no")
  .set("#banner", { opacity: 1 }, 12.6)
  .fromTo("#banner", { x: P(900) }, { x: 0, duration: 0.6, ease: "expo.out" }, 12.6)
  .to("#e1 b,#e2 b", { x: -P(6), duration: 0.2 }, 13.2).to("#e1 b,#e2 b", { x: P(6), duration: 0.3 }, 13.5).to("#e1 b,#e2 b", { x: 0, duration: 0.2 }, 13.9)
  .to(".eye", { scaleY: 0.1, duration: 0.08 }, 14.05).to(".eye", { scaleY: 1, duration: 0.12 }, 14.15);

// 8. the overview: the camera rises, each window is stamped home into the dock
tl.label("over", 14.4)
  .to("#banner", { x: P(900), duration: 0.5, ease: "expo.in" }, "over")
  .to(".world", { "--bdk": 0, "--bww": 0, "--bwt": 0, duration: 0.9 }, "over")
  .hit("rise", "over", { kind: "whoosh", pan: 0 });
hopTo(${WW.x + 62}, ${WW.y + 34}, Z_WIN, 14.9, 0.6, 150, Z_WIN);
tl.label("stamp1", 15.5)
  .to("#winW,#btnS", { scale: 0.001, x: P(iconCx(7) - ${WW.x + WW.w / 2}), y: Q(ICON_Y - ${WW.y + WW.h / 2}), duration: 0.5, ease: "inOut(3)" }, "stamp1")
  .hit("s1", "stamp1", { kind: "click" });
hopTo(${WT.x + 62}, ${WT.y + 34}, Z_WIN, 16.0, 0.6, 170, Z_WIN);
tl.label("stamp2", 16.6)
  .to("#winT", { scale: 0.001, x: P(iconCx(3) - ${WT.x + WT.w / 2}), y: Q(ICON_Y - ${WT.y + WT.h / 2}), duration: 0.5, ease: "inOut(3)" }, "stamp2")
  .hit("s2", "stamp2", { kind: "click" });
hopTo(iconCx(3), ICON_Y, Z_ICON, 16.6, 0.5, 70, Z_ICON);
ripple(17.1);

// 9. home along the dock, the end line, the leap
tl.label("home", 17.2);
hopTo(iconCx(2), ICON_Y, Z_ICON, 17.1, 0.25, 40); hopTo(iconCx(1), ICON_Y, Z_ICON, 17.35, 0.25, 40); hopTo(iconCx(0), ICON_Y, Z_ICON, 17.6, 0.3, 50);
tl.set("#end", { opacity: 1 }, 17.95).from("#end", { x: -P(60), duration: 0.8, ease: "expo.out" }, 17.95)
  .label("leapoff", 18.4).hit("up", "leapoff", { kind: "whoosh", pan: 0 })
  .to("#pip", { z: [Z(Z_ICON), Z(Z_ICON + 260), Z(Z_ICON + 360)], "--ar": 70, duration: 0.6, ease: "power2.out" }, "leapoff")
  .to("#sh", { opacity: 0.2, scale: 0.4, duration: 0.6 }, "leapoff");

// the table: it tilts a little between beats and the whole plane swings, so the camera appears to orbit
const orbit = [[1.0, -16, 60], [3.2, 9, 56], [4.2, -7, 62], [6.2, 11, 57], [8.2, -12, 61], [10.5, 14, 55], [11.6, -8, 62], [14.3, 0, 52], [16.3, 12, 60], [17.4, 0, 58]];
orbit.forEach(([t, rot, tilt], i) => {
  const d = Math.min((orbit[i + 1] ? orbit[i + 1][0] - t : 1.4) + 0.4, ${DURATION} - t);
  tl.to(".spin", { rotate: rot, duration: d, ease: "inOut(2)" }, t).to(".table", { rotateX: tilt, duration: d, ease: "inOut(2)" }, t);
});

// the camera: close, always moving, following the character, rising for the overview
tl.camera({ zoom: 1.9, duration: 0.01 }, 0)
  .follow("#pip", { lead: 0.12, from: 0.2, to: 14.2 }, 0)
  .camera({ zoom: 1.6, rotate: -2, duration: 1.2, ease: "inOut(3)" }, 1.2)
  .camera({ zoom: 2.2, rotate: 1.5, duration: 1.4, ease: "inOut(3)" }, 3.4)
  .camera({ zoom: 2.4, rotate: -1.5, duration: 1.6, ease: "inOut(3)" }, 4.4)
  .camera({ zoom: 2.0, rotate: 1.5, duration: 1.6, ease: "inOut(3)" }, 6.3)
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
writeExample(import.meta.url, { html, duration: DURATION, id: "nudge3" });
