// Example 10 · Testimonial wall (Build trust → Social proof, 16:9 + 9:16, 23.8 s, four themes)
//
// Customer love as a short film: a tilted wall of quote cards drifting in
// opposite directions, a pull quote with a highlighter sweep, the average
// rating with a star fill and its breakdown, a customer story card, and two
// rows of customer names running past each other. Avatars need no images:
// each one prints the first letter of the person's name (::first-letter on a
// zero-size line), so editing a name updates its avatar. Built on the shared
// kit (../_kit.mjs); paper is this template's own theme, with -midnight,
// -terminal and -pop variants.
//
//   node examples/templates/testimonial-wall/build.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTemplates, color, paths, text, themeField, themeFonts } from "../_kit.mjs";

const ID = "testimonial-wall";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asset, outDir } = paths(here, ID);
const C = ["primary", "secondary"];
const pct = (name, label, def) => text(name, label, def, { pattern: "^[0-9]{1,3}$", description: "Percent of reviews, 0–100." });

const QUOTES = [
  ["We shipped our launch video in an afternoon. The old way took a week.", "Maya Lin", "Head of Marketing"],
  ["The template form is the whole trick. Sales edits their own demos now.", "Daniel Okafor", "Founder"],
  ["Finally, motion that doesn't look like a slideshow.", "Priya Raman", "Design Lead"],
  ["It plugged into our editor in two days. Undo just works.", "Tom Becker", "Staff Engineer"],
  ["Our weekly update video went from chore to habit.", "Sofia García", "Chief of Staff"],
  ["Four themes from one template. Our brand team cried a little.", "Kenji Sato", "Brand Manager"],
];

const fields = [
  themeField("paper"),
  color("primary", "Brand colour", "#e4572e"),
  color("secondary", "Second colour", "#2e86ab"),
  text("brand", "Product name", "Miraiclip", { maxLength: 20 }),
  text("eyebrow", "Hook · eyebrow", "Loved by 4,000 teams", { maxLength: 28 }),
  text("hook1", "Hook · line 1", "Don't take our word for it.", { maxLength: 30 }),
  text("hook2", "Hook · line 2 (accent)", "Take theirs.", { maxLength: 24 }),
  text("wallTitle", "Wall · headline", "What teams are saying", { maxLength: 30 }),
  ...QUOTES.flatMap(([q, n, r], i) => [
    text(`q${i + 1}`, `Quote ${i + 1}`, q, { maxLength: 90 }),
    text(`n${i + 1}`, `Quote ${i + 1} · name`, n, { maxLength: 22 }),
    text(`r${i + 1}`, `Quote ${i + 1} · role`, r, { maxLength: 26 }),
  ]),
  text("fq", "Pull quote", "It's the first video tool our whole team actually uses, not just the one person who knows After Effects.", { maxLength: 130 }),
  text("fqName", "Pull quote · name", "Amara Nwosu", { maxLength: 22 }),
  text("fqRole", "Pull quote · role and company", "VP Growth, Northwind", { maxLength: 36 }),
  text("rating", "Rating · average", "4.9", { pattern: "^[0-5](\\.[0-9])?$", description: "Average out of 5, like 4.9. The stars fill to it." }),
  text("reviews", "Rating · number of reviews", "2400", { pattern: "^[0-9]{1,4}$", description: "A whole number; it counts up from 0." }),
  text("ratingLabel", "Rating · label", "reviews, and counting", { maxLength: 28 }),
  pct("s5", "Rating · 5-star share", "86"),
  pct("s4", "Rating · 4-star share", "10"),
  pct("s3", "Rating · 3-star share", "3"),
  pct("s2", "Rating · 2-star share", "1"),
  pct("s1", "Rating · 1-star share", "0"),
  text("story", "Story · quote", "We cut review rounds from five to two. Everyone edits the same template, so nothing drifts off brand.", { maxLength: 120 }),
  text("storyName", "Story · name", "Lucas Moreau", { maxLength: 22 }),
  text("storyRole", "Story · role and company", "Creative Director, Fieldwork", { maxLength: 36 }),
  text("storyStat", "Story · result", "3× faster reviews", { maxLength: 22 }),
  text("verified", "Story · badge", "Verified customer", { maxLength: 22 }),
  text("logosTitle", "Customers · headline", "Teams that switched this year", { maxLength: 34 }),
  ...["Northwind", "Fieldwork", "Lumen Labs", "Parcel", "Orbit & Co", "Kestrel", "Halcyon", "Bramble"].map((c, i) => text(`c${i + 1}`, `Customer ${i + 1}`, c, { maxLength: 16 })),
  text("more", "Customers · more", "+ 4,000 more", { maxLength: 18 }),
  text("endLine", "End card · line", "Join them. Your first video is on us.", { maxLength: 48 }),
  text("cta", "End card · button", "Start free", { maxLength: 24 }),
];

