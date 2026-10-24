// Example 1 · Launch film (Launch → Product launch, 16:9 + 9:16, 24.4 s, four themes)
//
// An editable launch film: every visible word, both brand colours, the theme
// and the product screenshot are template fields. Built on the shared kit
// (../_kit.mjs): one template file per theme (midnight is this one's own, plus
// -paper, -terminal, -pop) and per format, into the studio's public/templates,
// and the plain projects next to this file.
//
//   node examples/templates/miraiclip-launch/build.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTemplates, paths, themeField, themeFonts } from "../_kit.mjs";

const ID = "miraiclip-launch";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asset, outDir } = paths(here, ID);
const text = (name, label, def, extra = {}) => ({ name, label, type: "text", default: def, ...extra });
const color = (name, label, def) => ({ name, label, type: "color", default: def });
const number = (name, label, def) => text(name, label, def, { pattern: "^[0-9]{1,4}$", description: "A whole number; it counts up from 0." });

const fields = [
  themeField("midnight"),
  color("primary", "Brand colour", "#8b7bff"),
  color("secondary", "Second colour", "#22d3ee"),
  text("brand", "Product name", "MIRAICLIP", { maxLength: 24 }),
  text("hookLine1", "Hook · line 1", "Build video editors,", { maxLength: 28 }),
  text("hookLine2", "Hook · line 2 (gradient)", "not video editor plumbing.", { maxLength: 30 }),
  { name: "shot", label: "Product screenshot", type: "asset", assetId: "shot", default: asset("product.jpg"), description: "A 16:9 screenshot of your product (1600×900 or larger)." },
  text("revealTitle", "Reveal · headline", "See every frame you ship.", { maxLength: 34 }),
  text("chip1", "Reveal · callout 1", "60 fps preview", { maxLength: 22 }),
  text("chip2", "Reveal · callout 2", "Exact undo", { maxLength: 22 }),
  text("credit", "Reveal · image credit", "Big Buck Bunny © Blender Foundation, CC BY 3.0", { maxLength: 70, description: "Credit for anything shown in the screenshot; leave empty if none." }),
  text("featureTitle", "Feature · headline", "Every edit is a command.", { maxLength: 32 }),
  text("featureSub", "Feature · subline", "Validated. Undoable. Serializable.", { maxLength: 44 }),
  text("code1", "Feature · code line 1", "project.dispatch({"),
  text("code2", "Feature · code line 2", '  type: "clip/add",'),
  text("code3", "Feature · code line 3", '  payload: { kind: "text", text: "Hi" }'),
  text("code4", "Feature · code line 4", "})"),
  text("code5", "Feature · code line 5", "project.undo()  // exact history"),
  text("chip", "Feature · key chip", "⌘Z", { maxLength: 4 }),
  text("proofTitle", "Proof · headline", "Built for real projects.", { maxLength: 32 }),
  number("stat1", "Proof · number 1", "79"),
  text("unit1", "Proof · unit 1", "", { maxLength: 4 }),
  text("label1", "Proof · label 1", "effects built in, rendered on the GPU", { maxLength: 48 }),
  number("stat2", "Proof · number 2", "125"),
  text("unit2", "Proof · unit 2", "min", { maxLength: 4 }),
  text("label2", "Proof · label 2", "timeline with 4,464 clips, tested end to end", { maxLength: 48 }),
  number("stat3", "Proof · number 3", "60"),
  text("unit3", "Proof · unit 3", "fps", { maxLength: 4 }),
  text("label3", "Proof · label 3", "smooth playback, even two hours in", { maxLength: 48 }),
  text("pillarTitle", "Pillar · headline", "Timeline. Preview. Export.", { maxLength: 32 }),
  text("pillarSub", "Pillar · subline", "One engine, the same pixels everywhere.", { maxLength: 48 }),
  text("aiTitle", "AI · headline", "Let Claude edit.", { maxLength: 22 }),
  text("aiSub", "AI · subline", "An MCP server and skills. Claude sees every frame it changes.", { maxLength: 70 }),
  text("prompt", "AI · prompt bubble", "Cut the pauses, add karaoke captions and a lower third.", { maxLength: 64 }),
  text("step1", "AI · step 1", "get_state"),
  text("step1Note", "AI · step 1 note", ""),
  text("step2", "AI · step 2", "apply_commands"),
  text("step2Note", "AI · step 2 note", "· 42 commands"),
  text("step3", "AI · step 3", "preview_frame"),
  text("step3Note", "AI · step 3 note", "· 4 checks"),
  text("step4", "AI · step 4", "export"),
  text("step4Note", "AI · step 4 note", "· final.mp4"),
  text("wordmark", "End card · wordmark", "miraiclip", { maxLength: 16 }),
  text("tagline", "End card · tagline", "The engine for video editors in the browser.", { maxLength: 56 }),
  text("cta", "End card · button", "docs.miraiclip.com", { maxLength: 28 }),
];

