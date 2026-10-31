// "One day": a 60 s launch film for HighLevel's AI Employee. A 24-hour sky time-lapse with a rolling clock; each of
// the six AI modules handles one moment of a business's day, in recreated product UI with sample data.
// HTML and CSS only.   node build.mjs
import fs from "node:fs";
import { writeExample } from "../_lib/write-example.mjs";
import { cap } from "../_lib/app-film/build.mjs";
import { T, BEAT, SCENES } from "./timeline.mjs";

const W = 1920, H = 1080;
const read = (f) => fs.readFileSync(new URL(f, import.meta.url));
const font = (f) => "data:font/woff2;base64," + read(`./assets/${f}`).toString("base64");
const LOGO = "data:image/png;base64," + read("./assets/HighLevel-logo-white.png").toString("base64");
const kit = ["film-core.js", "overlay.js"].map((f) => fs.readFileSync(new URL(`../_lib/app-film/browser/${f}`, import.meta.url), "utf8"));
const dir = new URL("./film/", import.meta.url);
const film = [`var W = ${W}, H = ${H}, PERSP = 1600, WIN_W = 0, WIN_H = 0, BEAT = ${BEAT};`, `var T = ${JSON.stringify(T)}, SCENES = ${JSON.stringify(SCENES)};`].concat(kit)
  .concat(fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().map((f) => `// ==== film/${f}\n` + fs.readFileSync(new URL(f, dir), "utf8"))).join("\n");

