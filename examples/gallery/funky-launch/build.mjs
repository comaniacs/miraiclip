// Builds the "funky" Miraiclip launch video as one apply_commands batch (cmds.json).
// 108 BPM: beat = 0.5556 s, bar = 2.2222 s. Every scene starts on a bar line.
import fs from "node:fs";

const B = 60 / 108;               // beat in seconds
const BAR = 4 * B;
const us = (s) => Math.round(s * 1e6);
const d = (beats) => `${(beats * B).toFixed(3)}s`; // CSS delay in beats

const KIT = `*{box-sizing:border-box;margin:0;padding:0}
.root{--bg:#0c1010;--bg2:#101414;--line:#232b2a;--ink:#eef3f2;--muted:#9aa7a4;--teal:#2fd3b9;--mint:#7ff0dc;--coral:#ff6f5e;--amber:#ffb423;--blue:#39a7ff;--paper:#f3f1ec;
 width:1920px;height:1080px;position:relative;overflow:hidden;font-family:Geist,sans-serif;color:var(--ink)}
.mono{font-family:'Geist Mono',monospace}
@keyframes rise{from{transform:translateY(60px);opacity:0;filter:blur(12px)}}
@keyframes fade{from{opacity:0}}
@keyframes boing{0%{transform:scale(0) rotate(-12deg)}60%{transform:scale(1.12) rotate(3deg)}80%{transform:scale(.96) rotate(-1deg)}100%{transform:scale(1) rotate(0)}}
@keyframes slam{0%{transform:scale(2.4);opacity:0;filter:blur(18px)}55%{transform:scale(.94);opacity:1;filter:blur(0)}100%{transform:scale(1)}}
@keyframes dropin{0%{transform:translateY(-140%) rotate(-8deg)}65%{transform:translateY(8%) rotate(2deg)}100%{transform:translateY(0) rotate(0)}}
@keyframes fromright{0%{transform:translateX(120%) skewX(-12deg)}70%{transform:translateX(-4%) skewX(3deg)}100%{transform:translateX(0) skewX(0)}}
@keyframes thump{0%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes on{from{opacity:0}to{opacity:1}}
@keyframes off{from{opacity:1}to{opacity:0}}
@keyframes blink{50%{opacity:0}}
.r{display:inline-block;animation:rise .55s cubic-bezier(.2,.8,.2,1) both}
.f{animation:fade .4s ease-out both}
.b{display:inline-block;animation:boing .6s cubic-bezier(.2,.8,.2,1) both}
.s{display:inline-block;animation:slam .45s cubic-bezier(.2,.8,.2,1) both}
.show{animation:on .01s step-end both}
.hide{animation:off .01s step-end both}
.chip{display:inline-flex;align-items:center;gap:14px;padding:14px 22px;border-radius:999px;font:500 28px 'Geist Mono',monospace}
.ok{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:var(--teal);color:#06201c;font:800 22px Geist,sans-serif}
.grain{position:absolute;inset:0;background:radial-gradient(1200px 700px at 20% 10%,#2fd3b922,transparent 70%),radial-gradient(900px 600px at 85% 90%,#39a7ff1a,transparent 70%)}`;
const scene = (css, body) => `<div class="root"><style>${KIT}${css}</style>${body}</div>`;
const words = (text, start, step, cls = "r") =>
  text.split(" ").map((w, i) => `<span class="${cls}" style="--d:${(start + i * step).toFixed(3)}s">${w}</span>`).join(" ");
// typewriter: monospace text revealed char by char over `beats`
const typed = (text, startBeat, beats, extra = "") =>
  `<span class="tw" style="--d:${d(startBeat)};--n:${text.length};animation:type ${(beats * B).toFixed(3)}s steps(${text.length}) both;${extra}">${text}</span>`;
const TYPE = `@keyframes type{from{width:0}to{width:calc(var(--n) * 1ch)}}.tw{display:inline-block;overflow:hidden;white-space:nowrap;vertical-align:bottom}`;
// the mascot: Miraiclip's teal play tile with eyes
const mascot = (size, glasses = "") => `<div style="position:relative;width:${size}px;height:${size}px">
 <div style="position:absolute;inset:0;border-radius:${size * 0.28}px;background:var(--teal);border:${size * 0.04}px solid #06201c;box-shadow:${size * 0.05}px ${size * 0.06}px 0 #06201c"></div>
 <div style="position:absolute;left:${size * 0.2}px;top:${size * 0.24}px;width:${size * 0.2}px;height:${size * 0.2}px;border-radius:50%;background:#fff;border:${size * 0.025}px solid #06201c"><div style="position:absolute;right:12%;top:30%;width:42%;height:42%;border-radius:50%;background:#06201c"></div></div>
 <div style="position:absolute;right:${size * 0.2}px;top:${size * 0.24}px;width:${size * 0.2}px;height:${size * 0.2}px;border-radius:50%;background:#fff;border:${size * 0.025}px solid #06201c"><div style="position:absolute;right:12%;top:30%;width:42%;height:42%;border-radius:50%;background:#06201c"></div></div>
 <div style="position:absolute;left:${size * 0.4}px;top:${size * 0.52}px;width:0;height:0;border-left:${size * 0.24}px solid #06201c;border-top:${size * 0.15}px solid transparent;border-bottom:${size * 0.15}px solid transparent"></div>
 ${glasses}</div>`;

