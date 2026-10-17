import fs from "node:fs";
const BASE = `*{box-sizing:border-box;margin:0}
.root{width:1920px;height:1080px;position:relative;font-family:Inter,sans-serif;color:#fff;overflow:hidden}
@keyframes rise{from{transform:translateY(48px);opacity:0;filter:blur(10px)}}
@keyframes fadein{from{opacity:0}}
@keyframes pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.06);opacity:1}100%{transform:scale(1)}}
@keyframes reveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes growx{from{transform:scaleX(0)}}
.r{display:inline-block;animation:rise .7s cubic-bezier(.2,.8,.2,1) both}
.f{animation:fadein .6s ease-out both}
.p{animation:pop .55s cubic-bezier(.2,.8,.2,1) both}
.grad{background:linear-gradient(90deg,#8b7bff,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent}
.eyebrow{font-weight:600;font-size:26px;letter-spacing:.32em;color:#9aa4c0}
.mono{font-family:'DejaVu Sans Mono',Consolas,Menlo,monospace}`;
const scene = (css, body) => `<div class="root"><style>${BASE}${css}</style>${body}</div>`;
const words = (text, d0, step, cls = "r") => text.split(" ").map((w, i) => `<span class="${cls}" style="--d:${(d0 + i * step).toFixed(2)}s">${w}</span>`).join(" ");

const S = [];
S.push(scene(`.wrap{position:absolute;left:160px;top:330px}.h1{font-weight:800;font-size:118px;line-height:1.08;letter-spacing:-.02em}.l2{animation:reveal 1s cubic-bezier(.65,0,.35,1) both;--d:1.05s}`,
`<div class="wrap"><div class="eyebrow f" style="--d:.05s">MIRAICLIP</div><div style="height:28px"></div>
<div class="h1">${words("Build video editors,", .2, .12)}</div>
<div class="h1 grad l2">not video editor plumbing.</div></div>`));

S.push(scene(`.l{position:absolute;left:160px;top:360px;width:680px}.h2{font-weight:800;font-size:92px;line-height:1.05;letter-spacing:-.02em}.sub{margin-top:36px;font-size:36px;color:#a8b2cc;font-weight:500}
.card{position:absolute;left:900px;top:300px;width:860px;padding:44px 48px;border-radius:28px;background:#121828;border:1px solid #ffffff1c;box-shadow:0 40px 120px #0008}
.ln{font-size:28px;line-height:1.75;white-space:pre;color:#d7dcf0;animation:rise .5s cubic-bezier(.2,.8,.2,1) both}
.k{color:#8b7bff}.s{color:#5eead4}.c{color:#6b7591}
.chip{position:absolute;left:1660px;top:600px;padding:14px 26px;border-radius:999px;background:#22d3ee;color:#04121a;font-weight:800;font-size:30px;--d:2.1s}`,
`<div class="l"><div class="h2">${words("Every edit is a command.", .1, .1)}</div><div class="sub f" style="--d:.9s">Validated. Undoable. Serializable.</div></div>
<div class="card f" style="--d:.35s">
<div class="ln mono" style="--d:.6s">project.<span class="k">dispatch</span>({</div>
<div class="ln mono" style="--d:.75s">  type: <span class="s">"clip/add"</span>,</div>
<div class="ln mono" style="--d:.9s">  payload: { kind: <span class="s">"text"</span>, text: <span class="s">"Hi"</span> }</div>
<div class="ln mono" style="--d:1.05s">})</div>
<div class="ln mono" style="--d:1.5s">project.<span class="k">undo</span>()  <span class="c">// exact history</span></div>
</div><div class="chip mono p">⌘Z</div>`));