const SANS = "Geist,'Helvetica Neue',Arial,sans-serif", MONO = "'Geist Mono',Menlo,monospace";
const BLUE = "#188BF6", GREEN = "#37CA37", YEL = "#FFBC00";
const css = `
@font-face{font-family:Geist;src:url(${font("Geist-Variable.woff2")}) format("woff2");font-weight:100 900}
@font-face{font-family:'Geist Mono';src:url(${font("GeistMono-Variable.woff2")}) format("woff2");font-weight:100 900}
*{box-sizing:border-box;margin:0}
.stage{background:#050816;color:#fff;font-family:${SANS};-webkit-font-smoothing:antialiased}
.full{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden}
#stars i{position:absolute;width:3px;height:3px;border-radius:2px;background:#fff}
#sun{position:absolute;width:170px;height:170px;border-radius:50%;background:radial-gradient(circle,#fffbe8,#ffe08a 55%,#ffb347);box-shadow:0 0 120px 40px rgba(255,200,90,0.55)}
#moon{position:absolute;width:110px;height:110px;border-radius:50%;background:radial-gradient(circle at 38% 38%,#fbfaf5,#d9dbe8 70%);box-shadow:0 0 80px 10px rgba(200,210,255,0.35)}
#haze{position:absolute;left:0;right:0;bottom:0;height:520px}
#city{position:absolute;left:0;bottom:0;width:${W}px;height:220px}
#city>div{position:absolute;bottom:0;background:#0a0f24}
#city>div i{position:absolute;width:6px;height:8px;background:#ffd98a}
#clock{position:absolute;white-space:nowrap;font-weight:300;letter-spacing:-0.04em;line-height:1;font-variant-numeric:tabular-nums;text-shadow:0 6px 40px rgba(0,0,10,0.35)}
#clock small{font-size:0.32em;font-weight:500;letter-spacing:0.02em;margin-left:0.18em}
.sc{position:absolute;inset:0;display:none}
.eb{position:absolute;left:96px;top:150px;display:flex;align-items:center;gap:12px;font:600 20px ${MONO};letter-spacing:0.16em;opacity:0}
.eb i{width:14px;height:14px;border-radius:4px;background:${BLUE};box-shadow:0 0 16px ${BLUE}}
.cap{position:absolute;left:92px;overflow:hidden;padding:4px 0 14px;font-weight:700;font-size:74px;line-height:1.04;letter-spacing:-0.04em;white-space:nowrap;}
.sc .cap{width:740px;white-space:normal;font-size:70px;color:#fff;text-shadow:0 4px 30px rgba(0,0,20,0.35)}
.cap>span{display:inline-block}
.sub{position:absolute;left:96px;top:376px;width:720px;font-size:30px;line-height:1.35;font-weight:500;color:rgba(255,255,255,0.88);text-shadow:0 2px 20px rgba(0,0,20,0.4);opacity:0}
.ui{position:absolute;border-radius:22px;background:#fff;color:#111827;box-shadow:0 40px 100px rgba(6,10,40,0.38),0 0 0 1px rgba(17,24,39,0.06);overflow:hidden}
.hd{height:64px;display:flex;align-items:center;gap:14px;padding:0 26px;border-bottom:1px solid #eef0f4;font-weight:650;font-size:22px}
.hd .dot{width:12px;height:12px;border-radius:6px;background:${GREEN};box-shadow:0 0 10px ${GREEN}}
.hd .r{margin-left:auto;font:500 18px ${MONO};color:#6b7280}
.tag{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:#e8f3fe;color:${BLUE};font-weight:650;font-size:17px}
.tag.g{background:#e9f9e9;color:#1f9d1f}
.bub{max-width:560px;padding:16px 22px;border-radius:20px;font-size:23px;line-height:1.35;opacity:0}
.bub.c{background:#f1f3f7;color:#111827;border-bottom-left-radius:6px;align-self:flex-start}
.bub.a{background:${BLUE};color:#fff;border-bottom-right-radius:6px;align-self:flex-end}
.who{font:600 14px ${MONO};letter-spacing:0.08em;color:#9ca3af;margin-bottom:-6px;opacity:0}
.who.a{align-self:flex-end}
.caret{display:inline-block;width:3px;height:1em;vertical-align:-0.15em;background:currentColor;margin-left:2px}
.spark{color:${BLUE}}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 24px;border-radius:12px;background:${BLUE};color:#fff;font-weight:650;font-size:20px}
.prompt{display:flex;align-items:center;gap:14px;padding:22px 26px;font-size:26px;font-weight:550;color:#111827}
.prompt .ph{color:#9ca3af}
#foot{position:absolute;right:56px;bottom:34px;font:500 15px ${MONO};letter-spacing:0.04em;color:rgba(255,255,255,0.6)}
/* hook */
#phone{position:absolute;left:1190px;top:170px;width:380px;height:760px;border-radius:58px;background:#0b0f1a;box-shadow:0 0 0 10px #1b2132,0 60px 140px rgba(0,0,0,0.6);overflow:hidden}
#phone .notch{position:absolute;left:130px;top:16px;width:120px;height:34px;border-radius:17px;background:#000}
#phone .pt{position:absolute;left:0;right:0;top:120px;text-align:center}
#phone .pt b{display:block;font-weight:600;font-size:22px;color:rgba(255,255,255,0.6);letter-spacing:0.06em}
#phone .pt em{display:block;font-style:normal;font-weight:650;font-size:44px;margin-top:18px}
#phone .pt span{display:block;font:500 22px ${MONO};color:rgba(255,255,255,0.65);margin-top:10px}
#phone .av{position:absolute;left:130px;top:330px;width:120px;height:120px;border-radius:60px;background:linear-gradient(135deg,${BLUE},#6cc1ff);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:44px}
#phone .bt{position:absolute;bottom:90px;width:96px;height:96px;border-radius:48px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700}
#decline{left:60px;background:#ef4444}#accept{right:60px;background:${GREEN}}
#phone .lbl{position:absolute;bottom:52px;width:96px;text-align:center;font-size:17px;color:rgba(255,255,255,0.7)}
.ringw{position:absolute;left:1380px;top:550px;width:0;height:0}
.ringw i{position:absolute;left:-200px;top:-200px;width:400px;height:400px;border-radius:50%;border:3px solid rgba(55,202,55,0.7)}
#answered{position:absolute;left:1190px;top:820px;width:380px;text-align:center;font-weight:650;font-size:26px;color:${GREEN};opacity:0}
/* reveal */
#orb{position:absolute;left:810px;top:230px;width:300px;height:300px;border-radius:50%;background:conic-gradient(from 0deg,${BLUE},${GREEN},${YEL},${BLUE});filter:blur(2px);box-shadow:0 0 140px 30px rgba(24,139,246,0.45)}
#orb::after{content:"";position:absolute;inset:22px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#1d2a5c,#070b20 70%)}
#orbi{position:absolute;left:810px;top:230px;width:300px;height:300px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:74px;letter-spacing:-0.04em}
#orbi span{background:linear-gradient(135deg,#7cc4ff,${BLUE} 40%,${GREEN} 75%,${YEL});-webkit-background-clip:text;background-clip:text;color:transparent}
.mchip{position:absolute;left:0;top:0;display:flex;align-items:center;gap:12px;padding:16px 26px;border-radius:999px;background:rgba(255,255,255,0.95);color:#111827;font-weight:700;font-size:28px;white-space:nowrap;box-shadow:0 20px 50px rgba(0,0,30,0.35)}
.mchip i{width:16px;height:16px;border-radius:5px}
.ctr{position:absolute;left:0;right:0;text-align:center;opacity:0}
#rv1{top:640px;font-weight:500;font-size:52px;color:rgba(255,255,255,0.85)}
#rv2{top:704px;font-weight:800;font-size:150px;letter-spacing:-0.05em;line-height:1}
.grad{background:linear-gradient(100deg,#8fd0ff,${BLUE} 35%,${GREEN} 70%,${YEL});-webkit-background-clip:text;background-clip:text;color:transparent}
/* voice */
#v-ui{left:900px;top:150px;width:920px;height:800px;background:#fff}
#v-wave{height:96px;display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(180deg,#0f172a,#16213f)}
#v-wave i{width:7px;border-radius:4px;background:linear-gradient(180deg,#7cc4ff,${BLUE})}
#v-tx{display:flex;flex-direction:column;gap:16px;padding:28px 30px}
#v-book{left:1010px;top:850px;width:700px;padding:24px 28px;display:flex;gap:20px;align-items:center;opacity:0}
.ok{width:56px;height:56px;border-radius:28px;background:${GREEN};color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;flex:none}
.bk b{display:block;font-size:26px}.bk span{display:block;font-size:20px;color:#6b7280;margin-top:4px}
/* conversations */
#c-ui{left:880px;top:150px;width:960px;height:800px;display:flex}
#c-list{width:360px;border-right:1px solid #eef0f4}
#c-list .row{display:flex;gap:14px;padding:18px 20px;border-bottom:1px solid #f3f4f6;align-items:center}
.avs{width:50px;height:50px;border-radius:25px;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;position:relative}
.avs u{position:absolute;right:-4px;bottom:-4px;width:22px;height:22px;border-radius:11px;border:3px solid #fff;text-decoration:none;font-size:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800}
.row .tx{flex:1;min-width:0}.row .tx b{display:block;font-size:19px}.row .tx span{display:block;font-size:16px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .st{font-size:13px;font-weight:700;color:#1f9d1f;background:#e9f9e9;padding:4px 8px;border-radius:8px;opacity:0;white-space:nowrap}
.row.on{background:#f0f7ff}
#c-th{flex:1;display:flex;flex-direction:column}
#c-msgs{flex:1;display:flex;flex-direction:column;gap:16px;padding:28px 30px}
.typing{align-self:flex-end;display:flex;gap:7px;padding:18px 22px;border-radius:20px;background:#e8f3fe;opacity:0}
.typing i{width:10px;height:10px;border-radius:5px;background:${BLUE}}
/* reviews */
#r-card{left:900px;top:170px;width:900px;padding:34px 38px}
#r-card .top{display:flex;gap:18px;align-items:center}
.stars{display:flex;gap:6px;font-size:34px;color:#e5e7eb}
.stars i{font-style:normal}.stars i.on{color:${YEL}}
#r-text{margin-top:22px;font-size:30px;line-height:1.4;font-weight:500}
#r-reply{left:960px;top:560px;width:840px;padding:28px 32px;opacity:0}
#r-rt{margin-top:16px;font-size:25px;line-height:1.45;min-height:110px;color:#1f2937}
#r-post{margin-top:18px;display:flex;justify-content:flex-end}
/* content */
#ct-prompt{left:900px;top:150px;width:920px}
#ct-post{left:900px;top:300px;width:470px;height:660px;opacity:0}
#ct-img{height:420px;position:relative;overflow:hidden;background:linear-gradient(160deg,#ffd27a,#ff8f6b 55%,#e2507a)}
#ct-img .s{position:absolute;left:150px;top:90px;width:170px;height:170px;border-radius:50%;background:#fff6d6;box-shadow:0 0 70px #fff1b8}
#ct-img .w{position:absolute;left:-40px;right:-40px;bottom:-30px;height:170px;border-radius:50% 50% 0 0;background:#2a9df4}
#ct-img .t{position:absolute;left:28px;bottom:36px;font-weight:800;font-size:46px;color:#fff;letter-spacing:-0.03em;line-height:1;text-shadow:0 4px 20px rgba(0,0,0,0.25)}
#ct-img .shim{position:absolute;inset:0;background:#e5e7eb}
#ct-cap{padding:18px 22px;font-size:20px;line-height:1.4;min-height:120px}
#ct-blog{left:1400px;top:300px;width:420px;height:440px;padding:26px;opacity:0}
#ct-blog b{display:block;font-size:28px;line-height:1.2;margin-top:14px}
.ln{height:12px;border-radius:6px;background:#eef0f4;margin-top:14px}
/* funnel */
#f-prompt{left:900px;top:150px;width:920px}
.fp{position:absolute;top:330px;width:270px;height:470px;padding:16px;opacity:0}
.fp .blk{border-radius:8px;background:#eef0f4;margin-bottom:12px}
.fp .lab{position:absolute;left:0;right:0;bottom:-48px;text-align:center;font-weight:650;font-size:22px;color:#fff;text-shadow:0 2px 14px rgba(0,0,30,0.4)}
#f-arrows{position:absolute;left:0;top:0}
/* workflow */
#w-ui{left:880px;top:150px;width:960px;height:820px;background:#f7f8fb radial-gradient(circle,#d7dbe4 1.5px,transparent 1.6px) 0 0/26px 26px}
#w-ai{position:absolute;left:24px;top:24px;width:300px;padding:22px;border-radius:16px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,0.08);font-size:19px;line-height:1.4;opacity:0}
#w-ai .q{font-weight:600;font-size:21px;margin:10px 0 16px;min-height:90px}
.node{position:absolute;width:330px;padding:16px 18px;border-radius:14px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,0.1),inset 4px 0 0 var(--c);font-size:20px;font-weight:650;opacity:0}
.node small{display:block;font:600 13px ${MONO};letter-spacing:0.1em;color:var(--c);margin-bottom:4px}
#w-lines{position:absolute;left:0;top:0}
/* recap + end */
.rc{position:absolute;width:420px;padding:20px 24px;display:flex;gap:16px;align-items:center;opacity:0}
.rc i{width:44px;height:44px;border-radius:12px;flex:none}
.rc b{display:block;font-size:22px}.rc span{display:block;font-size:17px;color:#6b7280}
#rc1{top:330px;font-weight:700;font-size:84px;letter-spacing:-0.04em}
#rc2{top:440px;font-weight:600;font-size:44px;color:rgba(255,255,255,0.85)}
#elogo{position:absolute;left:660px;top:300px;width:600px;height:auto;opacity:0}
#etitle{top:500px;font-weight:800;font-size:160px;letter-spacing:-0.055em;line-height:1}
#etag{top:690px;font-size:40px;font-weight:500;color:rgba(255,255,255,0.85)}
#eurl{position:absolute;left:660px;top:790px;width:600px;height:96px;border-radius:48px;background:${BLUE};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:42px;box-shadow:0 18px 60px rgba(24,139,246,0.55);opacity:0}
`;
const head = (id, i) => { const s = SCENES[i]; return `<div class="eb" id="eb-${id}"><i></i>${s[3]}</div>${cap("h-" + id, 196, s[4])}<div class="sub" id="sub-${id}">${s[5]}</div>`; };
const html = `<div class="stage" data-libs="stage" data-duration="${T.DUR}" data-fps="${T.FPS}" data-stage-version="2" data-frame-timeout="60" style="width:${W}px;height:${H}px;overflow:hidden"><style>${css}</style>
<div id="sky" class="full"><div id="stars" class="full"></div><div id="sun"></div><div id="moon"></div><div id="haze"></div><div id="city"></div></div>

<div class="sc" id="s-hook"><div class="ringw"><i></i><i></i><i></i></div>
<div id="phone"><div class="notch"></div><div class="pt"><b>INCOMING CALL</b><em>New lead</em><span>(555) 013-2207</span></div><div class="av">?</div>
<div class="bt" id="decline">✕</div><div class="bt" id="accept">✆</div><div class="lbl" style="left:60px">Decline</div><div class="lbl" style="right:60px">Accept</div></div>
<div id="answered">Answered by AI Employee</div>
${cap("hk1", 560, "A new lead calls at 2:14 AM.", "font-size:60px;font-weight:600")}${cap("hk2", 650, '<span style="color:#FFBC00">Who picks up?</span>', "font-size:120px")}</div>

<div class="sc" id="s-reveal"><div id="orb"></div><div id="orbi"><span>AI</span></div><div id="chips"></div>
<div class="ctr" id="rv1">Meet your</div><div class="ctr" id="rv2"><span class="grad">AI Employee.</span></div></div>

<div class="sc" id="s-voice">${head("voice", 0)}
<div class="ui" id="v-ui"><div class="hd"><span class="dot"></span>Voice AI · Inbound call<span class="r" id="v-timer">00:00</span></div><div id="v-wave"></div><div id="v-tx"></div></div>
<div class="ui" id="v-book"><div class="ok">✓</div><div class="bk"><b>Appointment booked</b><span>Tomorrow · 10:30 AM · New patient consult</span></div><span class="tag g" style="margin-left:auto">Calendar</span></div></div>

<div class="sc" id="s-conv">${head("conv", 1)}
<div class="ui" id="c-ui"><div id="c-list"><div class="hd">Conversations</div></div><div id="c-th"><div class="hd" id="c-hd">Jordan Lee <span class="tag" style="margin-left:6px">Instagram</span><span class="r">7:42 AM</span></div><div id="c-msgs"></div></div></div></div>

<div class="sc" id="s-rev">${head("rev", 2)}
<div class="ui" id="r-card"><div class="top"><div class="avs" style="background:#7c3aed;width:64px;height:64px;border-radius:32px;font-size:24px">MR</div><div><b style="font-size:26px">Maria Ruiz</b><div style="color:#6b7280;font-size:19px">Google review · just now</div></div><div class="stars" id="r-stars" style="margin-left:auto"><i>★</i><i>★</i><i>★</i><i>★</i><i>★</i></div></div>
<div id="r-text">“Best dental visit I’ve ever had. The whole team was so kind, and booking took two minutes.”</div></div>
<div class="ui" id="r-reply"><span class="tag"><span class="spark">✦</span> Reviews AI drafted a reply</span><div id="r-rt"></div><div id="r-post"><span class="btn" id="r-btn">Post reply</span></div></div></div>

<div class="sc" id="s-content">${head("content", 3)}
<div class="ui" id="ct-prompt"><div class="prompt"><span class="spark">✦</span><span id="ct-q"></span></div></div>
<div class="ui" id="ct-post"><div id="ct-img"><div class="s"></div><div class="w"></div><div class="t">Summer<br>smiles</div><div class="shim"></div></div><div id="ct-cap"></div></div>
<div class="ui" id="ct-blog"><span class="tag">Blog draft</span><b>5 ways to keep your smile bright this summer</b><div class="ln"></div><div class="ln" style="width:90%"></div><div class="ln" style="width:95%"></div><div class="ln" style="width:70%"></div><div class="ln" style="width:85%"></div><div class="ln" style="width:60%"></div></div></div>

<div class="sc" id="s-funnel">${head("funnel", 4)}
<div class="ui" id="f-prompt"><div class="prompt"><span class="spark">✦</span><span id="f-q"></span></div></div>
<svg id="f-arrows" width="${W}" height="${H}"></svg><div id="f-pages"></div></div>

<div class="sc" id="s-flow">${head("flow", 5)}
<div class="ui" id="w-ui"><svg id="w-lines" width="960" height="820"></svg><div id="w-ai"><span class="tag"><span class="spark">✦</span> Workflow AI</span><div class="q" id="w-q"></div><div id="w-sug" style="color:#6b7280;opacity:0">Suggested 5 steps</div><div style="margin-top:14px"><span class="btn" id="w-btn" style="opacity:0">Apply</span></div></div><div id="w-nodes"></div></div></div>

<div class="sc" id="s-recap"><div class="ctr" id="rc1">One day. Six AI teammates.</div><div class="ctr" id="rc2">Calls, messages, reviews, content, funnels and follow-ups.</div><div id="rcards"></div></div>

<div class="sc" id="s-end"><img id="elogo" src="${LOGO}"><div class="ctr" id="etitle"><span class="grad">AI Employee</span></div><div class="ctr" id="etag">Your best hire never clocks out.</div><div id="eurl">app.gohighlevel.com</div></div>

<div id="clock"></div>
<div id="foot">UI recreated for illustration · sample data</div>
</div>
<script>stage.build((tl, S) => {${film}});</script>`;
writeExample(import.meta.url, { html, duration: T.DUR, id: "oneday", width: W, height: H });
console.log(`template ${(html.length / 1e6).toFixed(2)} MB`);