const S = [];

// S1 · 11:54 PM, bars 1-2 (8 beats)
S.push({ bars: 2, html: scene(`${TYPE}
.clock{position:absolute;left:150px;top:300px;font:700 300px 'Geist Mono',monospace;letter-spacing:-.06em;color:#eef3f21f}
.cap{position:absolute;left:160px;top:640px;font:500 34px 'Geist Mono',monospace;color:var(--muted)}
.note{position:absolute;right:120px;width:760px;padding:26px 30px;border-radius:26px;background:#1a2120f2;border:1px solid #ffffff1f;box-shadow:0 30px 80px #000c;display:flex;gap:22px;align-items:flex-start;animation:fromright .5s cubic-bezier(.2,.8,.2,1) both}
.ico{flex:none;width:68px;height:68px;border-radius:18px;background:var(--teal);display:flex;align-items:center;justify-content:center}
.who{font:600 28px Geist,sans-serif}.when{font:400 24px Geist,sans-serif;color:var(--muted);margin-left:12px}
.msg{margin-top:6px;font:500 34px Geist,sans-serif}
.push{animation:zoomout .5s cubic-bezier(.6,0,.4,1) both}
@keyframes zoomout{to{transform:scale(1.5);opacity:0;filter:blur(20px)}}`,
`<div class="grain"></div>
<div class="push" style="--d:${d(7.2)};position:absolute;inset:0">
<div class="clock f" style="--d:0s">11:54</div>
<div class="cap mono">${typed("PM · THE NIGHT BEFORE LAUNCH", 0.5, 2.5)}</div>
<div class="note" style="--d:${d(2)};top:120px"><div class="ico"><div style="border-left:26px solid #06201c;border-top:16px solid transparent;border-bottom:16px solid transparent;margin-left:6px"></div></div>
 <div><div><span class="who">Mira · Product</span><span class="when">now</span></div><div class="msg">we ship the SDK tomorrow!!</div></div></div>
<div class="note" style="--d:${d(4)};top:290px"><div class="ico" style="background:var(--coral)"><span style="font:800 34px Geist">J</span></div>
 <div><div><span class="who">Jay · Marketing</span><span class="when">now</span></div><div class="msg">...and we have no launch video</div></div></div>
<div class="note" style="--d:${d(5.5)};top:460px"><div class="ico" style="background:var(--amber)"><span style="font:800 34px Geist">?</span></div>
 <div><div><span class="who">Mira · Product</span><span class="when">now</span></div><div class="msg">can Claude make one? like, tonight?</div></div></div>
</div>`) });

