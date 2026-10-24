// Example 9 · Metrics reel (Report & present → Results, 16:9 + 9:16, 24 s, four themes)
//
// A quarter's results as a short film: a ticker hook, one hero number that
// counts up over a drawn sparkline, a line chart that draws itself from six
// editable points, ranked bars, four KPI tiles and a goal ring that laps past
// 100 %. Every number, label and point is a field, so the same film reports any
// period. Built on the shared kit (../_kit.mjs); terminal is this template's own
// theme, with -midnight, -paper and -pop variants.
//
//   node examples/templates/metrics-reel/build.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTemplates, color, paths, text, themeField, themeFonts } from "../_kit.mjs";

const ID = "metrics-reel";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asset, outDir } = paths(here, ID);
const C = ["primary", "secondary"];

const num = (name, label, def, digits = 4) => text(name, label, def, { pattern: `^[0-9]{1,${digits}}$`, description: "A whole number; it counts up from 0." });
const pt = (name, label, def) => text(name, label, def, { pattern: "^[0-9]{1,3}$", description: "Height of this point, 0–100 (100 is the top of the chart)." });
const share = (name, label, def) => text(name, label, def, { pattern: "^[0-9]{1,3}$", description: "A whole number. Bars are drawn relative to the largest one." });

const fields = [
  themeField("terminal"),
  color("primary", "Brand colour", "#3ddc84"),
  color("secondary", "Second colour", "#b6ff3b"),
  text("company", "Company", "Miraiclip", { maxLength: 20 }),
  text("period", "Period", "Q3 2026", { maxLength: 16 }),
  text("hook1", "Hook · line 1", "Our quarter,", { maxLength: 22 }),
  text("hook2", "Hook · line 2 (accent)", "in numbers.", { maxLength: 22 }),
  text("heroLabel", "Hero · what it measures", "Annual recurring revenue", { maxLength: 32 }),
  text("heroPre", "Hero · before the number", "$", { maxLength: 2 }),
  num("heroNum", "Hero · number", "248"),
  text("heroUnit", "Hero · after the number", "K", { maxLength: 3 }),
  text("heroDelta", "Hero · change", "+42% vs Q2", { maxLength: 18 }),
  text("heroNote", "Hero · note", "From 1,180 paying teams.", { maxLength: 40 }),
  text("chartTitle", "Chart · headline", "Weekly active editors", { maxLength: 28 }),
  text("chartDelta", "Chart · change", "3.1× since April", { maxLength: 20 }),
  text("chartValue", "Chart · last value", "18.2K", { maxLength: 8 }),
  text("chartUnit", "Chart · last value label", "this week", { maxLength: 14 }),
  ...[["Apr", 14], ["May", 22], ["Jun", 31], ["Jul", 44], ["Aug", 63], ["Sep", 86]].flatMap(([m, v], i) => [
    text(`m${i + 1}`, `Chart · label ${i + 1}`, m, { maxLength: 5 }),
    pt(`p${i + 1}`, `Chart · point ${i + 1}`, String(v)),
  ]),
  text("barsTitle", "Bars · headline", "Where new revenue came from", { maxLength: 32 }),
  text("barsUnit", "Bars · unit", "%", { maxLength: 3 }),
  ...[["Self-serve", 38], ["Partners", 24], ["Enterprise", 19], ["Agencies", 12], ["Education", 7]].flatMap(([l, v], i) => [
    text(`b${i + 1}`, `Bar ${i + 1} · label`, l, { maxLength: 16 }),
    share(`b${i + 1}v`, `Bar ${i + 1} · value`, String(v)),
  ]),
  text("kpiTitle", "KPIs · headline", "The rest of the dashboard", { maxLength: 32 }),
  ...[["Net retention", "128", "%"], ["Videos rendered", "940", "K"], ["Median export", "38", "s"], ["Countries", "112", ""]].flatMap(([l, n, u], i) => [
    text(`k${i + 1}`, `KPI ${i + 1} · label`, l, { maxLength: 18 }),
    num(`k${i + 1}n`, `KPI ${i + 1} · number`, n),
    text(`k${i + 1}u`, `KPI ${i + 1} · unit`, u, { maxLength: 3 }),
  ]),
  text("goalTitle", "Goal · headline", "We set a goal. Then we passed it.", { maxLength: 40 }),
  text("goalSub", "Goal · subline", "New ARR against the target we set in July.", { maxLength: 56 }),
  num("goalPct", "Goal · percent of target", "112", 3),
  text("goalLabel", "Goal · ring label", "of target", { maxLength: 14 }),
  text("goalStamp", "Goal · stamp", "Target beaten", { maxLength: 16 }),
  text("endLine", "End card · line", "Thanks for building with us. On to Q4.", { maxLength: 48 }),
  text("cta", "End card · button", "Read the full report", { maxLength: 28 }),
];