// Waveform bars for the music track in the timeline mock (decoration).
const bars = Array.from({ length: 64 }, (_, i) => `<i style="height:${18 + Math.round(30 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .43)))}px"></i>`).join("");

// 9:16 overrides, per scene (1080×1920, 80 px side margins).
const V = {
  hook: `.wrap{left:80px;top:700px;width:920px}.h1{font-size:calc(96px * var(--ds))}.bar{width:420px}.orb{left:200px;top:1150px}`,
  reveal: `.t{top:400px;left:80px;width:920px;font-size:calc(72px * var(--ds));line-height:1.08}
.rig{left:90px;top:840px;width:900px;height:550px}.win img{width:900px;height:506px}
.c1{left:-10px;top:-100px}.c2{right:-10px;bottom:-110px}.credit{right:60px;bottom:60px}`,
  feature: `.l{left:80px;top:420px;width:920px}.h2{font-size:calc(84px * var(--ds))}
.card{left:80px;top:880px;width:920px;padding:40px}.ln{font-size:26px}.chip{left:820px;top:1180px}`,
  proof: `.t{top:300px;left:80px;width:920px;font-size:calc(72px * var(--ds));line-height:1.08}
.row{left:80px;top:530px;flex-direction:column;gap:32px}.card{width:920px;height:380px}.num{font-size:140px}`,
  pillar: `.t{left:80px;top:520px;width:920px;font-size:calc(80px * var(--ds));line-height:1.05}.sub{left:80px;top:740px;width:920px}
.tlw{left:80px;top:940px;transform:scale(.575)}`,
  ai: `.t{left:80px;top:360px;width:920px;font-size:calc(104px * var(--ds))}.sub{left:80px;top:610px;width:920px}
.chat{left:80px;top:880px;width:920px}.me{width:760px}`,
  end: `.wm{font-size:calc(150px * var(--ds))}.glow{left:40px;top:560px;width:1000px;height:640px}.tag{font-size:38px;width:900px;text-align:center}`,
};

// ── Scenes: HTML + CSS with {{param}} placeholders, written with the kit's
// theme variables so every theme works. Each lists the fields it uses.
const SCENES = [];
const add = (seconds, uses, css, body, opts = {}) => SCENES.push({ seconds, uses, css, body, vertical: opts.vertical, last: opts.last });

// 1 · Hook — tracking-in eyebrow, springy first line, wipe + shimmer on the
// gradient line, an accent bar that snaps out under it, a drifting glow.
add(3.2, ["primary", "secondary", "brand", "hookLine1", "hookLine2"],
  `.wrap{position:absolute;left:160px;top:330px}
.h1{font-size:calc(118px * var(--ds));line-height:1.06}
@keyframes track{from{letter-spacing:.9em;opacity:0;filter:blur(6px)}}
.eyebrow{animation:track 1.1s var(--out) both}
.l2{display:inline-block;animation:reveal 1s cubic-bezier(.65,0,.35,1) both,shimmer 3.2s linear infinite}
.bar{margin-top:34px;width:560px;height:10px;border-radius:5px;background:linear-gradient(90deg,{{primary}},{{secondary}});transform-origin:left center;animation:grow 1s var(--spring) both}
@keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(-120px,60px) scale(1.15)}}
.orb{position:absolute;left:1180px;top:120px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,{{secondary}} 34%,transparent) 0%,transparent 65%);animation:drift 3.2s ease-in-out both}
.t-paper .orb,.t-pop .orb,.t-terminal .orb{display:none}`,
  `<div class="orb" style="--d:0s"></div>
<div class="wrap"><div class="eyebrow" style="--d:.05s">{{brand}}</div><div style="height:28px"></div>
<div class="h1 disp r" style="--d:.2s">{{hookLine1}}</div>
<div class="h1 disp grad l2" style="--d:.7s">{{hookLine2}}</div>
<div class="bar" style="--d:1.35s"></div></div>`, { vertical: V.hook });