S.push(scene(`@property --n{syntax:'&lt;integer&gt;';inherits:false;initial-value:0}
@keyframes count{to{--n:var(--to)}}
.t{position:absolute;left:0;width:1920px;top:190px;text-align:center;font-weight:800;font-size:80px;letter-spacing:-.02em}
.row{position:absolute;left:160px;top:420px;display:flex;gap:40px}
.card{width:507px;height:400px;border-radius:32px;background:linear-gradient(180deg,#151b2e,#0f1424);border:1px solid #ffffff1c;padding:56px 48px;animation:rise .7s cubic-bezier(.2,.8,.2,1) both}
.num{font-weight:800;font-size:150px;line-height:1;letter-spacing:-.04em;counter-reset:n var(--n);animation:count 1.4s cubic-bezier(.2,.8,.2,1) both}
.num::after{content:counter(n)}.u{font-size:64px;margin-left:6px}
.lab{margin-top:28px;font-size:32px;line-height:1.35;color:#a8b2cc;font-weight:500}`,
`<div class="t">${words("Built for real projects.", .05, .08)}</div>
<div class="row">
<div class="card" style="--d:.35s"><div class="grad"><span class="num" style="--to:79;--d:.5s"></span></div><div class="lab">effects built in, rendered on the GPU</div></div>
<div class="card" style="--d:.5s"><div class="grad"><span class="num" style="--to:125;--d:.65s"></span><span class="u">min</span></div><div class="lab">timeline with 4,464 clips, tested end to end</div></div>
<div class="card" style="--d:.65s"><div class="grad"><span class="num" style="--to:60;--d:.8s"></span><span class="u">fps</span></div><div class="lab">smooth playback, even two hours in</div></div>
</div>`));

const clip = (left, w, color, d, label = "") => `<div class="clip" style="left:${left}px;width:${w}px;background:${color};--d:${d}s">${label}</div>`;
S.push(scene(`.t{position:absolute;left:160px;top:150px;font-weight:800;font-size:84px;letter-spacing:-.02em}.sub{position:absolute;left:160px;top:260px;font-size:34px;color:#a8b2cc;font-weight:500}
.tl{position:absolute;left:160px;top:400px;width:1600px;height:500px;border-radius:28px;background:#0f1424;border:1px solid #ffffff1c;padding:40px;overflow:hidden}
.ruler{height:28px;border-bottom:1px solid #ffffff1c;margin-bottom:26px;background:repeating-linear-gradient(90deg,#ffffff30 0 2px,transparent 2px 76px)}
.trk{position:relative;height:84px;margin-bottom:22px;border-radius:14px;background:#ffffff08}
.clip{position:absolute;top:8px;height:68px;border-radius:12px;transform-origin:left center;animation:growx .6s cubic-bezier(.2,.8,.2,1) both;font-size:24px;font-weight:600;padding:20px 18px;color:#0a0d18;white-space:nowrap;overflow:hidden}
@keyframes sweep{from{left:40px}to{left:1500px}}
.ph{position:absolute;top:24px;width:4px;height:450px;background:#fff;border-radius:2px;box-shadow:0 0 24px #22d3ee;animation:sweep 3.4s linear both;--d:0s}`,
`<div class="t">${words("Timeline. Preview. Export.", .05, .1)}</div><div class="sub f" style="--d:.5s">One engine, the same pixels everywhere.</div>
<div class="tl f" style="--d:.2s"><div class="ruler"></div>
<div class="trk">${clip(0, 520, "#8b7bff", .5, "intro.mp4")}${clip(540, 640, "#8b7bff", .65, "demo.mp4")}${clip(1200, 320, "#8b7bff", .8, "outro.mp4")}</div>
<div class="trk">${clip(120, 380, "#5eead4", .9, "Lower third")}${clip(760, 460, "#5eead4", 1.0, "Captions")}</div>
<div class="trk">${clip(0, 1520, "#f9a8d4", 1.1, "music.mp3")}</div>
<div class="ph"></div></div>`));

