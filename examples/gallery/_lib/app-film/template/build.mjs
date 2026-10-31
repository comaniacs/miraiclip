// The __TITLE__ launch film on the app-film kit.   node build.mjs → sequence.html, video.miraiclip.json
// This file holds only what is particular to the film: its stage, its type and its window title.
import { buildAppFilm, cap } from "../_lib/app-film/build.mjs";
import { T, ACTIONS } from "./timeline.mjs";

const css = `
.stage{background:radial-gradient(ellipse 60% 55% at 18% 12%,rgba(255,106,77,0.18),rgba(255,106,77,0) 70%),radial-gradient(ellipse 55% 55% at 88% 92%,rgba(124,108,242,0.18),rgba(124,108,242,0) 70%),linear-gradient(180deg,#171627,#100f1b)}
.floor{position:absolute;left:-3000px;top:-3000px;width:6000px;height:6000px;transform:translateY(560px) rotateX(90deg);background:radial-gradient(circle,rgba(255,255,255,0.13) 1.4px,transparent 1.6px) 0 0/48px 48px;-webkit-mask:radial-gradient(circle,#000 0 18%,transparent 48%);mask:radial-gradient(circle,#000 0 18%,transparent 48%)}
.cap .c{color:#ff8a6d}
#lock{position:absolute;left:0;width:1920px;top:700px;text-align:center;font-weight:600;font-size:104px;letter-spacing:-0.035em;line-height:1;color:#f7f4ee}
#tag{left:0;width:1920px;top:832px;text-align:center;font-weight:500;font-size:38px;color:rgba(247,244,238,0.86)}
#cta{position:absolute;left:0;width:1920px;top:924px;text-align:center}
#cta span{display:inline-block;padding:14px 34px;border-radius:40px;background:#ff6a4d;color:#fff;font:650 22px/1 -apple-system,'SF Pro Text',sans-serif}
`;
const overlay = `
${cap("h1", 452, "__HEADLINE__")}
${cap("h2", 96, '<span class="c">__HEADLINE2__</span>')}
<div id="lock" style="opacity:0">__TITLE__</div>
${cap("tag", 832, "__TAGLINE__")}
<div id="cta" style="opacity:0"><span>__CTA__</span></div>`;

buildAppFilm(import.meta.url, {
  id: "__ID__", T, ACTIONS,
  app: { scripts: ["app/js/core.js", "app/js/ui.js"], css: "app/styles.css" },
  win: { title: "__TITLE__ · local demo" },
  ground: '<div class="floor"></div>',
  css, overlay,
});