// 2 · Product reveal — the screenshot rises out of the floor in 3D and settles
// while the camera keeps dollying across it; the headline lands while the
// window is still moving (overlapping beats) and two callouts pop out in
// front of it and float. (No preserve-3d here: with it the rasterizer
// sometimes drew a stale copy of a layer, a duplicate callout or a dark
// panel; the flattened rig still reads as 3D.)
add(3.6, ["primary", "secondary", "revealTitle", "chip1", "chip2", "credit"],
  `.t{position:absolute;left:0;width:1920px;top:96px;text-align:center;font-size:calc(76px * var(--ds));}
.stage{position:absolute;inset:0;perspective:2200px;perspective-origin:50% 30%}
@keyframes dolly{from{transform:rotateY(-7deg) rotateX(4deg) scale(1)}to{transform:rotateY(4deg) rotateX(2deg) scale(1.05)}}
.rig{position:absolute;left:330px;top:250px;width:1260px;height:752px;animation:dolly 3.6s cubic-bezier(.4,0,.6,1) both}
@keyframes rise3d{from{transform:translateY(300px) rotateX(46deg) scale(.82)}}
.win{position:absolute;inset:0;border-radius:var(--r);overflow:hidden;background:var(--surface);border:var(--border);box-shadow:var(--shadow),var(--glow);transform-origin:50% 100%;animation:rise3d 1.4s var(--spring) both,clear .7s var(--out) both}
.bar{height:44px;display:flex;align-items:center;gap:10px;padding:0 18px;background:var(--surface2);border-bottom:var(--border)}
.bar i{width:13px;height:13px;border-radius:50%;background:color-mix(in srgb,var(--ink) 20%,transparent)}
.win img{display:block;width:1260px;height:708px;object-fit:cover}
@keyframes glint{0%,40%{transform:translateX(-140%) skewX(-18deg)}100%{transform:translateX(160%) skewX(-18deg)}}
.win::after{content:'';position:absolute;top:0;bottom:0;width:40%;background:linear-gradient(90deg,transparent,#ffffff1c,transparent);animation:glint 2.2s ease-in-out both}
@keyframes floaty{from{transform:translateY(0)}to{transform:translateY(-14px)}}
.chips{position:absolute;inset:0;animation:floaty 1.8s ease-in-out infinite alternate}
.chip{position:absolute;display:flex;align-items:center;gap:14px;padding:18px 26px;border-radius:var(--rs);background:var(--surface);border:var(--border);font-size:30px;font-weight:600;box-shadow:var(--shadow);animation:popIn .8s var(--spring) both,clear .4s var(--out) both}
.chip b{width:16px;height:16px;border-radius:50%;background:{{secondary}};box-shadow:0 0 18px {{secondary}}}
.c1{left:-70px;top:120px;transform-origin:100% 50%}.c2{right:-150px;bottom:70px;transform-origin:0 50%}
.c2 b{background:{{primary}};box-shadow:0 0 18px {{primary}}}
.credit{position:absolute;right:40px;bottom:22px;font-size:18px;color:var(--dim)}`,
  `<div class="t disp r" style="--d:.85s">{{revealTitle}}</div>
<div class="stage"><div class="rig" style="--d:0s">
<div class="win" style="--d:.1s"><div class="bar"><i></i><i></i><i></i></div><img src="asset:shot" alt=""/></div>
<div class="chips" style="--d:0s"><div class="chip c1" style="--d:1.35s"><b></b>{{chip1}}</div><div class="chip c2" style="--d:1.6s"><b></b>{{chip2}}</div></div>
</div></div>
<div class="credit f" style="--d:1s">{{credit}}</div>`, { vertical: V.reveal });