// S2 · the prompt, bars 3-4
S.push({ bars: 2, html: scene(`${TYPE}
.term{position:absolute;left:210px;top:150px;width:1500px;height:780px;border-radius:30px;background:#0b0f0f;border:1px solid #ffffff1f;box-shadow:0 50px 140px #000;overflow:hidden;animation:boing .6s cubic-bezier(.2,.8,.2,1) both}
.bar{height:62px;display:flex;align-items:center;gap:12px;padding:0 26px;background:#141a19;border-bottom:1px solid #ffffff14}
.dot{width:16px;height:16px;border-radius:50%}
.ttl{margin-left:20px;font:500 24px 'Geist Mono',monospace;color:var(--muted)}
.body{padding:44px 56px;font:400 34px 'Geist Mono',monospace;line-height:1.7}
.dim{color:#5f6b69}
.box{margin-top:26px;padding:26px 32px;border-radius:18px;border:2px solid #2fd3b9aa;background:#2fd3b90d;font-size:40px}
.caret{display:inline-block;width:18px;height:46px;background:var(--teal);vertical-align:-8px;animation:blink 1.1s step-end infinite}
.tool{margin-top:22px;font-size:30px;color:#c6d1ce}
.key{position:absolute;right:290px;top:760px;padding:18px 34px;border-radius:18px;background:var(--ink);color:#0c1010;font:700 34px Geist;box-shadow:0 10px 0 #9aa7a4;animation:press .25s ease-out both}
@keyframes press{0%{transform:translateY(-30px);opacity:0}40%{transform:translateY(0);opacity:1;box-shadow:0 10px 0 #9aa7a4}70%{transform:translateY(8px);box-shadow:0 2px 0 #9aa7a4}100%{transform:translateY(0);box-shadow:0 10px 0 #9aa7a4}}`,
`<div class="grain"></div>
<div class="term" style="--d:0s"><div class="bar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><span class="ttl">~/launch-video · claude</span></div>
<div class="body"><div class="dim f" style="--d:${d(0.5)}">miraiclip plugin · 5 skills · MCP connected</div>
<div class="box"><span style="color:var(--teal)">&gt; </span>${typed("make a funky launch video for miraiclip.com", 1, 4.5)}<span class="caret"></span></div>
<div class="tool f" style="--d:${d(6.6)}"><span style="color:var(--teal)">●</span> Skill(launch-video)</div>
<div class="tool f" style="--d:${d(7.1)}"><span style="color:var(--teal)">●</span> miraiclip · apply_commands <span class="dim">(128 commands)</span></div>
</div></div>
<div class="key" style="--d:${d(6)}">⏎ enter</div>`) });

// S3 · the drop: mascot, bar 5 (4 beats)
S.push({ bars: 1, html: scene(`
.flash{position:absolute;inset:0;animation:flash ${(4 * B).toFixed(3)}s step-end both}
@keyframes flash{0%{background:#2fd3b9}25%{background:#ff6f5e}50%{background:#ffb423}75%{background:#39a7ff}}
.burst{position:absolute;left:50%;top:50%;width:2400px;height:2400px;margin:-1200px 0 0 -1200px;background:repeating-conic-gradient(#ffffff22 0 8deg,transparent 8deg 22deg);animation:spin ${(4 * B).toFixed(3)}s linear both}
@keyframes spin{to{transform:rotate(40deg)}}
.m{position:absolute;left:760px;top:240px;animation:boing .6s cubic-bezier(.2,.8,.2,1) both}
.bounce{animation:bob ${B.toFixed(3)}s cubic-bezier(.3,0,.3,1) infinite both}
@keyframes bob{0%{transform:translateY(0) scale(1.08,.92)}35%{transform:translateY(-40px) scale(.95,1.05)}100%{transform:translateY(0) scale(1.08,.92)}}
.shades{position:absolute;left:8%;top:18%;width:84%;height:30%;animation:dropin .4s cubic-bezier(.2,.8,.2,1) both}
.say{position:absolute;left:0;right:0;top:720px;text-align:center;font:900 190px Geist,sans-serif;letter-spacing:-.05em;color:#0c1010;text-shadow:8px 8px 0 #ffffff}`,
`<div class="flash" style="--d:0s"></div><div class="burst" style="--d:0s"></div>
<div class="m" style="--d:0s"><div class="bounce" style="--d:${d(0.5)}">${mascot(400, `<div class="shades" style="--d:${d(1)}"><div style="position:absolute;left:0;top:0;width:44%;height:100%;border-radius:18px 18px 40px 40px;background:#0c1010"></div><div style="position:absolute;right:0;top:0;width:44%;height:100%;border-radius:18px 18px 40px 40px;background:#0c1010"></div><div style="position:absolute;left:40%;right:40%;top:20%;height:12%;background:#0c1010"></div></div>`)}</div></div>
<div class="say"><span class="s" style="--d:${d(2)}">SAY</span> <span class="s" style="--d:${d(2.5)}">LESS.</span></div>`) });

// S4 · the timeline builds itself, bars 6-7 (8 beats)
const clipEl = (row, left, w, color, beat, label) =>
  `<div class="clip" style="--d:${d(beat)};top:${row * 118 + 12}px;left:${left}px;width:${w}px;background:${color}">${label}</div>`;
