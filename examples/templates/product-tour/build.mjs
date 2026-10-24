// Example 5 · Product tour (Show how it works → Walkthrough, 16:9 + 9:16, 21.6 s, four themes)
//
// A guided tour of a product from one screenshot: a spotlight walks three
// areas with captions, numbered hotspots pop onto the screen, an automation
// runs step by step, and the same flow plays on a phone. Built on the shared
// kit (../_kit.mjs) with scenes adapted from the studio's built-in Spotlight
// tour, Feature hotspots, Automation run and App walkthrough (taps).
// Pop is this template's own theme; -midnight, -paper and -terminal variants too.
//
//   node examples/templates/product-tour/build.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTemplates, color, paths, text, themeField, themeFonts } from "../_kit.mjs";

const ID = "product-tour";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asset, outDir } = paths(here, ID);
const C = ["primary", "secondary"];

const fields = [
  themeField("pop"),
  color("primary", "Brand colour", "#ff6b3d"),
  color("secondary", "Second colour", "#1fa8e0"),
  { name: "shot", label: "Product screenshot", type: "asset", assetId: "shot", default: asset("product.jpg", "miraiclip-launch"), description: "A 16:9 screenshot of your product (1600×900 or larger). The spotlight and hotspots point at its left-middle, right and bottom areas." },
  text("app", "Product name", "Miraiclip Studio", { maxLength: 24 }),
  text("hook1", "Hook · line 1", "Meet your new editor.", { maxLength: 28 }),
  text("hook2", "Hook · line 2 (accent)", "Here's the tour.", { maxLength: 28 }),
  text("spTitle", "Spotlight · headline", "Everything in one window.", { maxLength: 32 }),
  text("sp1", "Spotlight · caption 1", "Live preview, frame-accurate", { maxLength: 34 }),
  text("sp2", "Spotlight · caption 2", "Assistant that edits for you", { maxLength: 34 }),
  text("sp3", "Spotlight · caption 3", "A real multi-track timeline", { maxLength: 34 }),
  text("credit", "Spotlight · image credit", "Big Buck Bunny © Blender Foundation, CC BY 3.0", { maxLength: 70, description: "Credit for anything shown in the screenshot; leave empty if none." }),
  text("hsTitle", "Hotspots · headline", "Three things to try first.", { maxLength: 32 }),
  text("hs1", "Hotspot 1", "Drop in a recording", { maxLength: 26 }),
  text("hs2", "Hotspot 2", "Ask for captions", { maxLength: 26 }),
  text("hs3", "Hotspot 3", "Export in one click", { maxLength: 26 }),
  text("wfTitle", "Workflow · headline", "Set it up once. It runs forever.", { maxLength: 36 }),
  text("n1", "Workflow · step 1", "New recording", { maxLength: 18 }),
  text("n1k", "Workflow · step 1 kind", "Trigger", { maxLength: 12 }),
  text("n2", "Workflow · step 2", "Cut the pauses", { maxLength: 18 }),
  text("n2k", "Workflow · step 2 kind", "Action", { maxLength: 12 }),
  text("n3", "Workflow · step 3", "Add captions", { maxLength: 18 }),
  text("n3k", "Workflow · step 3 kind", "Action", { maxLength: 12 }),
  text("n4", "Workflow · step 4", "Post to Slack", { maxLength: 18 }),
  text("n4k", "Workflow · step 4 kind", "Share", { maxLength: 12 }),
  text("wfDone", "Workflow · result", "Ran in 1.2 s", { maxLength: 22 }),
  text("phTitle", "Mobile · headline", "Same flow, in your pocket.", { maxLength: 30 }),
  text("phSub", "Mobile · subline", "Review, trim and share from your phone.", { maxLength: 60 }),
  text("phHello", "Mobile · screen title", "Your videos", { maxLength: 20 }),
  text("v1", "Mobile · video 1", "Launch film", { maxLength: 20 }),
  text("v2", "Mobile · video 2", "Weekly update", { maxLength: 20 }),
  text("v3", "Mobile · video 3", "Onboarding", { maxLength: 20 }),
  text("phAction", "Mobile · sheet action", "Shared with your team", { maxLength: 28 }),
  text("wordmark", "End card · wordmark", "Miraiclip Studio", { maxLength: 18 }),
  text("tagline", "End card · tagline", "Make the video. Skip the editor.", { maxLength: 48 }),
  text("cta", "End card · button", "Start free", { maxLength: 28 }),
];