// 3 · Feature — headline lands, the code card swings in on Y, lines type out
// with a blinking caret, then the key chip pops and is "pressed".
add(3.6, ["primary", "secondary", "featureTitle", "featureSub", "code1", "code2", "code3", "code4", "code5", "chip"],
  `.l{position:absolute;left:160px;top:360px;width:680px}.h2{font-size:calc(92px * var(--ds));line-height:1.05}.sub{margin-top:36px;font-size:36px;color:var(--muted);font-weight:500}
.card{position:absolute;left:900px;top:300px;width:860px;padding:44px 48px;border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:var(--shadow)}
@keyframes type{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.ln{display:table;font-size:28px;line-height:1.75;white-space:pre;color:var(--ink);animation:type .45s steps(26,end) both}
.ln.k{color:{{primary}}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
.caret{display:inline-block;width:14px;height:30px;margin-left:6px;vertical-align:-5px;background:{{secondary}};animation:blink 1s steps(1) infinite}
@keyframes press{0%{transform:scale(.55);opacity:0}28%{transform:scale(1.08);opacity:1}42%{transform:scale(1)}68%{transform:scale(1)}76%{transform:scale(.88);box-shadow:0 0 0 0 color-mix(in srgb,{{secondary}} 60%,transparent)}100%{transform:scale(1);box-shadow:0 0 0 26px transparent}}
.chip{position:absolute;left:1660px;top:600px;padding:14px 26px;border-radius:999px;background:{{secondary}};color:#04121a;font-weight:800;font-size:30px;animation:press 1.3s var(--out) both}`,
  `<div class="l"><div class="h2 disp r" style="--d:.1s">{{featureTitle}}</div><div class="sub r" style="--d:.55s">{{featureSub}}</div></div>
<div class="card ty" style="--d:.3s">
<div class="ln mono k" style="--d:.75s">{{code1}}</div>
<div class="ln mono" style="--d:1.0s">{{code2}}</div>
<div class="ln mono" style="--d:1.25s">{{code3}}</div>
<div class="ln mono k" style="--d:1.5s">{{code4}}</div>
<div class="ln mono" style="--d:1.8s">{{code5}}<span class="caret"></span></div>
</div><div class="chip mono" style="--d:2.1s">{{chip}}</div>`, { vertical: V.feature });

// 4 · Proof — cards spring up in sequence, numbers count and come into focus,
// meters fill, and a light sweep crosses each card once. (Blur sits on the
// .grad wrapper: a filter on the number itself drops it out of the
// gradient's background-clip:text and the digits vanish.)
add(3.4, ["primary", "secondary", "proofTitle", "stat1", "unit1", "label1", "stat2", "unit2", "label2", "stat3", "unit3", "label3"],
  `@property --n{syntax:'&lt;integer&gt;';inherits:false;initial-value:0}
@keyframes count{from{--n:0}to{--n:var(--to)}}
.card .grad{animation:clear 1s var(--out) both}
.t{position:absolute;left:0;width:1920px;top:190px;text-align:center;font-size:calc(80px * var(--ds));}
.row{position:absolute;left:160px;top:420px;display:flex;gap:40px}
.card{position:relative;overflow:hidden;width:507px;height:400px;border-radius:32px;background:var(--surface);border:var(--border);padding:56px 48px;animation:lift 1s var(--spring) both,clear .6s var(--out) both}
@keyframes shine{0%,45%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
.card::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,color-mix(in srgb,var(--ink) 9%,transparent) 50%,transparent 65%);animation:shine 1.8s ease-in-out both}
.num{font-weight:800;font-size:150px;line-height:1;letter-spacing:-.04em;counter-reset:n var(--n);animation:count 1.5s var(--out) both}
.num::after{content:counter(n)}.u{font-size:64px;margin-left:6px}
.lab{margin-top:28px;font-size:32px;line-height:1.35;color:var(--muted);font-weight:500}
.meter{position:absolute;left:48px;right:48px;bottom:44px;height:6px;border-radius:3px;background:color-mix(in srgb,var(--ink) 10%,transparent);overflow:hidden}
.meter b{display:block;height:100%;background:linear-gradient(90deg,{{primary}},{{secondary}});transform-origin:left center;animation:grow 1.4s var(--out) both}`,
  `<div class="t disp r" style="--d:.05s">{{proofTitle}}</div>
<div class="row">
<div class="card" style="--d:.3s"><div class="grad" style="--d:.45s"><span class="num" style="--to:{{stat1}};--d:.45s"></span><span class="u">{{unit1}}</span></div><div class="lab">{{label1}}</div><div class="meter"><b style="--d:.7s"></b></div></div>
<div class="card" style="--d:.42s"><div class="grad" style="--d:.57s"><span class="num" style="--to:{{stat2}};--d:.57s"></span><span class="u">{{unit2}}</span></div><div class="lab">{{label2}}</div><div class="meter"><b style="--d:.85s"></b></div></div>
<div class="card" style="--d:.54s"><div class="grad" style="--d:.69s"><span class="num" style="--to:{{stat3}};--d:.69s"></span><span class="u">{{unit3}}</span></div><div class="lab">{{label3}}</div><div class="meter"><b style="--d:1.0s"></b></div></div>
</div>`, { vertical: V.proof });