// The integer counter: --n counts from 0 to --to and prints through a CSS counter.
// (`<` and `>` are escaped: the scene is parsed as XHTML when it is rasterized.)
const COUNT = `@property --n{syntax:'&lt;integer&gt;';inherits:false;initial-value:0}
@keyframes count{from{--n:0}to{--n:var(--to)}}
.num{counter-reset:n var(--n);animation:count 1.6s var(--out) both}
.num::after{content:counter(n)}`;

const scenes = [
  // 1 · Hook — the period tracks in, two lines land, and a ticker of this
  // film's own numbers scrolls along the bottom.
  {
    seconds: 2.6, uses: [...C, "company", "period", "hook1", "hook2", "heroLabel", "heroDelta", "chartTitle", "chartDelta", "goalPct", "goalLabel"],
    css: `.wrap{position:absolute;left:160px;top:300px}
.h1{font-size:calc(150px * var(--ds));line-height:1.02}
@keyframes track{from{letter-spacing:.9em;opacity:0;filter:blur(6px)}}
.eyebrow{animation:track 1.1s var(--out) both}
.l2{display:inline-block;animation:reveal .9s cubic-bezier(.65,0,.35,1) both,shimmer 3.2s linear infinite}
.tick{position:absolute;left:0;right:0;top:880px;height:96px;overflow:hidden;border-top:var(--border);border-bottom:var(--border);background:var(--shade);display:flex;align-items:center;animation:fadein .5s var(--out) both}
@keyframes marq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.tape{display:flex;white-space:nowrap;font-size:30px;font-weight:600;color:var(--muted);animation:marq 5.2s linear both}
.tape span{padding:0 44px}.tape b{color:{{secondary}};font-weight:800;margin-left:14px}`,
    body: `<div class="wrap"><div class="eyebrow" style="--d:.05s">{{company}} · {{period}}</div><div style="height:30px"></div>
<div class="h1 disp r" style="--d:.15s">{{hook1}}</div><div class="h1 disp grad l2" style="--d:.55s">{{hook2}}</div></div>
<div class="tick mono" style="--d:.3s"><div class="tape" style="--d:0s">${[0, 1].map(() => `<span>▲ {{heroLabel}}<b>{{heroDelta}}</b></span><span>▲ {{chartTitle}}<b>{{chartDelta}}</b></span><span>● {{goalPct}}% {{goalLabel}}<b>{{period}}</b></span>`).join("")}</div></div>`,
    vertical: `.wrap{left:80px;top:640px;width:920px}.h1{font-size:calc(124px * var(--ds))}.tick{top:1560px}`,
  },
  // 2 · Hero number — counts up and comes into focus while a sparkline draws
  // across the bottom of the frame; the change pops in as a chip.
  {
    seconds: 3.6, uses: [...C, "heroLabel", "heroPre", "heroNum", "heroUnit", "heroDelta", "heroNote"],
    css: `${COUNT}
.spark{position:absolute;left:0;bottom:0;width:100%;height:440px;animation:reveal 2.2s cubic-bezier(.3,0,.2,1) both}
.spark svg{width:100%;height:100%;display:block;overflow:visible}
.col{position:absolute;left:160px;top:250px}
.lab{animation:track 1s var(--out) both}
@keyframes track{from{letter-spacing:.7em;opacity:0}}
.big{display:flex;align-items:baseline;margin-top:10px;font-size:calc(300px * var(--ds));line-height:1}
.big .grad{display:flex;align-items:baseline;animation:clear 1.2s var(--out) both}
.pre,.unit{font-size:.5em}
.t-terminal .big .grad::before{content:none}
.chip{display:inline-flex;align-items:center;gap:12px;margin-top:34px;padding:14px 26px;border-radius:999px;background:{{secondary}};color:#111;font-size:34px;font-weight:800;animation:popIn .7s var(--bounce) both,clear .3s var(--out) both}
.note{margin-top:28px;font-size:36px;color:var(--muted);font-weight:500}`,
    body: `<div class="spark" style="--d:.3s"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 200" preserveAspectRatio="none"><defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{primary}}" stop-opacity=".35"/><stop offset="1" stop-color="{{primary}}" stop-opacity="0"/></linearGradient></defs>
<path d="M0 182 C80 176 120 170 180 168 S300 150 360 154 S470 128 540 120 S660 112 720 84 S860 52 1000 18 L1000 200 L0 200 Z" fill="url(#hg)"/>
<path d="M0 182 C80 176 120 170 180 168 S300 150 360 154 S470 128 540 120 S660 112 720 84 S860 52 1000 18" fill="none" stroke="{{primary}}" stroke-width="5" vector-effect="non-scaling-stroke"/></svg></div>
<div class="col"><div class="eyebrow lab" style="--d:.05s">{{heroLabel}}</div>
<div class="big disp"><div class="grad" style="--d:.2s"><span class="pre">{{heroPre}}</span><span class="num" style="--to:{{heroNum}};--d:.2s"></span><span class="unit">{{heroUnit}}</span></div></div>
<div class="chip" style="--d:1.5s">▲ {{heroDelta}}</div>
<div class="note r" style="--d:1.75s">{{heroNote}}</div></div>`,
    vertical: `.col{left:80px;top:520px;width:920px}.big{font-size:calc(230px * var(--ds))}.spark{height:760px}`,
  },
  // 3 · Line chart — the panel lands, the line and its area draw left to right
  // behind a scan line, each point pops as the line reaches it, and the last
  // value gets a tooltip.
  {
    seconds: 4.2, uses: [...C, "chartTitle", "chartDelta", "chartValue", "chartUnit", "period", "m1", "m2", "m3", "m4", "m5", "m6", "p1", "p2", "p3", "p4", "p5", "p6"],
    css: `.t{position:absolute;left:160px;top:110px;font-size:calc(76px * var(--ds))}
.sub{position:absolute;left:160px;top:212px;font-size:30px;color:var(--muted);font-weight:500}
.delta{position:absolute;right:160px;top:130px;padding:14px 26px;border-radius:999px;border:var(--border);background:var(--surface);font-size:30px;font-weight:800;color:var(--ink);animation:popIn .7s var(--bounce) both,clear .3s var(--out) both}
.delta b{color:{{primary}}}
.panel{position:absolute;left:160px;top:300px;width:1600px;height:680px;border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:var(--shadow);animation:lift .9s var(--move) both,clear .6s var(--out) both}
.plot{position:absolute;left:90px;right:90px;top:80px;height:440px;background:repeating-linear-gradient(0deg,color-mix(in srgb,var(--ink) 10%,transparent) 0 2px,transparent 2px 110px)}
.draw{position:absolute;inset:0;animation:reveal 1.8s linear both}
.draw svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.scan{position:absolute;top:-20px;bottom:0;width:2px;background:{{secondary}};box-shadow:0 0 18px {{secondary}};animation:scan 1.8s linear both,fadeout .3s ease-in both}
@keyframes scan{from{left:0}to{left:100%}}
.dot{position:absolute;width:0;height:0}
.dot i{position:absolute;left:-13px;top:-13px;width:26px;height:26px;border-radius:50%;background:var(--surface);border:6px solid {{primary}};animation:popIn .5s var(--bounce) both,fadein .15s linear both}
.dot.last i{left:-18px;top:-18px;width:36px;height:36px;background:{{primary}};border-color:var(--surface);box-shadow:0 0 0 6px color-mix(in srgb,{{primary}} 35%,transparent)}
.tip{position:absolute;right:0;transform:translate(-40px,-30px);padding:18px 26px;border-radius:var(--rs);background:var(--solid);color:var(--on-solid);white-space:nowrap;box-shadow:var(--shadow);animation:popIn .6s var(--spring) both,clear .3s var(--out) both;transform-origin:100% 100%}
.tip .v{font-size:48px;font-weight:800;line-height:1}.tip .u{font-size:22px;opacity:.7;margin-top:6px}
.xs{position:absolute;left:90px;right:90px;top:560px;height:40px;font-size:26px;font-weight:600;color:var(--dim)}
.xs span{position:absolute;transform:translateX(-50%)}`,
    body: `<div class="t disp r" style="--d:.05s">{{chartTitle}}</div><div class="sub r" style="--d:.2s">{{period}}</div>
<div class="delta" style="--d:2.6s"><b>▲</b> {{chartDelta}}</div>
<div class="panel" style="--d:.1s"><div class="plot">
<div class="draw" style="--d:.7s"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 100" preserveAspectRatio="none"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{primary}}" stop-opacity=".4"/><stop offset="1" stop-color="{{primary}}" stop-opacity="0"/></linearGradient></defs>
<g transform="translate(0 100) scale(1 -1)"><path d="M0 0 L0 {{p1}} L100 {{p2}} L200 {{p3}} L300 {{p4}} L400 {{p5}} L500 {{p6}} L500 0 Z" fill="url(#cg)"/>
<path d="M0 {{p1}} L100 {{p2}} L200 {{p3}} L300 {{p4}} L400 {{p5}} L500 {{p6}}" fill="none" stroke="{{primary}}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></g></svg></div>
<div class="scan" style="--d:.7s"></div>
${[1, 2, 3, 4, 5, 6].map((i) => `<div class="dot${i === 6 ? " last" : ""}" style="left:${(i - 1) * 20}%;bottom:calc({{p${i}}} * 1%)"><i style="--d:${(0.7 + 1.8 * (i - 1) / 5).toFixed(2)}s"></i></div>`).join("\n")}
<div class="tip" style="bottom:calc({{p6}} * 1%);--d:2.55s"><div class="v">{{chartValue}}</div><div class="u">{{chartUnit}}</div></div>
</div>
<div class="xs">${[1, 2, 3, 4, 5, 6].map((i) => `<span class="f" style="left:${(i - 1) * 20}%;--d:${(0.5 + i * 0.06).toFixed(2)}s">{{m${i}}}</span>`).join("")}</div></div>`,
    vertical: `.t{left:80px;top:300px;width:920px;line-height:1.08}.sub{left:80px;top:500px}.delta{right:auto;left:80px;top:1500px}
.panel{left:60px;top:600px;width:960px;height:820px}.plot{left:70px;right:70px;top:150px;height:520px;background:repeating-linear-gradient(0deg,color-mix(in srgb,var(--ink) 10%,transparent) 0 2px,transparent 2px 130px)}.xs{left:70px;right:70px;top:710px}`,
  },
  // 4 · Ranked bars — rows slide in, each bar grows to its share of the
  // largest one while its value counts, and the leader gets the gradient.
  {
    seconds: 3.8, uses: [...C, "barsTitle", "barsUnit", "b1", "b1v", "b2", "b2v", "b3", "b3v", "b4", "b4v", "b5", "b5v"],
    css: `${COUNT}
.t{position:absolute;left:160px;top:150px;font-size:calc(80px * var(--ds))}
.rows{position:absolute;left:160px;top:340px;width:1600px}
.row{display:flex;align-items:center;height:118px;animation:lift .7s var(--move) both,clear .4s var(--out) both}
.lab{width:360px;flex:none;font-size:36px;font-weight:700;color:var(--ink)}
.rk{display:inline-block;width:52px;color:var(--dim);font-weight:600}
.trk{flex:1;display:flex;align-items:center;height:72px}
@keyframes wgrow{from{width:0}}
.fill{height:64px;border-radius:var(--rs);background:color-mix(in srgb,{{primary}} 42%,var(--surface));border:var(--border);animation:wgrow 1.2s var(--out) both}
.row:first-child .fill{background:linear-gradient(90deg,{{primary}},{{secondary}})}
.val{margin-left:22px;font-size:46px;font-weight:800;color:var(--ink);white-space:nowrap}
.row:first-child .val{color:{{primary}}}
.t-pop .row:first-child .val{color:var(--ink)}`,
    body: `<div class="t disp r" style="--d:.05s">{{barsTitle}}</div>
<div class="rows">${[1, 2, 3, 4, 5].map((i) => { const d = 0.35 + (i - 1) * 0.14; return `<div class="row" style="--d:${d.toFixed(2)}s"><div class="lab"><span class="rk mono">0${i}</span>{{b${i}}}</div><div class="trk"><div class="fill" style="width:calc({{b${i}v}} / max({{b1v}},{{b2v}},{{b3v}},{{b4v}},{{b5v}}) * 82%);--d:${(d + 0.2).toFixed(2)}s"></div><div class="val disp"><span class="num" style="--to:{{b${i}v}};--d:${(d + 0.2).toFixed(2)}s"></span>{{barsUnit}}</div></div></div>`; }).join("\n")}</div>`,
    vertical: `.t{left:80px;top:300px;width:920px;line-height:1.08}.rows{left:80px;top:620px;width:920px}
.row{flex-wrap:wrap;height:auto;margin-bottom:64px}.lab{width:100%;margin-bottom:16px;font-size:40px}.trk{flex:none;width:100%;height:88px}.fill{height:84px}.val{font-size:52px}`,
  },
  // 5 · KPI tiles — four tiles spring up in a wave, numbers count, and each
  // tile's mini sparkline draws in under it.
  {
    seconds: 3.6, uses: [...C, "kpiTitle", "k1", "k1n", "k1u", "k2", "k2n", "k2u", "k3", "k3n", "k3u", "k4", "k4n", "k4u"],
    css: `${COUNT}
.t{position:absolute;left:0;width:100%;top:170px;text-align:center;font-size:calc(76px * var(--ds))}
.grid{position:absolute;left:160px;top:350px;width:1600px;display:grid;grid-template-columns:repeat(4,1fr);gap:32px}
.tile{position:relative;height:460px;padding:40px 36px;border-radius:var(--r);background:var(--surface);border:var(--border);box-shadow:var(--shadow);overflow:hidden;animation:lift .9s var(--move) both,clear .5s var(--out) both}
.k{font-size:26px;font-weight:700;letter-spacing:.06em;color:var(--muted)}
.n{margin-top:26px;display:flex;align-items:baseline;font-size:calc(104px * var(--ds));line-height:1;color:var(--ink)}
.n .u{font-size:.46em;margin-left:6px;color:{{primary}}}
.sp{position:absolute;left:0;right:0;bottom:0;height:150px;animation:reveal 1.2s cubic-bezier(.3,0,.2,1) both}
.sp svg{width:100%;height:100%;display:block}`,
    body: `<div class="t disp r" style="--d:.05s">{{kpiTitle}}</div>
<div class="grid">${[
      "0,26 15,24 30,25 45,19 60,20 75,12 100,6",
      "0,27 20,22 35,23 50,15 65,16 80,8 100,4",
      "0,8 18,12 32,10 50,17 66,19 82,23 100,24",
      "0,24 16,22 34,18 48,19 62,13 80,10 100,5",
    ].map((pts, j) => { const i = j + 1, d = 0.3 + j * 0.12; return `<div class="tile" style="--d:${d.toFixed(2)}s"><div class="k">{{k${i}}}</div><div class="n disp"><span class="num" style="--to:{{k${i}n}};--d:${(d + 0.25).toFixed(2)}s"></span><span class="u">{{k${i}u}}</span></div>
<div class="sp" style="--d:${(d + 0.5).toFixed(2)}s"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30" preserveAspectRatio="none"><polygon points="0,30 ${pts} 100,30" style="fill:color-mix(in srgb,{{secondary}} 18%,transparent)"/><polyline points="${pts}" fill="none" stroke="{{secondary}}" stroke-width="4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></div></div>`; }).join("\n")}</div>`,
    vertical: `.t{top:330px;left:80px;width:920px;line-height:1.08}.grid{left:80px;top:620px;width:920px;grid-template-columns:repeat(2,1fr)}.tile{height:520px}`,
  },
  // 6 · Goal — the ring fills to 100 %, a second lap in the second colour runs
  // past it, the percent counts in the middle, and a stamp slams on.
  {
    seconds: 3.4, uses: [...C, "period", "goalTitle", "goalSub", "goalPct", "goalLabel", "goalStamp"],
    css: `${COUNT}
@property --a{syntax:'&lt;number&gt;';inherits:false;initial-value:0}
@keyframes ring{from{--a:0}to{--a:var(--to)}}
.l{position:absolute;left:160px;top:330px;width:820px}
.h2{margin-top:24px;font-size:calc(92px * var(--ds));line-height:1.04}
.sub{margin-top:30px;font-size:34px;line-height:1.4;color:var(--muted);font-weight:500}
.gw{position:absolute;left:1140px;top:230px;width:600px;height:600px;animation:popIn 1s var(--spring) both,clear .5s var(--out) both}
.rg{position:absolute;inset:0;border-radius:50%;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 50px),#000 calc(100% - 49px));mask:radial-gradient(farthest-side,transparent calc(100% - 50px),#000 calc(100% - 49px));animation:ring 1.9s cubic-bezier(.45,0,.2,1) both}
.r1{background:conic-gradient({{primary}} calc(min(var(--a),100) * 3.6deg),color-mix(in srgb,var(--ink) 10%,transparent) 0)}
.r2{inset:64px;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 26px),#000 calc(100% - 25px));mask:radial-gradient(farthest-side,transparent calc(100% - 26px),#000 calc(100% - 25px));background:conic-gradient({{secondary}} calc(max(var(--a) - 100,0) * 3.6deg),transparent 0)}
.mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.pc{font-size:calc(150px * var(--ds));line-height:1;display:flex;align-items:baseline}.pc i{font-style:normal;font-size:.45em}
.gl{margin-top:8px;font-size:30px;color:var(--muted);font-weight:600}
/* paper and pop: the ring sits on its own card so it reads over the texture and circles */
.t-pop .gw::before,.t-paper .gw::before{content:'';position:absolute;inset:-28px;border-radius:50%;background:var(--surface);border:var(--border);box-shadow:var(--shadow)}
@keyframes slam{from{transform:rotate(-8deg) scale(2.4);opacity:0}}
.stamp{position:absolute;right:-60px;top:-10px;transform:rotate(-8deg);padding:16px 30px;border:5px solid {{secondary}};border-radius:var(--rs);color:{{secondary}};background:var(--shade);font-size:34px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;animation:slam .45s cubic-bezier(.5,0,.75,0) both}`,
    body: `<div class="l"><div class="eyebrow f" style="--d:.05s">{{period}}</div><div class="h2 disp r" style="--d:.1s">{{goalTitle}}</div><div class="sub r" style="--d:.4s">{{goalSub}}</div></div>
<div class="gw" style="--d:.2s"><div class="rg r1" style="--to:{{goalPct}};--d:.45s"></div><div class="rg r2" style="--to:{{goalPct}};--d:.45s"></div>
<div class="mid"><div class="pc disp"><span class="num" style="--to:{{goalPct}};--d:.45s;animation-duration:1.9s;animation-timing-function:cubic-bezier(.45,0,.2,1)"></span><i>%</i></div><div class="gl">{{goalLabel}}</div></div>
<div class="stamp disp" style="--d:2.3s">{{goalStamp}}</div></div>`,
    vertical: `.l{left:80px;top:250px;width:920px}.h2{font-size:calc(84px * var(--ds))}.gw{left:240px;top:880px}.stamp{right:-40px;top:-30px}`,
  },
  // 7 · End card
  {
    seconds: 2.8, last: true, uses: [...C, "company", "endLine", "cta"],
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
<div class="c"><div class="wm disp" style="--d:.1s">{{company}}<span class="dot" style="--d:.55s"></span></div>
<div class="tag r" style="--d:.6s">{{endLine}}</div>
<div class="btn r" style="--d:.85s"><div class="ping" style="--d:1.45s"></div><div class="cta">{{cta}}</div></div></div>`,
    vertical: `.wm{font-size:calc(120px * var(--ds));width:960px}.glow{left:40px;top:560px}.tag{font-size:38px;width:900px}`,
  },
];

buildTemplates({
  id: ID,
  name: "Metrics reel",
  description: "A 24-second results film: a ticker hook, a hero number over a drawn sparkline, a line chart from six editable points, ranked bars, four KPI tiles and a goal ring that laps past 100 %. Every number, label, point, both colours and the theme are fields.",
  category: "data-and-reports",
  tags: ["report-and-present", "results", "data-viz", "saas"],
  fields,
  scenes,
  themes: ["terminal", "midnight", "paper", "pop"],
  assets: themeFonts(asset),
  here,
  outDir,
});