S.push({ bars: 2, html: scene(`
.h{position:absolute;left:120px;top:90px;font:700 76px Geist,sans-serif;letter-spacing:-.04em}
.tl{position:absolute;left:120px;top:250px;width:1680px;height:600px;border-radius:28px;background:#101414;border:1px solid var(--line);overflow:hidden}
.ruler{position:absolute;left:220px;right:0;top:0;height:56px;border-bottom:1px solid var(--line);background:repeating-linear-gradient(90deg,#ffffff26 0 2px,transparent 2px 145px);font:400 20px 'Geist Mono',monospace;color:var(--muted)}
.lab{position:absolute;left:0;width:220px;height:118px;padding:40px 28px;font:500 24px 'Geist Mono',monospace;color:var(--muted);border-right:1px solid var(--line)}
.rows{position:absolute;left:0;right:0;top:56px}
.lane{position:absolute;left:220px;right:0;height:118px;border-bottom:1px solid #ffffff0d}
.clip{position:absolute;height:94px;border-radius:16px;padding:30px 22px;font:600 26px Geist,sans-serif;color:#06201c;white-space:nowrap;overflow:hidden;border:3px solid #06201c;box-shadow:5px 6px 0 #06201c;animation:fromright .45s cubic-bezier(.2,.8,.2,1) both}
.ph{position:absolute;top:0;bottom:0;width:4px;background:#fff;box-shadow:0 0 30px var(--teal);animation:sweep ${(8 * B).toFixed(3)}s linear both}
@keyframes sweep{from{left:220px}to{left:1640px}}
.log{position:absolute;right:120px;top:880px;display:flex;gap:16px}
.chip{background:#141a19;border:1px solid var(--line)}`,
`<div class="grain"></div>
<div class="h">${words("Claude edits with commands.", 0, 0.12)}</div>
<div class="tl f" style="--d:0s"><div class="ruler"></div>
<div class="rows">
${["Video", "Overlay", "Captions", "Music"].map((n, i) => `<div class="lab" style="top:${i * 118}px">${n}</div><div class="lane" style="top:${i * 118}px"></div>`).join("")}
<div style="position:absolute;left:220px;right:0;top:0;bottom:0">
${clipEl(0, 20, 420, "var(--teal)", 0.5, "intro.mp4")}${clipEl(0, 460, 520, "var(--teal)", 1, "demo.mp4")}${clipEl(0, 1000, 420, "var(--teal)", 1.5, "outro.mp4")}
${clipEl(1, 120, 300, "var(--blue)", 2, "Title")}${clipEl(1, 700, 380, "var(--blue)", 2.5, "Lower third")}
${clipEl(2, 60, 260, "var(--amber)", 3, "Cut every")}${clipEl(2, 340, 260, "var(--amber)", 3.5, "silent")}${clipEl(2, 620, 260, "var(--amber)", 4, "pause")}
${clipEl(3, 0, 1420, "var(--coral)", 4.5, "funk.webm  ♪")}
</div></div><div class="ph" style="--d:0s"></div></div>
<div class="log"><span class="chip f" style="--d:${d(5)}"><span class="ok">✓</span>asset/add ×6</span><span class="chip f" style="--d:${d(5.5)}"><span class="ok">✓</span>clip/add ×14</span><span class="chip f" style="--d:${d(6)}"><span class="ok">✓</span>keyframe/set ×32</span><span class="chip f" style="--d:${d(6.5)}"><span class="ok">✓</span>preview_frame</span></div>`) });

// S5 · Introducing + real landing hero, bars 8-9
S.push({ bars: 2, html: scene(`
.intro{position:absolute;left:0;right:0;top:330px;text-align:center;font:500 46px 'Geist Mono',monospace;letter-spacing:.4em;color:var(--teal)}
.big{position:absolute;left:0;right:0;top:400px;text-align:center;font:900 250px Geist,sans-serif;letter-spacing:-.06em;line-height:1;text-shadow:10px 10px 0 #ff6f5e,20px 20px 0 #39a7ff}
.out1{animation:up .45s cubic-bezier(.6,0,.4,1) both}
@keyframes up{to{transform:translateY(-700px) scale(.6);opacity:0}}
.shot{position:absolute;left:260px;top:170px;width:1400px;border-radius:26px;overflow:hidden;border:1px solid #ffffff2a;box-shadow:0 60px 160px #000,0 0 0 10px #2fd3b922;animation:flyin .8s cubic-bezier(.2,.8,.2,1) both}
@keyframes flyin{0%{transform:perspective(1600px) translateY(700px) rotateX(55deg) scale(.7);opacity:0}100%{transform:perspective(1600px) rotateX(0) scale(1);opacity:1}}
.url{background:var(--teal);color:#06201c;font-weight:600}`,
`<div class="grain"></div>
<div class="out1" style="--d:${d(3.6)};position:absolute;inset:0">
<div class="intro f" style="--d:0s">INTRODUCING</div>
<div class="big">${"MIRAICLIP".split("").map((c, i) => `<span class="s" style="--d:${d(1 + i * 0.25)}">${c}</span>`).join("")}</div></div>
<div class="shot" style="--d:${d(4)}"><img src="asset:land-hero" style="display:block;width:1400px;height:788px"/></div>
<div style="position:absolute;right:24px;bottom:10px;font:400 16px 'Geist Mono',monospace;color:#9aa7a4">Big Buck Bunny © Blender Foundation · CC BY 3.0</div><div style="position:absolute;left:0;right:0;top:985px;text-align:center"><span class="chip url b" style="--d:${d(6)}">miraiclip.com</span></div>`) });