// 5 · Pillar — the timeline panel tips up from flat, clips snap onto their
// tracks, the playhead sweeps and the music track's waveform breathes.
// The clip names are illustration, not copy: fixed.
add(3.6, ["primary", "secondary", "pillarTitle", "pillarSub"],
  `.t{position:absolute;left:160px;top:150px;font-size:calc(84px * var(--ds));}.sub{position:absolute;left:160px;top:260px;font-size:34px;color:var(--muted);font-weight:500}
.tlw{position:absolute;left:160px;top:400px;transform-origin:0 0}
.tl{position:relative;width:1600px;height:500px;border-radius:var(--r);background:var(--surface);border:var(--border);padding:40px;overflow:hidden;box-shadow:var(--shadow)}
.ruler{height:28px;border-bottom:var(--border);margin-bottom:26px;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--ink) 22%,transparent) 0 2px,transparent 2px 76px)}
.trk{position:relative;height:84px;margin-bottom:22px;border-radius:var(--rs);background:color-mix(in srgb,var(--ink) 7%,transparent)}
.clip{position:absolute;top:8px;height:68px;border-radius:var(--rs);transform-origin:left center;animation:grow .7s var(--out) both;font-size:24px;font-weight:600;padding:20px 18px;color:#0a0d18;white-space:nowrap;overflow:hidden}
.v{background:{{primary}}}.o{background:{{secondary}}}.m{background:#f9a8d4}
.wave{position:absolute;left:150px;right:14px;top:14px;bottom:14px;display:flex;align-items:center;gap:6px}
@keyframes breathe{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
.wave i{flex:1;border-radius:3px;background:#0a0d1859;animation:breathe .42s ease-in-out infinite alternate}
.wave i:nth-child(3n){animation-duration:.55s}.wave i:nth-child(3n+1){animation-duration:.37s}.wave i:nth-child(4n){animation-duration:.61s}
@keyframes sweep{from{left:40px}to{left:1520px}}
.ph{position:absolute;top:24px;width:4px;height:450px;background:var(--ink);border-radius:2px;box-shadow:0 0 24px {{secondary}};animation:sweep 3s cubic-bezier(.45,0,.55,1) both}
.ph::before{content:'';position:absolute;left:-9px;top:-6px;width:22px;height:16px;border-radius:4px;background:var(--ink)}`,
  `<div class="t disp r" style="--d:.05s">{{pillarTitle}}</div><div class="sub r" style="--d:.4s">{{pillarSub}}</div>
<div class="tlw"><div class="tl tx" style="--d:.15s"><div class="ruler"></div>
<div class="trk"><div class="clip v" style="left:0px;width:520px;--d:.55s">intro.mp4</div><div class="clip v" style="left:540px;width:640px;--d:.67s">demo.mp4</div><div class="clip v" style="left:1200px;width:320px;--d:.79s">outro.mp4</div></div>
<div class="trk"><div class="clip o" style="left:120px;width:380px;--d:.9s">Lower third</div><div class="clip o" style="left:760px;width:460px;--d:1.0s">Captions</div></div>
<div class="trk"><div class="clip m" style="left:0px;width:1520px;--d:1.1s">music.mp3<div class="wave">${bars}</div></div></div>
<div class="ph" style="--d:.5s"></div></div></div>`, { vertical: V.pillar });