S.push(scene(`.t{position:absolute;left:160px;top:380px;width:640px;font-weight:800;font-size:110px;line-height:1.02;letter-spacing:-.03em}
.sub{position:absolute;left:160px;top:640px;width:620px;font-size:34px;line-height:1.4;color:#a8b2cc;font-weight:500}
.chat{position:absolute;left:900px;top:200px;width:860px}
.me{margin-left:auto;width:640px;padding:30px 36px;border-radius:30px 30px 8px 30px;background:#8b7bff;font-size:34px;font-weight:600;line-height:1.35}
.tool{display:flex;align-items:center;gap:22px;margin-top:22px;padding:24px 30px;border-radius:20px;background:#121828;border:1px solid #ffffff1c;font-size:30px;color:#d7dcf0;animation:rise .5s cubic-bezier(.2,.8,.2,1) both}
.ok{width:44px;height:44px;border-radius:50%;background:#22d3ee;color:#04121a;font-weight:900;font-size:26px;display:flex;align-items:center;justify-content:center}
.dim{color:#7d87a3}`,
`<div class="t">${words("Let Claude edit.", .05, .12)}</div><div class="sub f" style="--d:.6s">An MCP server and skills. Claude sees every frame it changes.</div>
<div class="chat"><div class="me r" style="--d:.4s">Cut the pauses, add karaoke captions and a lower third.</div>
<div class="tool" style="--d:1.0s"><div class="ok">✓</div><span class="mono">get_state</span></div>
<div class="tool" style="--d:1.3s"><div class="ok">✓</div><span class="mono">apply_commands</span><span class="dim">· 42 commands</span></div>
<div class="tool" style="--d:1.6s"><div class="ok">✓</div><span class="mono">preview_frame</span><span class="dim">· 4 checks</span></div>
<div class="tool" style="--d:1.9s"><div class="ok">✓</div><span class="mono">export</span><span class="dim">· final.mp4</span></div></div>`));

S.push(scene(`.c{position:absolute;left:0;top:0;width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.wm{font-weight:800;font-size:180px;letter-spacing:-.045em}.dot{display:inline-block;width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#8b7bff,#22d3ee);margin-left:10px}
.tag{margin-top:18px;font-size:42px;color:#a8b2cc;font-weight:500}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 #22d3ee66}50%{box-shadow:0 0 0 22px #22d3ee00}}
.cta{margin-top:70px;padding:26px 54px;border-radius:999px;background:#fff;color:#0a0d18;font-weight:700;font-size:40px}
.pl{animation:pulse 1.6s ease-in-out 3 both}`,
`<div class="c"><div class="wm p" style="--d:.1s">miraiclip<span class="dot"></span></div>
<div class="tag f" style="--d:.55s">The engine for video editors in the browser.</div>
<div class="f" style="--d:.9s"><div class="cta pl" style="--d:1.3s">docs.miraiclip.com</div></div></div>`));

const durs = [3.2, 3.6, 3.4, 3.6, 3.6, 3.4].map((s) => Math.round(s * 1e6));
const total = durs.reduce((a, b) => a + b, 0);
const commands = [
  { type: "project/set-settings", payload: { width: 1920, height: 1080, fps: 30, name: "Miraiclip launch" } },
  { type: "asset/add", payload: { id: "inter", kind: "font", src: "InterVariable.woff2", family: "Inter", weightRange: [100, 900] } },
  { type: "track/add", payload: { id: "bg", kind: "video", name: "Background" } },
  { type: "track/add", payload: { id: "scene", kind: "video", name: "Scenes" } },
  { type: "clip/add", payload: { kind: "html", id: "bg", trackId: "bg", startUs: 0, durationUs: total,
    template: `<div style="width:1920px;height:1080px;background:radial-gradient(900px 600px at 15% 20%,#2a1f6b 0%,transparent 70%),radial-gradient(800px 600px at 90% 85%,#0e4a5c 0%,transparent 70%),#0a0d18"></div>` } },
  { type: "effect/add", payload: { clipId: "bg", kind: "grain", params: { intensity: 0.12 } } },
];
let t = 0;
S.forEach((tpl, i) => {
  commands.push({ type: "clip/add", payload: { kind: "html", id: `s${i + 1}`, trackId: "scene", startUs: t, durationUs: durs[i], animated: true, template: tpl } });
  t += durs[i];
});
for (let i = 1; i < S.length; i++) commands.push({ type: "transition/add", payload: { kind: "crossDissolve", fromClipId: `s${i}`, toClipId: `s${i + 1}`, durationUs: 500000 } });
fs.writeFileSync("cmds.json", JSON.stringify(commands));
console.log("total", total / 1e6, "s; template sizes", S.map((s) => s.length).join(","));