// S6 · theme montage overlay (the screenshots themselves are image clips), bars 10-11
const THEMES = [["Default", "#0f3b35"], ["Glass", "#2a1f6b"], ["Neon", "#b6ff2e"], ["Neobrutalism", "#ffd400"], ["Shadcn", "#f2f2f0"]];
const ORDER = [0, 1, 2, 3, 4, 0, 2, 3];
S.push({ bars: 2, html: scene(`
.bgc{position:absolute;inset:0;animation:bgc ${(8 * B).toFixed(3)}s step-end both}
@keyframes bgc{${ORDER.map((t, i) => `${(i * 12.5).toFixed(1)}%{background:${THEMES[t][1]}}`).join("")}}
.stripes{position:absolute;inset:0;background:repeating-linear-gradient(120deg,#00000014 0 40px,transparent 40px 80px)}`,
`<div class="bgc" style="--d:0s"></div><div class="stripes"></div>`), under: true });
const s6Overlay = scene(`
.title{position:absolute;left:0;right:0;top:40px;text-align:center;font:800 70px Geist,sans-serif;letter-spacing:-.04em;color:#0c1010}
.pill{position:absolute;left:0;right:0;bottom:44px;display:flex;justify-content:center;gap:14px}
.t{padding:14px 26px;border-radius:999px;background:#0c1010cc;color:#eef3f2;font:600 28px Geist;border:2px solid #0c1010}
.hl{animation:hl ${(8 * B).toFixed(3)}s step-end both}`,
`<div class="title"><span style="background:#fff;padding:6px 26px;border-radius:18px;border:4px solid #0c1010;box-shadow:6px 6px 0 #0c1010" class="b">5 themes. 1 engine.</span></div>
<div class="pill">${THEMES.map(([n], k) => {
  const frames = ORDER.map((t, i) => `${(i * 12.5).toFixed(1)}%{background:${t === k ? "#2fd3b9" : "#0c1010cc"};color:${t === k ? "#06201c" : "#eef3f2"}}`).join("");
  return `<style>@keyframes t${k}{${frames}}</style><span class="t" style="--d:0s;animation:t${k} ${(8 * B).toFixed(3)}s step-end both">${n}</span>`;
}).join("")}</div><div style="position:absolute;right:24px;bottom:8px;font:400 16px 'Geist Mono',monospace;color:#0c1010aa;background:#ffffffaa;padding:2px 8px;border-radius:6px">Big Buck Bunny © Blender Foundation · CC BY 3.0</div>`);

// S7 · prompt montage on paper, bars 12-13 (4 prompts, 2 beats each)
const PROMPTS = ["Cut the pauses in my podcast", "Add karaoke captions", "Reframe it for TikTok", "Make it funkier"];
const DONE = ["clip/split ×42 · 1 undo step", "caption ×18 · karaoke", "project/set-settings 9:16", "effect/add · grain + glow"];
S.push({ bars: 2, html: scene(`${TYPE}
.paper{position:absolute;inset:0;background:var(--paper)}
.dotsbg{position:absolute;inset:0;background-image:radial-gradient(#0c101018 2px,transparent 2px);background-size:36px 36px}
.box{position:absolute;left:360px;top:380px;width:1200px;padding:40px 46px;border-radius:30px;background:#fff;border:3px solid #0c1010;box-shadow:10px 12px 0 #0c1010;color:#0c1010;font:500 52px 'Geist Mono',monospace}
.send{position:absolute;right:30px;bottom:30px;width:64px;height:64px;border-radius:50%;background:#0c1010}
.done{position:absolute;left:360px;top:640px;background:#0c1010;color:var(--teal)}
.lbl{position:absolute;left:360px;top:300px;font:600 30px 'Geist Mono',monospace;color:#0c101099;letter-spacing:.15em}`,
`<div class="paper"></div><div class="dotsbg"></div><div class="lbl">ASK FOR ANYTHING</div>
${PROMPTS.map((p, i) => `<div class="${i < 3 ? "hide" : ""}" style="--d:${d(2 * i + 2)};position:absolute;inset:0"><div class="show" style="--d:${d(2 * i)};position:absolute;inset:0">
<div class="box" style="${i ? "" : "animation:boing .5s cubic-bezier(.2,.8,.2,1) both;--d:0s"}"><span style="color:#2fd3b9">&gt; </span>${typed(p, 2 * i, 1)}<div class="send"></div></div>
<span class="chip done b" style="--d:${d(2 * i + 1.1)}"><span class="ok">✓</span>${DONE[i]}</span></div></div>`).join("")}`) });