// The product window (screenshot in a browser-like frame), shared by scenes 2 and 3.
// Image area 1260×708; regions below are in that space.
const WIN = `.win{position:absolute;left:330px;top:250px;width:1260px;height:752px;border-radius:var(--r);overflow:hidden;background:var(--surface);border:var(--border);box-shadow:var(--shadow),var(--glow)}
.bar{height:44px;display:flex;align-items:center;gap:10px;padding:0 18px;background:var(--surface2);border-bottom:var(--border)}
.bar i{width:13px;height:13px;border-radius:50%;background:color-mix(in srgb,var(--ink) 22%,transparent)}
.win img{display:block;width:1260px;height:708px;object-fit:cover}
.credit{position:absolute;right:40px;bottom:22px;font-size:18px;color:var(--dim)}`;
const WIN_V = `.win{left:60px;top:640px;width:960px;height:584px}.win img{width:960px;height:540px}.credit{right:60px;bottom:60px}`;
const WIN_HTML = `<div class="bar"><i></i><i></i><i></i></div><img src="asset:shot" alt=""/>`;

const scenes = [
  // 1 · Hook
  {
    seconds: 2.8, uses: [...C, "app", "hook1", "hook2"],
    css: `.wrap{position:absolute;left:160px;top:360px}
.h1{font-size:calc(124px * var(--ds));line-height:1.04}
@keyframes track{from{letter-spacing:.9em;opacity:0;filter:blur(6px)}}
.eyebrow{animation:track 1.1s var(--out) both}
.l2{display:inline-block;animation:reveal .9s cubic-bezier(.65,0,.35,1) both,shimmer 3.2s linear infinite}
@keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(-120px,60px) scale(1.15)}}
.orb{position:absolute;left:1180px;top:120px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,{{secondary}} 34%,transparent) 0%,transparent 65%);animation:drift 2.8s ease-in-out both}
.t-paper .orb,.t-pop .orb,.t-terminal .orb{display:none}`,
    body: `<div class="orb" style="--d:0s"></div><div class="wrap"><div class="eyebrow" style="--d:.05s">{{app}}</div><div style="height:26px"></div>
<div class="h1 disp r" style="--d:.15s">{{hook1}}</div><div class="h1 disp grad l2" style="--d:.6s">{{hook2}}</div></div>`,
    vertical: `.wrap{left:80px;top:720px;width:920px}.h1{font-size:calc(104px * var(--ds))}`,
  },
  // 2 · Spotlight — the window lands, the room dims, and a spotlight glides
  // from area to area with a caption for each.
  {
    seconds: 4.4, uses: [...C, "spTitle", "sp1", "sp2", "sp3", "credit"],
    css: `.t{position:absolute;left:0;width:100%;top:96px;text-align:center;font-size:calc(72px * var(--ds))}
${WIN}
.win{animation:lift .9s var(--move) both,clear .6s var(--out) both}
@keyframes spot{0%{left:386px;top:151px;width:535px;height:299px}
  30%{left:386px;top:151px;width:535px;height:299px}
  40%,63%{left:976px;top:99px;width:268px;height:386px}
  73%,100%{left:323px;top:548px;width:653px;height:204px}}
.spot{position:absolute;border-radius:var(--rs);box-shadow:0 0 0 2400px #000000a6;outline:4px solid {{secondary}};animation:spot 3.4s cubic-bezier(.65,0,.35,1) both,fadein .4s ease-out both}
.cap{position:absolute;animation:fadein .3s ease-out both}
.cap>div{display:flex;align-items:center;gap:12px;padding:16px 24px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-size:28px;font-weight:700;box-shadow:var(--shadow);animation:fadeout .25s ease-in both}
.cap b{width:30px;height:30px;border-radius:50%;background:{{secondary}};color:#111;display:flex;align-items:center;justify-content:center;font-size:18px}
.c1{left:760px;top:715px}.c2{left:1010px;top:760px}.c3{left:760px;top:715px}`,
    body: `<div class="t disp r" style="--d:.05s">{{spTitle}}</div>
<div class="win" style="--d:.1s">${WIN_HTML}<div class="spot" style="--d:.7s"></div></div>
<div class="cap c1" style="--d:.9s"><div style="--d:2.05s"><b>1</b>{{sp1}}</div></div>
<div class="cap c2" style="--d:2.25s"><div style="--d:3.05s"><b>2</b>{{sp2}}</div></div>
<div class="cap c3" style="--d:3.2s"><div style="--d:9s"><b>3</b>{{sp3}}</div></div>
<div class="credit f" style="--d:1s">{{credit}}</div>`,
    vertical: `.t{top:360px;left:80px;width:920px;line-height:1.08}${WIN_V}
@keyframes spot{0%,30%{left:294px;top:115px;width:408px;height:228px}40%,63%{left:744px;top:75px;width:204px;height:294px}73%,100%{left:246px;top:418px;width:498px;height:156px}}
.c1{left:120px;top:1260px}.c2{left:120px;top:1260px}.c3{left:120px;top:1260px}`,
  },
  // 3 · Hotspots — numbered pins pop onto the screen one by one, each with a
  // pulsing ring and a label that slides out of it.
  {
    seconds: 3.8, uses: [...C, "hsTitle", "hs1", "hs2", "hs3"],
    css: `.t{position:absolute;left:0;width:100%;top:96px;text-align:center;font-size:calc(72px * var(--ds))}
${WIN}
.win img{filter:saturate(.9) brightness(.92)}
.pin{position:absolute;width:0;height:0}
.dot{position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;background:{{primary}};color:var(--on-p);border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;box-shadow:0 10px 30px #0006;animation:popIn .7s var(--bounce) both,clear .3s var(--out) both}
@keyframes ping{from{transform:scale(.6);opacity:.8}to{transform:scale(2.6);opacity:0}}
.ring{position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;border:3px solid {{primary}};animation:ping 1.2s ease-out infinite}
.lab{position:absolute;left:40px;top:-24px;white-space:nowrap;padding:10px 18px;border-radius:var(--rs);background:var(--surface);border:var(--border);color:var(--ink);font-size:24px;font-weight:700;box-shadow:var(--shadow);animation:reveal .5s cubic-bezier(.65,0,.35,1) both}
.p1{left:983px;top:470px}.p2{left:1440px;top:540px}.p3{left:980px;top:890px}
.p2 .lab{left:auto;right:40px}`,
    body: `<div class="t disp r" style="--d:.05s">{{hsTitle}}</div>
<div class="win f" style="--d:0s">${WIN_HTML}</div>
<div class="pin p1"><div class="ring" style="--d:.6s"></div><div class="dot" style="--d:.5s">1</div><div class="lab" style="--d:.8s">{{hs1}}</div></div>
<div class="pin p2"><div class="ring" style="--d:1.2s"></div><div class="dot" style="--d:1.1s">2</div><div class="lab" style="--d:1.4s">{{hs2}}</div></div>
<div class="pin p3"><div class="ring" style="--d:1.8s"></div><div class="dot" style="--d:1.7s">3</div><div class="lab" style="--d:2.0s">{{hs3}}</div></div>`,
    vertical: `.t{top:360px;left:80px;width:920px;line-height:1.08}${WIN_V}
.p1{left:557px;top:869px}.p2{left:906px;top:990px}.p3{left:555px;top:1134px}.lab{font-size:28px}`,
  },
  // 4 · Workflow — the connectors draw left to right and each step lights up
  // in turn, then the run reports how long it took.
  {
    seconds: 3.8, uses: [...C, "wfTitle", "n1", "n1k", "n2", "n2k", "n3", "n3k", "n4", "n4k", "wfDone"],
    css: `.t{position:absolute;left:0;width:100%;top:250px;text-align:center;font-size:calc(76px * var(--ds))}
.flow{position:absolute;left:160px;top:470px;width:1600px;display:flex;align-items:center}
.node{position:relative;width:340px;flex:none;padding:26px 28px;border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:var(--shadow);animation:lift .8s var(--move) both,clear .5s var(--out) both}
.k{font-size:20px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
.n{margin-top:8px;font-size:32px;font-weight:700;color:var(--ink)}
@keyframes lit{to{border-color:{{primary}};box-shadow:var(--shadow),0 0 0 6px color-mix(in srgb,{{primary}} 30%,transparent)}}
.hl{position:absolute;inset:-3px;border-radius:var(--r);border:3px solid transparent;animation:lit .35s ease-out both}
.ok{position:absolute;right:-14px;top:-14px;width:40px;height:40px;border-radius:50%;background:{{secondary}};color:#111;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center;animation:popIn .6s var(--bounce) both,clear .2s linear both}
.wire{flex:1;height:4px;margin:0 8px;background:{{primary}};transform-origin:left center;animation:grow .4s cubic-bezier(.65,0,.35,1) both}
.done{position:absolute;left:0;width:100%;top:720px;text-align:center}
.done span{display:inline-flex;align-items:center;gap:14px;padding:16px 30px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-size:30px;font-weight:700;animation:popIn .8s var(--spring) both,clear .3s var(--out) both}`,
    body: `<div class="t disp r" style="--d:.05s">{{wfTitle}}</div>
<div class="flow">
${[1, 2, 3, 4].map((i) => { const d = 0.3 + (i - 1) * 0.12, lit = 0.9 + (i - 1) * 0.45; return `<div class="node" style="--d:${d.toFixed(2)}s"><div class="hl" style="--d:${lit.toFixed(2)}s"></div><div class="ok" style="--d:${(lit + 0.15).toFixed(2)}s">✓</div><div class="k">{{n${i}k}}</div><div class="n">{{n${i}}}</div></div>${i < 4 ? `<div class="wire" style="--d:${(lit + 0.1).toFixed(2)}s"></div>` : ""}`; }).join("\n")}
</div>
<div class="done"><span style="--d:2.75s">⚡ {{wfDone}}</span></div>`,
    vertical: `.t{top:300px;left:80px;width:920px;line-height:1.08}
.flow{left:220px;top:620px;width:640px;flex-direction:column;align-items:stretch}.node{width:640px}.wire{flex:none;width:4px;height:60px;margin:6px 0 6px 60px;transform-origin:center top;animation-name:growY}
.done{top:1560px}`,
  },
  // 5 · Mobile — a phone rises in, a tap ripples on a video row, and a share
  // sheet slides up with a confirmation.
  {
    seconds: 4.0, uses: [...C, "app", "phTitle", "phSub", "phHello", "v1", "v2", "v3", "phAction"],
    css: `.l{position:absolute;left:160px;top:400px;width:760px}.h2{font-size:calc(96px * var(--ds));line-height:1.03}.sub{margin-top:30px;font-size:32px;line-height:1.4;color:var(--muted);font-weight:500}
.phone{position:absolute;left:1180px;top:140px;width:420px;height:860px;border-radius:64px;background:#111;padding:16px;box-shadow:var(--shadow);animation:lift 1s var(--move) both,clear .6s var(--out) both}
.scr{position:relative;width:100%;height:100%;border-radius:50px;overflow:hidden;background:var(--surface)}
.notch{position:absolute;left:50%;top:14px;width:120px;height:32px;margin-left:-60px;border-radius:20px;background:#111;z-index:3}
.top{padding:74px 26px 16px;font-size:20px;color:var(--dim);font-weight:600}
.hello{padding:0 26px;font-size:36px;font-weight:800;color:var(--ink)}
.hero{margin:20px 26px;height:170px;border-radius:24px;background:linear-gradient(135deg,{{primary}},{{secondary}});position:relative;overflow:hidden}
.hero::after{content:'▶';position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:#ffffffd9;color:#111;display:flex;align-items:center;justify-content:center;font-size:24px}
.vrow{display:flex;align-items:center;gap:16px;margin:0 26px 14px;padding:14px;border-radius:18px;background:var(--surface2);font-size:24px;font-weight:600;color:var(--ink);animation:lift .6s var(--move) both,clear .4s var(--out) both}
.vrow i{width:72px;height:52px;border-radius:10px;flex:none;background:color-mix(in srgb,{{primary}} 40%,var(--surface2))}
@keyframes tap{0%{transform:scale(.3);opacity:.9}100%{transform:scale(2.2);opacity:0}}
.tap{position:absolute;left:200px;top:410px;width:70px;height:70px;margin:-35px;border-radius:50%;background:color-mix(in srgb,{{secondary}} 55%,transparent);animation:tap .6s ease-out both}
.finger{position:absolute;left:200px;top:410px;animation:fadein .2s ease-out both}
.finger>i{display:block;width:46px;height:46px;margin:-23px;border-radius:50%;background:#ffffffcc;border:3px solid #111;animation:fadeout .2s ease-in both}
@keyframes sheet{from{transform:translateY(100%)}}
.sheet{position:absolute;left:0;right:0;bottom:0;padding:30px 26px 46px;border-radius:30px 30px 0 0;background:var(--solid);color:var(--on-solid);animation:sheet .6s var(--spring) both}
.sheet .h{font-size:22px;opacity:.7}.sheet .a{display:flex;align-items:center;gap:14px;margin-top:10px;font-size:28px;font-weight:800}
.sheet b{width:36px;height:36px;border-radius:50%;background:{{secondary}};color:#111;display:flex;align-items:center;justify-content:center;font-size:20px;animation:popIn .6s var(--bounce) both}`,
    body: `<div class="l"><div class="h2 disp r" style="--d:.05s">{{phTitle}}</div><div class="sub r" style="--d:.45s">{{phSub}}</div></div>
<div class="phone" style="--d:.15s"><div class="scr"><div class="notch"></div><div class="top">{{app}}</div><div class="hello">{{phHello}}</div><div class="hero"></div>
<div class="vrow" style="--d:.7s"><i></i>{{v1}}</div><div class="vrow" style="--d:.82s"><i></i>{{v2}}</div><div class="vrow" style="--d:.94s"><i></i>{{v3}}</div>
<div class="finger" style="--d:1.5s"><i style="--d:2.2s"></i></div><div class="tap" style="--d:1.75s"></div>
<div class="sheet" style="--d:2.2s"><div class="h">{{v1}}</div><div class="a"><b style="--d:2.6s">✓</b>{{phAction}}</div></div></div></div>`,
    vertical: `.l{left:80px;top:220px;width:920px;text-align:center}.h2{font-size:calc(84px * var(--ds))}
.phone{left:300px;top:700px;width:480px;height:980px}.hero{height:200px}`,
  },
  // 6 · End card
  {
    seconds: 2.8, last: true, uses: [...C, "wordmark", "tagline", "cta"],
    css: `.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
@keyframes bloom{from{transform:scale(.5);opacity:0}}
.glow{position:absolute;left:460px;top:140px;width:1000px;height:640px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,{{primary}} 30%,transparent),transparent);animation:bloom 1.4s var(--out) both}
@keyframes focusIn{from{transform:scale(.86);opacity:0;filter:blur(18px)}}
.wm{position:relative;font-size:calc(140px * var(--ds));animation:focusIn 1s var(--out) both;text-align:center}
@keyframes drop{from{transform:translateY(-170px)}}
.dot{display:inline-block;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,{{primary}},{{secondary}});margin-left:10px;animation:drop .9s var(--bounce) both,fadein .2s linear both}
.tag{margin-top:18px;font-size:42px;color:var(--muted);font-weight:500;text-align:center}
.btn{position:relative;margin-top:70px}
.cta{padding:26px 54px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-weight:700;font-size:40px}
@keyframes pulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.35,1.8);opacity:0}}
.ping{position:absolute;inset:0;border-radius:999px;border:3px solid {{secondary}};animation:pulse 1.1s ease-out 3 both}`,
    body: `<div class="glow" style="--d:.05s"></div>
<div class="c"><div class="wm disp" style="--d:.1s">{{wordmark}}<span class="dot" style="--d:.55s"></span></div>
<div class="tag r" style="--d:.6s">{{tagline}}</div>
<div class="btn r" style="--d:.85s"><div class="ping" style="--d:1.45s"></div><div class="cta">{{cta}}</div></div></div>`,
    vertical: `.wm{font-size:calc(108px * var(--ds));width:960px}.glow{left:40px;top:560px}.tag{font-size:38px;width:900px}`,
  },
];

buildTemplates({
  id: ID,
  name: "Product tour",
  description: "A 22-second guided tour from one screenshot: a spotlight walks three areas with captions, numbered hotspots pop on, an automation runs step by step, and the same flow plays on a phone. Every word, both colours, the screenshot and the theme are fields.",
  category: "product-demos",
  tags: ["show-how-it-works", "walkthrough", "ui-mockup", "saas"],
  fields,
  scenes,
  themes: ["pop", "midnight", "paper", "terminal"],
  assets: [
    ...themeFonts(asset),
    { id: "shot", kind: "image", src: asset("product.jpg", "miraiclip-launch"), width: 1600, height: 900, name: "Product screenshot",
      license: { id: "CC-BY-3.0", url: "https://creativecommons.org/licenses/by/3.0/", commercial: true, attributionRequired: true },
      attribution: "Miraiclip editor showing Big Buck Bunny © Blender Foundation, CC BY 3.0" },
  ],
  here,
  outDir,
});