// An avatar that prints the first letter of a name: the name sits in a
// zero-size line and ::first-letter brings back only its first character.
const AV = `.av{flex:none;display:block;width:var(--s,64px);height:var(--s,64px);border-radius:50%;overflow:hidden;font-size:0;line-height:var(--s,64px);text-align:center;white-space:nowrap;color:#fff;background:linear-gradient(135deg,{{primary}},{{secondary}});font-family:var(--display);font-weight:var(--dw)}
.av::first-letter{font-size:calc(var(--s,64px) * .46)}
.t-pop .av,.t-paper .av{border:var(--border)}
.t-terminal .av{color:#031003}`;
const STARS = `.stars{color:{{secondary}};letter-spacing:.12em}.t-pop .stars{color:#111}`;

// One quote card (wall).
const card = (i) => `<div class="card"><div class="stars">★★★★★</div><div class="q">{{q${i}}}</div><div class="who"><span class="av">{{n${i}}}</span><div><div class="nm">{{n${i}}}</div><div class="rl">{{r${i}}}</div></div></div></div>`;

const scenes = [
  // 1 · Hook
  {
    seconds: 2.6, uses: [...C, "eyebrow", "hook1", "hook2"],
    css: `.wrap{position:absolute;left:160px;top:330px}
.h1{font-size:calc(132px * var(--ds));line-height:1.04}
@keyframes track{from{letter-spacing:.9em;opacity:0;filter:blur(6px)}}
.eyebrow{animation:track 1.1s var(--out) both}
.l2{display:inline-block;animation:reveal .9s cubic-bezier(.65,0,.35,1) both,shimmer 3.2s linear infinite}
@keyframes qdrop{from{transform:translateY(-120px) rotate(-14deg);opacity:0}}
.mark{position:absolute;right:170px;top:120px;font-family:var(--display);font-size:620px;line-height:1;color:{{primary}};opacity:.9;animation:qdrop 1.1s var(--move) both}
.t-midnight .mark{opacity:.35}.t-terminal .mark{color:{{secondary}};opacity:.5}`,
    body: `<div class="mark" style="--d:.2s">“</div><div class="wrap"><div class="eyebrow" style="--d:.05s">{{eyebrow}}</div><div style="height:30px"></div>
<div class="h1 disp r" style="--d:.15s">{{hook1}}</div><div class="h1 disp grad l2" style="--d:.6s">{{hook2}}</div></div>`,
    vertical: `.wrap{left:80px;top:760px;width:920px}.h1{font-size:calc(112px * var(--ds))}.mark{right:60px;top:220px;font-size:520px}`,
  },
  // 2 · Wall — four columns of quote cards drift in opposite directions on a
  // wall tipped back in perspective, fading out at the top and bottom edges.
  {
    seconds: 4.4, uses: [...C, "wallTitle", ...QUOTES.flatMap((_, i) => [`q${i + 1}`, `n${i + 1}`, `r${i + 1}`])],
    css: `${AV}${STARS}
.t{position:absolute;left:0;width:100%;top:80px;text-align:center;font-size:calc(72px * var(--ds));z-index:2}
.wall{position:absolute;left:100px;top:200px;width:1720px;height:880px;display:flex;gap:32px;transform:perspective(2400px) rotateX(14deg);transform-origin:50% 0;-webkit-mask:linear-gradient(transparent,#000 14%,#000 80%,transparent);mask:linear-gradient(transparent,#000 14%,#000 80%,transparent);animation:fadein .8s var(--out) both}
.col{flex:1;display:flex;flex-direction:column;gap:28px}
@keyframes up{from{transform:translateY(0)}to{transform:translateY(-420px)}}
@keyframes down{from{transform:translateY(-420px)}to{transform:translateY(0)}}
.c1,.c3{animation:up 4.4s linear both}.c2,.c4{animation:down 4.4s linear both}.c3{animation-duration:3.6s}
.card{padding:30px 32px;border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:var(--shadow)}
.card .stars{font-size:24px}
.q{margin-top:14px;font-family:var(--display);font-weight:calc(var(--dw) - 200);font-size:calc(32px * var(--ds));line-height:1.3;color:var(--ink)}
.t-paper .q{font-weight:400}
.who{display:flex;align-items:center;gap:16px;margin-top:22px;--s:56px}
.nm{font-size:24px;font-weight:700;color:var(--ink)}.rl{font-size:20px;color:var(--dim);margin-top:2px}`,
    body: `<div class="t disp r" style="--d:.05s">{{wallTitle}}</div>
<div class="wall" style="--d:0s">
<div class="col c1" style="--d:0s">${[1, 5, 3, 2, 6, 4].map(card).join("")}</div>
<div class="col c2" style="--d:0s">${[4, 2, 6, 1, 3, 5].map(card).join("")}</div>
<div class="col c3" style="--d:0s">${[3, 6, 1, 4, 5, 2].map(card).join("")}</div>
<div class="col c4" style="--d:0s">${[6, 4, 5, 3, 2, 1].map(card).join("")}</div></div>`,
    vertical: `.t{top:300px;left:80px;width:920px;line-height:1.08}
.wall{left:60px;top:500px;width:960px;height:1420px}.c3,.c4{display:none}.q{font-size:calc(34px * var(--ds))}`,
  },
  // 3 · Pull quote — the quote mark drops, the words land, a highlighter
  // sweeps across every line, and the person slides in under it.
  {
    seconds: 3.8, uses: [...C, "fq", "fqName", "fqRole"],
    css: `${AV}
@keyframes qdrop{from{transform:translateY(-100px) scale(.7);opacity:0}}
.mark{position:absolute;left:150px;top:150px;font-family:var(--display);font-size:300px;line-height:1;color:{{primary}};animation:qdrop .8s var(--move) both}
.qt{position:absolute;left:330px;top:250px;width:1360px;font-size:calc(70px * var(--ds));line-height:1.28}
@keyframes mark{from{background-size:0% 100%}to{background-size:100% 100%}}
.mk{background:linear-gradient(color-mix(in srgb,{{secondary}} 34%,transparent),color-mix(in srgb,{{secondary}} 34%,transparent)) no-repeat 0 85%/0% 100%;-webkit-box-decoration-break:clone;box-decoration-break:clone;animation:mark 1.2s cubic-bezier(.65,0,.35,1) both}
.t-paper .mk{background-image:linear-gradient(color-mix(in srgb,{{primary}} 22%,transparent),color-mix(in srgb,{{primary}} 22%,transparent))}
.who{position:absolute;left:330px;top:800px;display:flex;align-items:center;gap:24px;--s:96px;animation:lift .8s var(--move) both,clear .5s var(--out) both}
.nm{font-size:36px;font-weight:700}.rl{font-size:28px;color:var(--muted);margin-top:4px}
.bar{position:absolute;left:330px;top:770px;width:120px;height:5px;background:{{primary}};transform-origin:left;animation:grow .6s var(--out) both}`,
    body: `<div class="mark" style="--d:0s">“</div>
<div class="qt disp r" style="--d:.15s"><span class="mk" style="--d:1.0s">{{fq}}</span></div>
<div class="bar" style="--d:1.6s"></div>
<div class="who" style="--d:1.75s"><span class="av">{{fqName}}</span><div><div class="nm">{{fqName}}</div><div class="rl">{{fqRole}}</div></div></div>`,
    vertical: `.mark{left:60px;top:330px;font-size:260px}.qt{left:80px;top:560px;width:920px;font-size:calc(64px * var(--ds))}.who{left:80px;top:1240px}.bar{left:80px;top:1200px}`,
  },
  // 4 · Rating — the average lands, five stars fill to it, the review count
  // counts up, and the breakdown bars grow one by one.
  {
    seconds: 3.4, uses: [...C, "rating", "reviews", "ratingLabel", "s5", "s4", "s3", "s2", "s1"],
    css: `@property --n{syntax:'&lt;integer&gt;';inherits:false;initial-value:0}
@keyframes count{from{--n:0}to{--n:var(--to)}}
.num{counter-reset:n var(--n);animation:count 1.6s var(--out) both}.num::after{content:counter(n)}
.l{position:absolute;left:160px;top:250px;width:760px}
@keyframes focusIn{from{transform:scale(.8);opacity:0;filter:blur(16px)}}
.avg{font-size:calc(300px * var(--ds));line-height:.95;animation:focusIn .9s var(--out) both}
.avg small{font-size:.3em;color:var(--dim);margin-left:12px}
.st{position:relative;display:inline-block;margin-top:24px;font-size:84px;letter-spacing:.1em;line-height:1}
.st .bg{color:color-mix(in srgb,var(--ink) 16%,transparent)}
@keyframes fillw{from{width:0}}
.st .fg{position:absolute;left:0;top:0;width:calc(var(--r) / 5 * 100%);overflow:hidden;white-space:nowrap;color:{{secondary}};animation:fillw 1.3s cubic-bezier(.65,0,.35,1) both}
.t-pop .st .fg{color:{{primary}}}
.cnt{margin-top:30px;font-size:36px;color:var(--muted);font-weight:500}.cnt b{color:var(--ink);font-weight:800}
.br{position:absolute;left:1060px;top:300px;width:700px;padding:44px 48px;border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:var(--shadow);animation:lift .9s var(--move) both,clear .5s var(--out) both}
.row{display:flex;align-items:center;gap:22px;height:78px;font-size:30px;font-weight:700;color:var(--ink)}
.row .k{width:56px}.row .tr{flex:1;height:22px;border-radius:11px;background:color-mix(in srgb,var(--ink) 9%,transparent);overflow:hidden}
.row .fl{height:100%;border-radius:11px;background:{{primary}};animation:fillw 1s var(--out) both}
.row:first-child .fl{background:linear-gradient(90deg,{{primary}},{{secondary}})}
.row .v{width:84px;text-align:right;color:var(--muted)}`,
    body: `<div class="l" style="--r:{{rating}}"><div class="avg disp" style="--d:.1s">{{rating}}<small>/ 5</small></div>
<div class="st" style="--d:.5s"><div class="bg">★★★★★</div><div class="fg" style="--d:.5s">★★★★★</div></div>
<div class="cnt r" style="--d:.8s"><b><span class="num" style="--to:{{reviews}};--d:.8s"></span></b> {{ratingLabel}}</div></div>
<div class="br" style="--d:.35s">${[5, 4, 3, 2, 1].map((s, j) => `<div class="row"><span class="k">${s}★</span><div class="tr"><div class="fl" style="width:calc({{s${s}}} * 1%);--d:${(0.8 + j * 0.12).toFixed(2)}s"></div></div><span class="v">{{s${s}}}%</span></div>`).join("")}</div>`,
    vertical: `.l{left:80px;top:300px;width:920px;text-align:center}.br{left:110px;top:1100px;width:860px}`,
  },
  // 5 · Story — a portrait card with a big initial tips in, the quote wipes
  // down line by line, then the verified badge and the result pop.
  {
    seconds: 3.8, uses: [...C, "story", "storyName", "storyRole", "storyStat", "verified"],
    css: `${AV}
.pc{position:absolute;left:160px;top:200px;width:560px;height:680px;border-radius:var(--r);overflow:hidden;background:linear-gradient(160deg,{{primary}},{{secondary}});border:var(--border);box-shadow:var(--shadow);animation:tiltY 1.1s var(--spring) both,clear .6s var(--out) both}
.t-terminal .pc{background:linear-gradient(160deg,color-mix(in srgb,{{primary}} 40%,#000),#000)}
.pc .av{position:absolute;left:0;top:40px;width:560px;height:440px;border-radius:0;background:none;border:0;--s:440px;line-height:440px;color:#ffffffe6}
.pc .av::first-letter{font-size:360px}
.pc .meta{position:absolute;left:40px;right:40px;bottom:40px;padding:22px 26px;border-radius:var(--rs);background:var(--surface);border:var(--border);color:var(--ink)}
.nm{font-size:32px;font-weight:700}.rl{font-size:24px;color:var(--muted);margin-top:4px}
.qt{position:absolute;left:820px;top:240px;width:940px;font-size:calc(58px * var(--ds));line-height:1.3}
@keyframes wipeDown{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}
.qt>div{animation:wipeDown 1.4s steps(4,end) both}
.chips{position:absolute;left:820px;top:760px;display:flex;gap:20px}
.chip{display:flex;align-items:center;gap:12px;padding:16px 26px;border-radius:999px;font-size:30px;font-weight:700;animation:popIn .7s var(--bounce) both,clear .3s var(--out) both}
.ok{background:var(--surface);border:var(--border);color:var(--ink)}.ok b{width:34px;height:34px;border-radius:50%;background:{{secondary}};color:#111;display:flex;align-items:center;justify-content:center;font-size:20px}
.res{background:var(--solid);color:var(--on-solid)}`,
    body: `<div class="pc" style="--d:.05s"><span class="av">{{storyName}}</span><div class="meta"><div class="nm">{{storyName}}</div><div class="rl">{{storyRole}}</div></div></div>
<div class="qt disp"><div style="--d:.6s">“{{story}}”</div></div>
<div class="chips"><div class="chip ok" style="--d:2.1s"><b>✓</b>{{verified}}</div><div class="chip res" style="--d:2.35s">▲ {{storyStat}}</div></div>`,
    vertical: `.pc{left:260px;top:200px;width:560px;height:680px}.qt{left:80px;top:980px;width:920px;font-size:calc(54px * var(--ds))}.chips{left:80px;top:1620px;flex-wrap:wrap}`,
  },
  // 6 · Customers — two rows of names run past each other, then the
  // "more" chip pops in the middle.
  {
    seconds: 3.0, uses: [...C, "logosTitle", "more", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"],
    css: `.t{position:absolute;left:0;width:100%;top:200px;text-align:center;font-size:calc(76px * var(--ds))}
.rows{position:absolute;left:0;right:0;top:400px;display:flex;flex-direction:column;gap:36px;-webkit-mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.rw{display:flex;gap:28px;white-space:nowrap}
@keyframes left{from{transform:translateX(0)}to{transform:translateX(-640px)}}
@keyframes right{from{transform:translateX(-640px)}to{transform:translateX(0)}}
.a{animation:left 3s linear both}.b{animation:right 3s linear both}
.lg{display:flex;align-items:center;gap:16px;padding:26px 40px;border-radius:var(--r);background:var(--surface);border:var(--border);font-family:var(--display);font-weight:var(--dw);font-size:calc(44px * var(--ds));color:var(--ink)}
.lg i{width:30px;height:30px;border-radius:9px;background:{{primary}}}.lg:nth-child(3n+2) i{border-radius:50%;background:{{secondary}}}.lg:nth-child(3n) i{transform:rotate(45deg);border-radius:4px}
.more{position:absolute;left:0;width:100%;top:800px;text-align:center}
.more span{display:inline-block;padding:20px 40px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-size:36px;font-weight:800;animation:popIn .8s var(--bounce) both,clear .3s var(--out) both}`,
    body: `<div class="t disp r" style="--d:.05s">{{logosTitle}}</div>
<div class="rows f" style="--d:.2s"><div class="rw a" style="--d:0s">${[1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3].map((i) => `<div class="lg"><i></i>{{c${i}}}</div>`).join("")}</div>
<div class="rw b" style="--d:0s">${[5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7].map((i) => `<div class="lg"><i></i>{{c${i}}}</div>`).join("")}</div></div>
<div class="more"><span style="--d:1.2s">{{more}}</span></div>`,
    vertical: `.t{top:500px;left:80px;width:920px;line-height:1.08}.rows{top:820px}.more{top:1300px}`,
  },
  // 7 · End card
  {
    seconds: 2.8, last: true, uses: [...C, "brand", "endLine", "cta"],
    css: `.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
@keyframes bloom{from{transform:scale(.5);opacity:0}}
.glow{position:absolute;left:460px;top:140px;width:1000px;height:640px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,{{primary}} 30%,transparent),transparent);animation:bloom 1.4s var(--out) both}
@keyframes focusIn{from{transform:scale(.86);opacity:0;filter:blur(18px)}}
.wm{position:relative;font-size:calc(150px * var(--ds));animation:focusIn 1s var(--out) both;text-align:center}
@keyframes drop{from{transform:translateY(-170px)}}
.dot{display:inline-block;width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,{{primary}},{{secondary}});margin-left:10px;animation:drop .9s var(--bounce) both,fadein .2s linear both}
.tag{margin-top:18px;font-size:42px;color:var(--muted);font-weight:500;text-align:center}
.btn{position:relative;margin-top:70px}
.cta{padding:26px 54px;border-radius:999px;background:var(--solid);color:var(--on-solid);font-weight:700;font-size:40px}
@keyframes pulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.35,1.8);opacity:0}}
.ping{position:absolute;inset:0;border-radius:999px;border:3px solid {{secondary}};animation:pulse 1.1s ease-out 3 both}`,
    body: `<div class="glow" style="--d:.05s"></div>
<div class="c"><div class="wm disp" style="--d:.1s">{{brand}}<span class="dot" style="--d:.55s"></span></div>
<div class="tag r" style="--d:.6s">{{endLine}}</div>
<div class="btn r" style="--d:.85s"><div class="ping" style="--d:1.45s"></div><div class="cta">{{cta}}</div></div></div>`,
    vertical: `.wm{font-size:calc(120px * var(--ds));width:960px}.glow{left:40px;top:560px}.tag{font-size:38px;width:900px}`,
  },
];

buildTemplates({
  id: ID,
  name: "Testimonial wall",
  description: "A 24-second social-proof film: a drifting wall of quote cards, a pull quote with a highlighter sweep, the average rating with filling stars and a breakdown, a customer story with a result, and rows of customer names. Every quote, name, number, both colours and the theme are fields; avatars use each name's first letter.",
  category: "social-proof",
  tags: ["build-trust", "testimonials", "reviews", "saas"],
  fields,
  scenes,
  themes: ["paper", "midnight", "terminal", "pop"],
  assets: themeFonts(asset),
  here,
  outDir,
});