// S8 · proof from the landing page, bars 14-15
const CARDS = [["land-grid", 1600, 1243, "12 things on day one"], ["land-effects", 1600, 664, "79 effects"], ["land-cases", 1600, 1120, "Every format"]];
S.push({ bars: 2, html: scene(`
.big{position:absolute;left:110px;top:330px;width:760px;font:800 120px Geist,sans-serif;letter-spacing:-.05em;line-height:.98}
.card{position:absolute;left:880px;top:150px;width:940px;border-radius:24px;overflow:hidden;border:3px solid #eef3f2;box-shadow:16px 18px 0 #2fd3b9;animation:cardin .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes cardin{0%{transform:translate(400px,900px) rotate(25deg)}100%{transform:translate(0,0) rotate(var(--rot))}}
.tick{position:absolute;left:110px;top:240px;font:600 30px 'Geist Mono',monospace;color:var(--teal);letter-spacing:.15em}`,
`<div class="grain"></div><div class="tick f" style="--d:0s">WHAT YOU DON'T HAVE TO BUILD</div>
${CARDS.map(([id, w, h, label], i) => `<div class="card" style="--d:${d(2.6 * i)};--rot:${[-4, 3, -2][i]}deg;top:${[120, 230, 160][i]}px"><img src="asset:${id}" style="display:block;width:940px;height:${Math.round((940 * h) / w)}px"/></div>
<div class="${i < 2 ? "hide" : ""}" style="--d:${d(2.6 * i + 2.6)};position:absolute;inset:0"><div class="big">${words(label, 2.6 * i * B + 0.1, 0.1, "s")}</div></div>`).join("")}`) });

// S9 · export, bars 16-17 (bar 17 = breakdown with riser)
S.push({ bars: 2, html: scene(`
.btn{position:absolute;left:760px;top:450px;width:400px;height:130px;border-radius:999px;background:var(--ink);color:#0c1010;display:flex;align-items:center;justify-content:center;gap:18px;font:700 52px Geist;box-shadow:0 14px 0 #9aa7a4;animation:boing .5s cubic-bezier(.2,.8,.2,1) both}
.press{animation:pr .3s ease-out both}
@keyframes pr{0%{transform:translateY(0);box-shadow:0 14px 0 #9aa7a4}40%{transform:translateY(12px);box-shadow:0 2px 0 #9aa7a4}100%{transform:translateY(0);box-shadow:0 14px 0 #9aa7a4}}
.cur{position:absolute;width:0;height:0;border-left:26px solid transparent;border-right:26px solid transparent;border-bottom:64px solid #fff;filter:drop-shadow(0 6px 10px #000a);transform:rotate(-28deg);animation:curmove ${(1.8 * B).toFixed(3)}s cubic-bezier(.4,0,.2,1) both}
@keyframes curmove{from{left:1500px;top:900px}to{left:1010px;top:540px}}
.prog{position:absolute;left:460px;top:640px;width:1000px;height:26px;border-radius:13px;background:#ffffff1a;overflow:hidden}
.fill{height:100%;background:linear-gradient(90deg,var(--teal),var(--mint));transform-origin:left;animation:fillx ${(4.4 * B).toFixed(3)}s cubic-bezier(.5,0,.5,1) both}
@keyframes fillx{from{transform:scaleX(0)}}
@property --p{syntax:'&lt;integer&gt;';inherits:false;initial-value:0}
@keyframes pct{to{--p:100}}
.pct{position:absolute;left:460px;top:690px;font:500 34px 'Geist Mono',monospace;color:var(--muted);counter-reset:p var(--p);animation:pct ${(4.4 * B).toFixed(3)}s cubic-bezier(.5,0,.5,1) both}
.pct::after{content:'rendering · ' counter(p) '%'}
.fmt{position:absolute;top:200px;border-radius:22px;border:4px solid #0c1010;box-shadow:8px 9px 0 #0c1010;display:flex;flex-direction:column;justify-content:flex-end;padding:18px 20px;color:#0c1010;font:800 34px Geist}
.fmt small{font:500 22px 'Geist Mono',monospace}`,
`<div class="grain"></div>
<div class="btn" style="--d:0s"><div class="press" style="--d:${d(2)};display:flex;align-items:center;gap:18px">↑ Export</div></div>
<div class="cur" style="--d:${d(0.2)}"></div>
<div class="prog f" style="--d:${d(2.4)}"><div class="fill" style="--d:${d(2.4)}"></div></div>
<div class="pct" style="--d:${d(2.4)}"></div>
<div class="fmt b" style="--d:${d(4)};left:250px;width:420px;height:236px;background:var(--teal)"><small>16:9</small>YouTube</div>
<div class="fmt b" style="--d:${d(5)};left:1340px;top:120px;width:200px;height:356px;background:var(--coral)"><small>9:16</small>Reels</div>
<div class="fmt b" style="--d:${d(6)};left:1580px;top:250px;width:230px;height:230px;background:var(--amber)"><small>1:1</small>Feed</div>
<div class="f" style="--d:${d(7.3)};position:absolute;left:0;right:0;top:820px;text-align:center;font:600 40px Geist;color:var(--mint)">✓ exported · same pixels as the preview</div>`) });