// 6 · AI — the prompt bubble pops from its tail, then each tool row slides in
// with a spinner that resolves into a check.
const tool = (n, d) => `<div class="tool" style="--d:${d.toFixed(2)}s"><div class="st"><div class="sw" style="--d:${(d + .4).toFixed(2)}s"><div class="ring" style="--d:0s"></div></div><div class="ok" style="--d:${(d + .4).toFixed(2)}s">✓</div></div><span class="mono">{{step${n}}}</span><span class="dim">{{step${n}Note}}</span></div>`;
add(3.6, ["primary", "secondary", "aiTitle", "aiSub", "prompt", "step1", "step1Note", "step2", "step2Note", "step3", "step3Note", "step4", "step4Note"],
  `.t{position:absolute;left:160px;top:380px;width:640px;font-size:calc(110px * var(--ds));line-height:1.02;}
.sub{position:absolute;left:160px;top:640px;width:620px;font-size:34px;line-height:1.4;color:var(--muted);font-weight:500}
.chat{position:absolute;left:900px;top:200px;width:860px}
.me{margin-left:auto;width:640px;padding:30px 36px;border-radius:30px 30px 8px 30px;background:{{primary}};font-size:34px;font-weight:600;line-height:1.35;transform-origin:100% 100%;box-shadow:0 24px 60px color-mix(in srgb,{{primary}} 35%,transparent)}
@keyframes slideIn{from{transform:translateX(90px)}}
.tool{display:flex;align-items:center;gap:22px;margin-top:22px;padding:24px 30px;border-radius:var(--rs);background:var(--surface);border:var(--border);font-size:30px;color:var(--ink);animation:slideIn .9s var(--spring) both,clear .5s var(--out) both}
.st{position:relative;width:44px;height:44px;flex:none}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes gone{to{opacity:0;transform:scale(.6)}}
.sw{position:absolute;inset:0;animation:gone .18s ease-in both}
.ring{position:absolute;inset:4px;border-radius:50%;border:4px solid color-mix(in srgb,var(--ink) 18%,transparent);border-top-color:{{secondary}};animation:spin .7s linear infinite}
.ok{position:absolute;inset:0;border-radius:50%;background:{{secondary}};color:#04121a;font-weight:900;font-size:26px;display:flex;align-items:center;justify-content:center;animation:popIn .7s var(--spring) both,clear .3s var(--out) both}
.dim{color:var(--dim)}`,
  `<div class="t disp r" style="--d:.05s">{{aiTitle}}</div><div class="sub r" style="--d:.5s">{{aiSub}}</div>
<div class="chat"><div class="me p" style="--d:.35s"><span class="f" style="--d:.55s">{{prompt}}</span></div>
${tool(1, 1.0)}
${tool(2, 1.25)}
${tool(3, 1.5)}
${tool(4, 1.75)}</div>`, { vertical: V.ai });

// 7 · End card — a glow blooms, the wordmark springs into focus, the dot
// drops in with a bounce, and the button pulses three times. Holds to the end.
add(3.4, ["primary", "secondary", "wordmark", "tagline", "cta"],
  `.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
@keyframes bloom{from{transform:scale(.5);opacity:0}}
.glow{position:absolute;left:460px;top:140px;width:1000px;height:640px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,{{primary}} 30%,transparent),transparent);animation:bloom 1.4s var(--out) both}
@keyframes focusIn{from{transform:scale(.86);opacity:0;filter:blur(18px)}}
.wm{position:relative;font-size:calc(180px * var(--ds));animation:focusIn 1s var(--out) both}
@keyframes drop{from{transform:translateY(-170px)}}
.dot{display:inline-block;width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,{{primary}},{{secondary}});margin-left:10px;animation:drop .9s var(--bounce) both,fadein .2s linear both}
.tag{margin-top:18px;font-size:42px;color:var(--muted);font-weight:500}
.btn{position:relative;margin-top:70px}
.cta{padding:26px 54px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-weight:700;font-size:40px}
@keyframes pulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.35,1.8);opacity:0}}
.ping{position:absolute;inset:0;border-radius:999px;border:3px solid {{secondary}};animation:pulse 1.1s ease-out 3 both}`,
  `<div class="glow" style="--d:.05s"></div>
<div class="c"><div class="wm disp" style="--d:.1s">{{wordmark}}<span class="dot" style="--d:.55s"></span></div>
<div class="tag r" style="--d:.6s">{{tagline}}</div>
<div class="btn r" style="--d:.85s"><div class="ping" style="--d:1.45s"></div><div class="cta">{{cta}}</div></div></div>`, { last: true, vertical: V.end });

buildTemplates({
  id: ID,
  name: "Launch film",
  description: "A 24-second product launch: hook, a 3D product-screenshot reveal, feature with code, three counting stats, product pillar, AI steps and an end card. Every word, both colours, the screenshot and the theme are fields.",
  category: "launch",
  tags: ["launch", "product-launch", "kinetic-type", "saas", "dev-tools"],
  fields,
  scenes: SCENES,
  themes: ["midnight", "paper", "terminal", "pop"],
  assets: [
    ...themeFonts(asset),
    // The product screenshot, drawn by the reveal scene through `asset:shot`.
    { id: "shot", kind: "image", src: asset("product.jpg"), width: 1600, height: 900, name: "Product screenshot",
      license: { id: "CC-BY-3.0", url: "https://creativecommons.org/licenses/by/3.0/", commercial: true, attributionRequired: true },
      attribution: "Miraiclip editor showing Big Buck Bunny © Blender Foundation, CC BY 3.0" },
  ],
  here,
  outDir,
});
