// Example 6 · AI agent demo (Show how it works → Agent demo, 16:9 + 9:16, 21.4 s)
//
// An AI assistant inside a product: the question is typed, the agent plans and
// runs its steps, the answer streams in with a chart, and a ⌘K command sends
// the result on. Built on the shared kit (../_kit.mjs), with scenes adapted
// from the studio's built-in "AI assistant demo" and "Command palette".
// Writes <studio>/public/templates/ai-agent-demo{,-vertical}.miraiclip-template.json
// and ./ai-agent-demo{,-vertical}.miraiclip.json.
//
//   node examples/templates/ai-agent-demo/build.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTemplates, color, paths, text, themeField, themeFonts } from "../_kit.mjs";

const ID = "ai-agent-demo";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asset, outDir } = paths(here, ID);
const C = ["primary", "secondary"]; // every scene binds the brand colours (the kit's CSS uses them)

const fields = [
  themeField("paper"),
  color("primary", "Brand colour", "#e4572e"),
  color("secondary", "Second colour", "#2e86ab"),
  text("app", "Product name", "Northwind AI", { maxLength: 24 }),
  text("hook1", "Hook · line 1", "Ask a question.", { maxLength: 28 }),
  text("hook2", "Hook · line 2 (gradient)", "Watch it get done.", { maxLength: 28 }),
  text("askTitle", "Ask · headline", "Ask in plain words.", { maxLength: 30 }),
  text("chat1", "Ask · sidebar item 1", "Weekly report", { maxLength: 22 }),
  text("chat2", "Ask · sidebar item 2", "Churn deep dive", { maxLength: 22 }),
  text("chat3", "Ask · sidebar item 3", "Q3 planning", { maxLength: 22 }),
  text("greeting", "Ask · empty state", "What do you want to know?", { maxLength: 40 }),
  text("prompt", "Ask · the question", "Why did signups jump last week?", { maxLength: 48 }),
  text("workTitle", "Work · headline", "It plans, runs and checks.", { maxLength: 30 }),
  text("workSub", "Work · subline", "Every step is visible, so you can trust the answer.", { maxLength: 70 }),
  text("step1", "Work · step 1", "Read signups table"),
  text("step1Note", "Work · step 1 note", "12,480 rows"),
  text("step2", "Work · step 2", "Compare to last week"),
  text("step2Note", "Work · step 2 note", "+38%"),
  text("step3", "Work · step 3", "Break down by source"),
  text("step3Note", "Work · step 3 note", "6 channels"),
  text("step4", "Work · step 4", "Draft the summary"),
  text("step4Note", "Work · step 4 note", "done"),
  text("answerTitle", "Answer · headline", "Answers you can act on.", { maxLength: 30 }),
  text("a1", "Answer · line 1 (bold)", "Signups rose 38% week over week.", { maxLength: 44 }),
  text("a2", "Answer · line 2", "Most of the lift came from the new referral program,", { maxLength: 60 }),
  text("a3", "Answer · line 3", "which drove 1,240 signups on its own.", { maxLength: 60 }),
  text("chartLabel", "Answer · chart title", "Signups, last 7 days", { maxLength: 30 }),
  text("chartDelta", "Answer · chart badge", "+38%", { maxLength: 8 }),
  text("cmdTitle", "Command · caption", "Then ⌘K does the rest.", { maxLength: 30 }),
  text("query", "Command · typed query", "send report", { maxLength: 24 }),
  text("r1", "Command · result 1 (chosen)", "Send report to #growth", { maxLength: 32 }),
  text("r2", "Command · result 2", "Schedule weekly report", { maxLength: 32 }),
  text("r3", "Command · result 3", "Export as PDF", { maxLength: 32 }),
  text("r4", "Command · result 4", "Share link", { maxLength: 32 }),
  text("toast", "Command · confirmation", "Report sent to #growth", { maxLength: 32 }),
  text("wordmark", "End card · wordmark", "Northwind AI", { maxLength: 18 }),
  text("tagline", "End card · tagline", "Answers, not dashboards.", { maxLength: 48 }),
  text("cta", "End card · button", "northwind.ai", { maxLength: 28 }),
];