// S10 · end card, bars 18-20 (drop at 18, final hit at 20)
const SEGS = ["Intro", "Day one", "Your stack", "Effects", "Use cases", "Why Miraiclip", "Editor kit", "Export"];
S.push({ bars: 2.6, html: scene(`
.logo{position:absolute;left:0;right:0;top:250px;display:flex;justify-content:center;align-items:center;gap:40px}
.wm{font:800 190px Geist,sans-serif;letter-spacing:-.06em}
.tag{position:absolute;left:0;right:0;top:520px;text-align:center;font:600 64px Geist,sans-serif;letter-spacing:-.03em;color:var(--muted)}
.tag b{color:var(--ink)}
.ctas{position:absolute;left:0;right:0;top:680px;display:flex;justify-content:center;gap:24px}
.c1{background:var(--teal);color:#06201c;font-family:Geist;font-weight:700;font-size:38px;padding:20px 40px}
.c2{background:#141a19;border:1px solid var(--line);color:var(--ink);font-size:34px;padding:20px 34px}
.tbar{position:absolute;left:0;right:0;bottom:0;height:96px;background:#0a0d0d;border-top:1px solid var(--line);display:flex;align-items:center;padding-left:250px;gap:8px}
.tc{position:absolute;left:30px;top:30px;font:500 30px 'Geist Mono',monospace;color:var(--ink)}
.seg{height:56px;flex:1;border-radius:6px;border:1px solid #ffffff22;padding:14px 12px;font:400 20px 'Geist Mono',monospace;color:var(--muted);white-space:nowrap;overflow:hidden}
.ph{position:absolute;bottom:8px;width:4px;height:80px;background:#fff;box-shadow:0 0 20px var(--teal);animation:sw ${(10 * B).toFixed(3)}s linear both}
@keyframes sw{from{left:250px}to{left:1910px}}
.glow{position:absolute;left:50%;top:330px;width:1400px;height:700px;margin-left:-700px;background:radial-gradient(closest-side,#2fd3b933,transparent);animation:thump ${B.toFixed(3)}s ease-out infinite both}`,
`<div class="glow" style="--d:0s"></div>
<div class="logo"><div class="b" style="--d:0s">${mascot(170)}</div><div class="wm"><span class="s" style="--d:${d(0.3)}">Miraiclip</span></div></div>
<div class="tag" style="--d:${d(1.5)};animation:fade .5s ease-out both">Build <b>video editors</b>, not video editor plumbing.</div>
<div class="ctas"><span class="chip c1 b" style="--d:${d(4)}">miraiclip.com</span><span class="chip c2 b" style="--d:${d(4.5)}">$ npm i @miraiclip/core</span></div>
<div class="tbar f" style="--d:${d(1)}"><span class="tc">00:00:42:12</span>${SEGS.map((s, i) => `<span class="seg" style="${i === SEGS.length - 1 ? "border-color:#2fd3b9;color:#2fd3b9;background:#2fd3b914" : ""}">${s}</span>`).join("")}<div class="ph" style="--d:${d(1)}"></div></div>`) });

// ---------- assemble ----------
const fonts = [
  { id: "geist", src: "Geist-Variable.woff2", family: "Geist" },
  { id: "geist-mono", src: "GeistMono-Variable.woff2", family: "Geist Mono" },
];
const DIMS = { "land-hero": { width: 1920, height: 1080 }, "land-grid": { width: 1600, height: 1243 }, "land-effects": { width: 1600, height: 664 }, "land-cases": { width: 1600, height: 1120 }, ed0: { width: 1600, height: 900 }, ed1: { width: 1600, height: 900 }, ed2: { width: 1600, height: 900 }, ed3: { width: 1600, height: 900 }, ed4: { width: 1600, height: 900 } };
const images = ["land-hero", "land-grid", "land-effects", "land-cases", "ed0", "ed1", "ed2", "ed3", "ed4"];
const C = [
  { type: "project/set-settings", payload: { width: 1920, height: 1080, fps: 30, name: "Miraiclip · funky launch" } },
  ...fonts.map((f) => ({ type: "asset/add", payload: { id: f.id, kind: "font", src: f.src, family: f.family, weightRange: [100, 900] } })),
  ...images.map((id) => ({ type: "asset/add", payload: { id, kind: "image", src: `${id}.jpg`, ...DIMS[id] } })),
  { type: "track/add", payload: { id: "scenes", kind: "video", name: "Scenes" } },
  { type: "track/add", payload: { id: "shots", kind: "video", name: "Screenshots" } },
  { type: "track/add", payload: { id: "over", kind: "video", name: "Overlays" } },
  { type: "track/add", payload: { id: "music", kind: "audio", name: "Music" } },
  { type: "track/add", payload: { id: "sfx", kind: "audio", name: "SFX" } },
];
let t = 0;
const starts = [];
S.forEach((s, i) => {
  const dur = us(s.bars * BAR);
  starts.push(t);
  C.push({ type: "clip/add", payload: { kind: "html", id: `s${i + 1}`, trackId: "scenes", startUs: t, durationUs: dur, animated: true, template: s.html } });
  t += dur;
});
const total = t;
// S6 screenshots: one image clip per beat, plus the overlay
const s6 = starts[5];
ORDER.forEach((theme, i) => {
  const id = `shot-${i + 1}`;
  C.push({ type: "clip/add", payload: { kind: "image", id, trackId: "shots", assetId: `ed${theme}`, startUs: s6 + us(i * B), durationUs: us(B), transform: { x: 0.5, y: 0.53, scale: 0.74, rotation: i % 2 ? 1.5 : -1.5 } } });
  C.push({ type: "keyframe/set", payload: { clipId: id, property: "scale", timeUs: 0, value: 0.8, easing: { kind: "bezier", x1: 0.2, y1: 0.8, x2: 0.2, y2: 1 } } });
  C.push({ type: "keyframe/set", payload: { clipId: id, property: "scale", timeUs: 180000, value: 0.74 } });
  C.push({ type: "effect/add", payload: { clipId: id, kind: "roundedCorners", effectId: "round", params: { radius: 0.03 } } });
});
C.push({ type: "clip/add", payload: { kind: "html", id: "s6-over", trackId: "over", startUs: s6, durationUs: us(8 * B), animated: true, template: s6Overlay } });
// audio
C.push({ type: "asset/add", payload: { id: "funk", kind: "audio", src: "funk.webm", durationUs: 44730000 } });
C.push({ type: "clip/add", payload: { kind: "audio", id: "music", trackId: "music", assetId: "funk", startUs: 0, durationUs: Math.min(total, 44730000), volume: 0.9, fadeOutUs: 1200000 } });
const SFX = { pop: 188000, whoosh: 908000, click: 58000, success: 1408000, ding: 2008000 };
for (const [k, len] of Object.entries(SFX)) C.push({ type: "asset/add", payload: { id: `sfx-${k}`, kind: "audio", src: `sfx-${k}.webm`, durationUs: len } });
const hits = [
  ["pop", starts[0] + us(2 * B)], ["pop", starts[0] + us(4 * B)], ["pop", starts[0] + us(5.5 * B)],
  ["click", starts[1] + us(6 * B)], ["whoosh", starts[1] + us(7.2 * B)],
  ["pop", starts[2]], ["whoosh", starts[4] + us(3.6 * B)], ["click", starts[8] + us(2 * B)],
  ["success", starts[8] + us(6.8 * B)], ["ding", starts[9] + us(4 * B)],
];
hits.forEach(([k, at], i) => C.push({ type: "clip/add", payload: { kind: "audio", id: `fx-${i + 1}`, trackId: "sfx", assetId: `sfx-${k}`, startUs: at, durationUs: SFX[k], volume: k === "click" ? 0.9 : 0.45 } }));

fs.writeFileSync("cmds.json", JSON.stringify(C));
console.log(`scenes ${S.length}, total ${(total / 1e6).toFixed(2)} s, commands ${C.length}, starts ${starts.map((s) => (s / 1e6).toFixed(2)).join(" ")}`);