// The chat window shared by the ask and answer scenes.
const WIN = `.win{position:absolute;border-radius:var(--r);overflow:hidden;background:var(--surface);border:var(--border);box-shadow:var(--shadow),var(--glow);display:flex}
.side{width:280px;flex:none;background:var(--surface2);border-right:var(--border);padding:26px 22px}
.brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:24px;margin-bottom:30px}
.logo{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,{{primary}},{{secondary}})}
.item{padding:14px 16px;border-radius:var(--rs);font-size:21px;color:var(--muted);margin-bottom:6px}
.item.on{background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--ink)}
.main{position:relative;flex:1;padding:34px 40px}`;

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
    vertical: `.wrap{left:80px;top:720px;width:920px}.h1{font-size:calc(104px * var(--ds))}.orb{left:200px;top:1150px}`,
  },
  // 2 · Ask — the chat window rises in 3D; the empty state fades as the
  // question types into the composer, the send button is pressed, and the
  // question lands as a message.
  {
    seconds: 3.6, uses: [...C, "app", "askTitle", "chat1", "chat2", "chat3", "greeting", "prompt"],
    css: `.t{position:absolute;left:0;width:100%;top:96px;text-align:center;font-size:calc(72px * var(--ds))}
${WIN}.win{left:300px;top:250px;width:1320px;height:740px}
.hello{position:absolute;left:0;right:0;top:250px;text-align:center;font-size:40px;font-weight:600;color:var(--ink);animation:fadein .5s var(--out) both}
.hello-out{animation:fadeout .3s ease-in both}
.compose{position:absolute;left:40px;right:40px;bottom:36px;display:flex;align-items:center;gap:18px;padding:22px 26px;border-radius:var(--rs);background:var(--surface2);border:var(--border);font-size:28px;color:var(--ink)}
.compose .txt{flex:1;animation:fadeout .15s linear both}
@keyframes press{0%,100%{transform:scale(1)}40%{transform:scale(.86)}}
.send{width:52px;height:52px;flex:none;border-radius:var(--rs);background:{{primary}};color:var(--on-p);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;animation:press .35s var(--spring) both}
.me{position:absolute;right:40px;top:40px;max-width:720px;padding:22px 28px;border-radius:24px 24px 6px 24px;background:{{primary}};color:var(--on-p);font-size:28px;font-weight:600;transform-origin:100% 100%}`,
    body: `<div class="t disp r" style="--d:.9s">{{askTitle}}</div>
<div class="win r3" style="--d:.05s"><div class="side"><div class="brand"><span class="logo"></span>{{app}}</div><div class="item on">{{chat1}}</div><div class="item">{{chat2}}</div><div class="item">{{chat3}}</div></div>
<div class="main"><div class="hello" style="--d:.6s"><div class="hello-out" style="--d:2.35s">{{greeting}}</div></div>
<div class="me p" style="--d:2.6s">{{prompt}}</div>
<div class="compose"><div class="txt" style="--d:2.5s"><span class="typed" style="--d:.8s">{{prompt}}</span><span class="caret"></span></div><div class="send" style="--d:2.3s">↑</div></div></div></div>`,
    vertical: `.t{top:330px;left:80px;width:920px;font-size:calc(68px * var(--ds));line-height:1.08}
.win{left:60px;top:620px;width:960px;height:880px}.side{display:none}.me{max-width:640px;font-size:30px}.hello{top:300px;font-size:40px}.compose{font-size:30px}`,
  },
  // 3 · Work — each tool step slides in with a spinner that resolves into a
  // check; thinking dots pulse in the card header and a progress bar fills.
  {
    seconds: 4.0, uses: [...C, "workTitle", "workSub", "step1", "step1Note", "step2", "step2Note", "step3", "step3Note", "step4", "step4Note"],
    css: `.l{position:absolute;left:160px;top:380px;width:640px}.h2{font-size:calc(96px * var(--ds));line-height:1.03}.sub{margin-top:30px;font-size:32px;line-height:1.4;color:var(--muted);font-weight:500}
.card{position:absolute;left:900px;top:220px;width:860px;padding:34px 36px 40px;border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:var(--shadow)}
.hd{display:flex;align-items:center;gap:14px;font-size:24px;color:var(--muted);margin-bottom:22px}
.hd i{width:10px;height:10px;border-radius:50%;background:{{secondary}};animation:dots 1s ease-in-out infinite}
.hd i:nth-child(2){animation-duration:1.1s}.hd i:nth-child(3){animation-duration:1.2s}
.tool{display:flex;align-items:center;gap:22px;margin-top:16px;padding:22px 26px;border-radius:var(--rs);background:var(--surface2);border:var(--border);font-size:28px;color:var(--ink);animation:slideIn .9s var(--spring) both,clear .5s var(--out) both}
.st{position:relative;width:40px;height:40px;flex:none}
.sw{position:absolute;inset:0;animation:gone .18s ease-in both}
.ring{position:absolute;inset:4px;border-radius:50%;border:4px solid color-mix(in srgb,var(--ink) 18%,transparent);border-top-color:{{secondary}};animation:spin .7s linear infinite}
.ok{position:absolute;inset:0;border-radius:50%;background:{{secondary}};color:#04121a;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center;animation:popIn .7s var(--spring) both,clear .3s var(--out) both}
.note{margin-left:auto;font-size:24px;color:var(--dim)}
.bar{margin-top:28px;height:8px;border-radius:4px;background:color-mix(in srgb,var(--ink) 10%,transparent);overflow:hidden}
.bar b{display:block;height:100%;background:linear-gradient(90deg,{{primary}},{{secondary}});transform-origin:left center;animation:grow 2.8s cubic-bezier(.45,0,.55,1) both}`,
    body: `<div class="l"><div class="h2 disp r" style="--d:.05s">{{workTitle}}</div><div class="sub r" style="--d:.45s">{{workSub}}</div></div>
<div class="card ty" style="--d:.2s"><div class="hd"><i style="--d:0s"></i><i style="--d:.15s"></i><i style="--d:.3s"></i>&#160;Working</div>
${[1, 2, 3, 4].map((n) => { const d = 0.6 + (n - 1) * 0.5; return `<div class="tool" style="--d:${d.toFixed(2)}s"><div class="st"><div class="sw" style="--d:${(d + 0.45).toFixed(2)}s"><div class="ring" style="--d:0s"></div></div><div class="ok" style="--d:${(d + 0.45).toFixed(2)}s">✓</div></div><span>{{step${n}}}</span><span class="note">{{step${n}Note}}</span></div>`; }).join("\n")}
<div class="bar"><b style="--d:.6s"></b></div></div>`,
    vertical: `.l{left:80px;top:300px;width:920px}.h2{font-size:calc(88px * var(--ds))}.card{left:80px;top:760px;width:920px}.tool{font-size:30px}.note{font-size:26px}`,
  },
  // 4 · Answer — the reply streams in line by line; the chart's bars grow in
  // sequence, the last ones in the brand colour, and the delta badge pops.
  {
    seconds: 4.0, uses: [...C, "app", "answerTitle", "chat1", "chat2", "chat3", "prompt", "a1", "a2", "a3", "chartLabel", "chartDelta"],
    css: `.t{position:absolute;left:0;width:100%;top:96px;text-align:center;font-size:calc(72px * var(--ds))}
${WIN}.win{left:300px;top:250px;width:1320px;height:740px}
.me{position:absolute;right:40px;top:34px;max-width:720px;padding:18px 26px;border-radius:22px 22px 6px 22px;background:{{primary}};color:var(--on-p);font-size:24px;font-weight:600;opacity:.92}
.ans{position:absolute;left:40px;right:40px;top:130px;display:flex;gap:18px}
.av{width:44px;height:44px;flex:none;border-radius:var(--rs);background:linear-gradient(135deg,{{primary}},{{secondary}})}
.ln{display:table;font-size:28px;line-height:1.5;color:var(--ink);animation:reveal .8s steps(24,end) both}
.ln.b{color:var(--ink);font-weight:700}
.chart{margin-top:22px;width:660px;padding:22px 26px;border-radius:var(--rs);background:var(--surface2);border:var(--border)}
.ch{display:flex;align-items:center;justify-content:space-between;font-size:22px;color:var(--muted)}
.delta{padding:6px 14px;border-radius:999px;background:color-mix(in srgb,{{secondary}} 20%,transparent);color:{{secondary}};font-weight:700}
.bars{display:flex;align-items:flex-end;gap:16px;height:170px;margin-top:18px}
.bars i{flex:1;border-radius:8px 8px 3px 3px;background:color-mix(in srgb,var(--ink) 16%,transparent);transform-origin:50% 100%;animation:growY .7s var(--spring) both}
.bars i.hi{background:linear-gradient(180deg,{{secondary}},{{primary}})}`,
    body: `<div class="t disp r" style="--d:.05s">{{answerTitle}}</div>
<div class="win f" style="--d:0s"><div class="side"><div class="brand"><span class="logo"></span>{{app}}</div><div class="item on">{{chat1}}</div><div class="item">{{chat2}}</div><div class="item">{{chat3}}</div></div>
<div class="main"><div class="me">{{prompt}}</div>
<div class="ans"><div class="av p" style="--d:.25s"></div><div>
<div class="ln b" style="--d:.4s">{{a1}}</div><div class="ln" style="--d:1.0s">{{a2}}</div><div class="ln" style="--d:1.6s">{{a3}}</div>
<div class="chart r" style="--d:1.5s"><div class="ch"><span>{{chartLabel}}</span><span class="delta p" style="--d:2.7s">{{chartDelta}}</span></div>
<div class="bars">${[38, 44, 41, 47, 52, 80, 100].map((h, i) => `<i class="${i >= 5 ? "hi" : ""}" style="height:${h}%;--d:${(1.8 + i * 0.1).toFixed(2)}s"></i>`).join("")}</div></div>
</div></div></div></div>`,
    vertical: `.t{top:330px;left:80px;width:920px;font-size:calc(68px * var(--ds));line-height:1.08}
.win{left:60px;top:560px;width:960px;height:1080px}.side{display:none}.me{max-width:640px;font-size:28px}.ans{top:150px}.ln{font-size:34px;white-space:normal;display:block}.chart{width:800px;margin-top:34px}.ch{font-size:28px}.bars{height:300px}`,
  },
  // 5 · Command — the app dims, the palette springs open, the query types,
  // results cascade in, the first one is chosen, the palette closes and a
  // confirmation toast pops.
  {
    seconds: 3.8, uses: [...C, "cmdTitle", "query", "r1", "r2", "r3", "r4", "toast"],
    css: `.t{position:absolute;left:0;width:100%;top:120px;text-align:center;font-size:calc(64px * var(--ds))}
.app{position:absolute;left:300px;top:250px;width:1320px;height:740px;border-radius:var(--r);background:var(--surface);border:var(--border);overflow:hidden}
.app i{position:absolute;border-radius:var(--rs);background:color-mix(in srgb,var(--ink) 7%,transparent)}
@keyframes dim{to{background:var(--shade)}}
.shade{position:absolute;inset:0;animation:dim .35s linear both}
@keyframes open{0%{transform:scale(.92);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes close{to{transform:scale(.96);opacity:0}}
.palx{position:absolute;left:560px;top:330px;width:800px;animation:close .25s ease-in both}
.pal{border-radius:var(--rs);background:var(--surface2);border:var(--border);box-shadow:var(--shadow);overflow:hidden;animation:open .5s var(--spring) both}
.q{display:flex;align-items:center;gap:16px;padding:26px 30px;border-bottom:var(--border);font-size:30px}
.k{margin-left:auto;padding:6px 12px;border-radius:8px;background:color-mix(in srgb,var(--ink) 11%,transparent);font-size:20px;color:var(--muted)}
.res{padding:12px}
.row{position:relative;padding:18px 20px;border-radius:var(--rs);font-size:26px;color:var(--ink);animation:lift .5s var(--spring) both,clear .3s var(--out) both}
@keyframes pick{0%{background:transparent}30%{background:color-mix(in srgb,{{primary}} 30%,transparent)}60%{background:color-mix(in srgb,{{primary}} 55%,transparent)}100%{background:color-mix(in srgb,{{primary}} 30%,transparent)}}
.row.sel{color:var(--ink);font-weight:600;animation:lift .5s var(--spring) both,clear .3s var(--out) both}
.hl{position:absolute;inset:0;border-radius:var(--rs);animation:pick .6s ease-out both}
.ent{position:absolute;right:16px;top:14px;padding:4px 10px;border-radius:8px;background:color-mix(in srgb,var(--ink) 16%,transparent);font-size:18px}
.toast{position:absolute;left:50%;top:860px;transform:translateX(-50%)}
.tin{display:flex;align-items:center;gap:16px;padding:20px 30px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-size:28px;font-weight:700;box-shadow:var(--shadow);animation:popIn .8s var(--spring) both,clear .3s var(--out) both}
.tin b{width:34px;height:34px;border-radius:50%;background:{{secondary}};color:#04121a;display:flex;align-items:center;justify-content:center;font-size:20px}`,
    body: `<div class="t disp r" style="--d:.05s">{{cmdTitle}}</div>
<div class="app f" style="--d:0s"><i style="left:30px;top:30px;width:240px;height:680px"></i><i style="left:300px;top:30px;width:990px;height:120px"></i><i style="left:300px;top:180px;width:480px;height:300px"></i><i style="left:810px;top:180px;width:480px;height:300px"></i><i style="left:300px;top:510px;width:990px;height:200px"></i><div class="shade" style="--d:.3s"></div></div>
<div class="palx" style="--d:2.75s"><div class="pal" style="--d:.4s">
<div class="q"><span style="color:var(--dim)">⌕</span><span class="typed" style="--d:.8s;animation-duration:.8s">{{query}}</span><span class="caret"></span><span class="k">esc</span></div>
<div class="res"><div class="row sel" style="--d:1.55s"><div class="hl" style="--d:2.2s"></div><span style="position:relative">{{r1}}</span><span class="ent">↵</span></div>
<div class="row" style="--d:1.65s">{{r2}}</div><div class="row" style="--d:1.75s">{{r3}}</div><div class="row" style="--d:1.85s">{{r4}}</div></div></div></div>
<div class="toast"><div class="tin" style="--d:2.95s"><b>✓</b>{{toast}}</div></div>`,
    vertical: `.t{top:360px;left:80px;width:920px;line-height:1.1}
.app{left:60px;top:620px;width:960px;height:900px}.palx{left:80px;top:740px;width:920px}.q{font-size:36px;padding:30px 32px}.row{font-size:32px;padding:22px 22px}.toast{top:1600px}.tin{font-size:32px}`,
  },
  // 6 · End card
  {
    seconds: 3.2, last: true, uses: [...C, "wordmark", "tagline", "cta"],
    css: `.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
@keyframes bloom{from{transform:scale(.5);opacity:0}}
.glow{position:absolute;left:460px;top:140px;width:1000px;height:640px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,{{primary}} 30%,transparent),transparent);animation:bloom 1.4s var(--out) both}
@keyframes focusIn{from{transform:scale(.86);opacity:0;filter:blur(18px)}}
.wm{position:relative;font-size:calc(150px * var(--ds));animation:focusIn 1s var(--out) both}
@keyframes drop{from{transform:translateY(-170px)}}
.dot{display:inline-block;width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,{{primary}},{{secondary}});margin-left:10px;animation:drop .9s var(--bounce) both,fadein .2s linear both}
.tag{margin-top:18px;font-size:42px;color:var(--muted);font-weight:500;text-align:center}
.btn{position:relative;margin-top:70px}
.cta{padding:26px 54px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-weight:700;font-size:40px}
@keyframes pulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.35,1.8);opacity:0}}
.ping{position:absolute;inset:0;border-radius:999px;border:3px solid {{secondary}};animation:pulse 1.1s ease-out 3 both}`,
    body: `<div class="glow" style="--d:.05s"></div>
<div class="c"><div class="wm disp" style="--d:.1s">{{wordmark}}<span class="dot" style="--d:.55s"></span></div>
<div class="tag r" style="--d:.6s">{{tagline}}</div>
<div class="btn r" style="--d:.85s"><div class="ping" style="--d:1.45s"></div><div class="cta">{{cta}}</div></div></div>`,
    vertical: `.wm{font-size:calc(120px * var(--ds))}.glow{left:40px;top:560px}.tag{font-size:38px;width:900px}`,
  },
];

buildTemplates({
  id: ID,
  name: "AI agent demo",
  description: "A 21-second AI assistant demo: the question is typed, the agent runs its steps with spinners that resolve into checks, the answer streams in with a chart, and a ⌘K command sends it on. Every word, both colours and the theme (midnight, paper, terminal, pop) are fields.",
  category: "product-demos",
  tags: ["show-how-it-works", "agent-demo", "ui-mockup", "saas", "ai"],
  fields,
  scenes,
  themes: ["paper", "midnight", "terminal", "pop"],
  assets: themeFonts(asset),
  here,
  outDir,
});
