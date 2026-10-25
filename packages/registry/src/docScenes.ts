/**
 * Film scenes for trailers and documentaries: slow, cinematic, type-led.
 * A cold open in the dark, a title that tracks in, stills with a Ken Burns
 * move and a caption, character cards, a pull quote, a case file, chapter
 * cards, rapid trailer hits and a title reveal to close.
 *
 * They take the same brand / style fields as the launch scenes plus
 * `display` (the title typeface, a serif by default), so a film style
 * (see film.ts) restyles them. Content keeps inside the 2.39:1 letterbox
 * safe area, the camera drifts slowly for the whole scene, and each scene
 * ends by fading to its background, so scenes join with a dip.
 */
import type { BlockField, BlockInput } from "./types.js";
import { COURSE_SCENES } from "./courseScenes.js";
import { imageField as image, LAUNCH_SCENES, numField as num, SCENE_COMMON, SCENE_CSS, SCENE_ROOT_OPEN, SECOND as S, textField as text } from "./scenes.js";

/** The title typeface, on every film scene. */
export const DISPLAY_FIELD: BlockField = text("display", "Title font", "Playfair Display", "A font family name the project has (a font asset), used for titles.");
const DOC_COMMON: BlockField[] = [...SCENE_COMMON, DISPLAY_FIELD];

const DOC_CSS = `@keyframes dc-push{from{transform:scale(1.015)}to{transform:scale(1.085)}}
@keyframes dc-fadeout{to{opacity:0}}
@keyframes dc-in{from{opacity:0}}
@keyframes dc-track{from{letter-spacing:.55em;opacity:0;filter:blur(1.2cqmin)}}
@keyframes dc-rise{from{opacity:0;transform:translateY(2.4cqmin);filter:blur(.7cqmin)}}
@keyframes dc-rule{from{transform:scaleX(0)}}
@keyframes dc-flicker{0%{opacity:0}7%{opacity:.7}11%{opacity:.08}19%{opacity:.9}25%{opacity:.35}33%,100%{opacity:1}}
@keyframes dc-leak{from{transform:translate(-20cqw,4cqh) scale(1)}to{transform:translate(20cqw,-4cqh) scale(1.2)}}
.dc-cam{position:absolute;inset:0;animation:dc-push var(--T) linear both;--d:0s}
.dc-exit{position:absolute;inset:0;animation:dc-fadeout .6s ease-in both;--d:calc(var(--T) - .6s)}
.dc-vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 38%,color-mix(in srgb,var(--bg) 75%,#000) 100%);opacity:.7}
.dc-leak{position:absolute;left:10cqw;top:20cqh;width:80cqmin;height:80cqmin;border-radius:50%;background:var(--p);filter:blur(18cqmin);opacity:.13;animation:dc-leak var(--T) ease-in-out both;--d:0s}
.dc-disp{font-family:'{{display}}','Playfair Display',Georgia,serif}
.dc-kick{font-size:2.9cqmin;letter-spacing:.42em;text-transform:uppercase;font-weight:600;color:var(--mut)}
.dc-acc{color:var(--p)}
.dc-c0{position:absolute;inset:0}
.dc-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 9cqw}`;

/** A film scene: root, slow camera, light leak, vignette, fade to the background. */
const docScene = (body: string, extraCss = "", camera = "dc-cam"): string =>
  `${SCENE_ROOT_OPEN}<style>${SCENE_CSS}${DOC_CSS}${extraCss}</style><div class="dc-exit"><div class="dc-leak"></div><div class="${camera}">${body}</div><div class="dc-vig"></div></div></div>`;

const tags = (formats: string[], ...rest: string[]) => [...formats.map((f) => `format:${f}`), "film", ...rest];
const FILM = ["documentary", "trailer"];

export const DOC_SCENES: BlockInput[] = [
  // ------------------------------------------------------------------ cold open
  {
    name: "scene-doc-cold-open",
    title: "Scene — cold open",
    description:
      "Opens a trailer or documentary in the dark: one quiet line fades in, then a second line answers it, with a slow push and a drifting light. Two short sentences that set up the subject's mystery or stakes (≤ ~48 characters each). 4.5 s.",
    category: "scene",
    tags: tags(FILM, "opener", "cold open", "hook", "mystery", "cinematic"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("line1", "First line", "Some people notice what others miss."), text("line2", "Second line", "He notices everything."), ...DOC_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 4.5 * S,
      template: docScene(
        `<div class="dc-c"><div class="dco-1 dc-disp" style="--d:.35s">{{line1}}</div><div class="dco-2 dc-disp" style="--d:1.9s">{{line2}}</div></div>`,
        `.dco-1{font-size:6.4cqmin;font-style:italic;font-weight:400;line-height:1.25;color:var(--mut);max-width:150cqmin;animation:dc-rise 1.6s cubic-bezier(.2,.7,.2,1) both}
.dco-2{margin-top:3.4cqmin;font-size:9.6cqmin;font-weight:500;letter-spacing:-.01em;line-height:1.15;max-width:150cqmin;animation:dc-flicker 1.4s linear both}`,
      ),
    },
  },
  // ------------------------------------------------------------------ title card
  {
    name: "scene-doc-title",
    title: "Scene — title card",
    description:
      "The film's title tracks in from wide letter-spacing and blur between two hairlines that draw outwards, with a small kicker above ('A Netflix Original', 'Season one', 'The true story') and a subtitle below. Title ≤ ~20 characters. 5 s.",
    category: "scene",
    tags: tags(FILM, "title", "opener", "name", "cinematic"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("kicker", "Kicker", "The true story"), text("title", "Title", "The Mentalist"), text("subtitle", "Subtitle", "Nothing is hidden. Not from him."), ...DOC_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 5 * S,
      template: docScene(
        `<div class="dc-c"><div class="dc-kick" style="--d:.2s;animation:dc-in 1s ease both">{{kicker}}</div>
<div class="dct-r" style="--d:1.1s"></div>
<div class="dct-t dc-disp" style="--d:.45s">{{title}}</div>
<div class="dct-r" style="--d:1.1s"></div>
<div class="dct-s" style="--d:2.2s">{{subtitle}}</div></div>`,
        `.dct-t{font-size:min(14.5cqmin,11cqw);font-weight:600;letter-spacing:.06em;text-transform:uppercase;line-height:1.02;text-wrap:balance;animation:dc-track 2.6s cubic-bezier(.16,1,.3,1) both}
.dct-r{width:min(64cqmin,70cqw);height:.18cqmin;margin:3cqmin 0;background:linear-gradient(90deg,transparent,var(--p),transparent);animation:dc-rule 1.4s cubic-bezier(.16,1,.3,1) both}
.dct-s{font-size:4.2cqmin;font-style:italic;color:var(--mut);animation:dc-rise 1.2s cubic-bezier(.2,.7,.2,1) both}`,
      ),
    },
  },
  // ------------------------------------------------------------------ still
  {
    name: "scene-doc-still",
    title: "Scene — still with Ken Burns and caption",
    description:
      "A full-frame photo or frame from the subject, graded down and moving slowly (`move`: in | out | left | right), with a kicker and a caption at the lower left. The image must be one the user gave or the brand/site supplied — never a placeholder or unrelated media. Caption ≤ ~60 characters. 5 s.",
    category: "scene",
    tags: tags([...FILM, "course"], "still", "photo", "ken burns", "caption", "image"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [image("image", "Image"), text("kicker", "Kicker", "Sacramento, 2008"), text("caption", "Caption", "A psychic who admits he never was one."), text("move", "Camera move", "in", "in | out | left | right"), ...DOC_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 5 * S,
      template: docScene(
        `<div class="dcs dcs-{{move}}"><img src="asset:{{image}}"/></div><div class="dcs-sh"></div>
<div class="dcs-cap"><div class="dc-kick dc-acc" style="--d:.5s;animation:dc-in .9s ease both">{{kicker}}</div><div class="dcs-t dc-disp" style="--d:.8s">{{caption}}</div></div>`,
        `@keyframes dcs-in{from{transform:scale(1.04)}to{transform:scale(1.2)}}
@keyframes dcs-out{from{transform:scale(1.22)}to{transform:scale(1.04)}}
@keyframes dcs-left{from{transform:scale(1.18) translateX(4%)}to{transform:scale(1.18) translateX(-4%)}}
@keyframes dcs-right{from{transform:scale(1.18) translateX(-4%)}to{transform:scale(1.18) translateX(4%)}}
.dcs{position:absolute;inset:0;--d:0s;animation:dcs-in var(--T) linear both}
.dcs-out{animation-name:dcs-out}.dcs-left{animation-name:dcs-left}.dcs-right{animation-name:dcs-right}
.dcs img{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(.7) contrast(1.08) brightness(.78)}
.dcs-sh{position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,color-mix(in srgb,var(--bg) 88%,transparent) 100%)}
.dcs-cap{position:absolute;left:8cqw;right:8cqw;bottom:17cqh;display:flex;flex-direction:column;gap:1.6cqmin}
.dcs-t{font-size:6.2cqmin;line-height:1.15;max-width:120cqmin;color:#fff;text-shadow:0 .4cqmin 2cqmin rgba(0,0,0,.5);animation:dc-rise 1.1s cubic-bezier(.2,.7,.2,1) both}`,
        "dc-c0",
      ),
    },
  },
  // ------------------------------------------------------------------ character
  {
    name: "scene-doc-character",
    title: "Scene — character card",
    description:
      "Introduces a person: their role as a kicker, their name set large with an accent bar that wipes in, a one-line note in italics, and the name again as a huge ghosted outline drifting behind. No image needed. Name ≤ ~18 characters. 4 s.",
    category: "scene",
    tags: tags([...FILM, "course"], "character", "person", "name", "cast", "introduction"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("kicker", "Role", "Independent consultant, CBI"), text("name", "Name", "Patrick Jane"), text("note", "Note", "Former fake psychic. Real eye for liars."), ...DOC_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 4 * S,
      template: docScene(
        `<div class="dch-g dc-disp">{{name}}</div>
<div class="dch"><div class="dc-kick dc-acc" style="--d:.25s;animation:dc-in .8s ease both">{{kicker}}</div>
<div class="dch-n"><i style="--d:.35s"></i><span class="dc-disp" style="--d:.45s">{{name}}</span></div>
<div class="dch-o dc-disp" style="--d:1.3s">{{note}}</div></div>`,
        `@keyframes dch-ghost{from{transform:translate(-50%,-50%) translateX(6cqw)}to{transform:translate(-50%,-50%) translateX(-6cqw)}}
@keyframes dch-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.dch-g{position:absolute;left:50%;top:68%;white-space:nowrap;font-size:32cqmin;font-weight:700;color:transparent;-webkit-text-stroke:.16cqmin var(--line);opacity:.55;--d:0s;animation:dch-ghost var(--T) linear both}
.dch{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 10cqw;gap:2.2cqmin}
.dch-n{display:flex;align-items:center;gap:3cqmin}
@keyframes dch-bar{from{transform:scaleY(0)}}
.dch-n i{flex:none;width:1cqmin;height:14cqmin;background:var(--p);transform-origin:top;animation:dch-bar .7s cubic-bezier(.16,1,.3,1) both}
.dch-n span{font-size:min(15cqmin,12cqw);font-weight:600;letter-spacing:-.015em;line-height:1;animation:dch-wipe 1s cubic-bezier(.16,1,.3,1) both}
.dch-o{font-size:5cqmin;font-style:italic;color:var(--mut);max-width:110cqmin;animation:dc-rise 1s cubic-bezier(.2,.7,.2,1) both}`,
      ),
    },
  },
  // ------------------------------------------------------------------ pull quote
  {
    name: "scene-doc-quote",
    title: "Scene — pull quote",
    description:
      "A line of dialogue or a real quote set large in italic serif, fading up through blur, then an attribution with a short rule. Use real lines from the subject or the user; mark paraphrases as such in the attribution. Quote ≤ ~100 characters. 5.5 s.",
    category: "scene",
    tags: tags([...FILM, "course"], "quote", "dialogue", "line", "words"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("quote", "Quote", "There's no such thing as psychics."), text("by", "Attribution", "Patrick Jane"), ...DOC_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 5.5 * S,
      template: docScene(
        `<div class="dc-c"><div class="dcq-m dc-disp dc-acc" style="--d:.1s">“</div><div class="dcq dc-disp" style="--d:.3s">{{quote}}</div>
<div class="dcq-by" style="--d:2.4s"><i></i>{{by}}</div></div>`,
        `@keyframes dcq-in{from{opacity:0;filter:blur(1.6cqmin);letter-spacing:.06em}}
.dcq-m{font-size:20cqmin;line-height:.5;height:8cqmin;animation:dc-in 1.2s ease both}
.dcq{font-size:min(9cqmin,8.6cqw);font-style:italic;line-height:1.18;max-width:150cqmin;text-wrap:balance;animation:dcq-in 2.2s cubic-bezier(.2,.7,.2,1) both}
.dcq-by{display:flex;align-items:center;gap:2cqmin;margin-top:4cqmin;font-size:3.2cqmin;letter-spacing:.32em;text-transform:uppercase;color:var(--mut);animation:dc-in 1s ease both}
.dcq-by i{width:6cqmin;height:.18cqmin;background:var(--p)}`,
      ),
    },
  },
  // ------------------------------------------------------------------ case file
  {
    name: "scene-doc-case-file",
    title: "Scene — case file",
    description:
      "A dossier slides in at an angle: a file number, the subject, three facts that type out one after another, and a stamp that thumps on at the end ('Unsolved', 'Classified', 'Confirmed'). For crime, mystery, history or investigation subjects. Each fact ≤ ~42 characters; stamp one or two words. 5 s.",
    category: "scene",
    tags: tags(FILM, "case file", "dossier", "facts", "evidence", "mystery", "crime"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("number", "File number", "RJ-0113"),
      text("title", "Subject", "Red John"),
      text("line1", "Fact 1", "Serial killer. Signature: a smiley face."),
      text("line2", "Fact 2", "Active across Northern California."),
      text("line3", "Fact 3", "Identity unknown for ten years."),
      text("stamp", "Stamp", "Unsolved"),
      ...DOC_COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 5 * S,
      template: docScene(
        `<div class="dc-c"><div class="dcf" style="--d:.05s">
<div class="dcf-h"><span>Case file</span><span>No. {{number}}</span></div>
<div class="dcf-t dc-disp" style="--d:.5s">{{title}}</div>
<div class="dcf-l" style="--d:1s"><span>{{line1}}</span></div>
<div class="dcf-l" style="--d:1.75s"><span>{{line2}}</span></div>
<div class="dcf-l" style="--d:2.5s"><span>{{line3}}</span></div>
<div class="dcf-s" style="--d:3.4s">{{stamp}}</div></div></div>`,
        `@keyframes dcf-in{from{opacity:0;transform:rotate(-6deg) translateY(10cqmin) scale(1.05)}}
@keyframes dcf-stamp{0%{opacity:0;transform:rotate(-12deg) scale(2.2)}60%{opacity:1;transform:rotate(-12deg) scale(.94)}100%{opacity:1;transform:rotate(-12deg) scale(1)}}
.dcf{position:relative;width:min(124cqmin,88cqw);padding:5cqmin 6cqmin;text-align:left;background:color-mix(in srgb,var(--ink) 7%,var(--bg));border:.15cqmin solid var(--line);border-radius:.8cqmin;box-shadow:0 4cqmin 12cqmin rgba(0,0,0,.45);transform:rotate(-1.5deg);animation:dcf-in 1s cubic-bezier(.16,1,.3,1) both}
.dcf-h{display:flex;justify-content:space-between;font-size:2.8cqmin;letter-spacing:.3em;text-transform:uppercase;color:var(--mut);border-bottom:.15cqmin solid var(--line);padding-bottom:2cqmin;font-family:'JetBrains Mono Variable','JetBrains Mono',ui-monospace,monospace}
.dcf-t{font-size:10cqmin;font-weight:600;margin:3cqmin 0 2.4cqmin;animation:dc-rise .9s cubic-bezier(.16,1,.3,1) both}
.dcf-l{font-size:4.2cqmin;line-height:1.5;font-family:'JetBrains Mono Variable','JetBrains Mono',ui-monospace,monospace;color:var(--ink);margin-top:.8cqmin}
.dcf-l span{display:inline-block;animation:ls-type .7s steps(18,end) both}
.dcf-s{position:absolute;right:5cqmin;bottom:5cqmin;padding:1.2cqmin 2.6cqmin;border:.5cqmin solid var(--p);color:var(--p);font-size:5cqmin;font-weight:800;letter-spacing:.12em;text-transform:uppercase;border-radius:.8cqmin;animation:dcf-stamp .45s cubic-bezier(.3,0,.2,1) both;font-family:'{{font}}',Inter,sans-serif}`,
      ),
    },
  },
  // ------------------------------------------------------------------ chapter
  {
    name: "scene-doc-chapter",
    title: "Scene — chapter card",
    description:
      "Divides a documentary into chapters: a large outlined numeral, a 'Chapter' kicker and the chapter's title. Use between acts of a longer film (one per act), not back to back. Title ≤ ~32 characters. 3.5 s.",
    category: "scene",
    tags: tags(["documentary", "explainer", "course"], "chapter", "act", "section", "divider"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("number", "Number", "01"), text("kicker", "Kicker", "Chapter"), text("title", "Title", "The man who reads people"), ...DOC_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3.5 * S,
      template: docScene(
        `<div class="dc-c"><div class="dcc-n dc-disp" style="--d:.1s">{{number}}</div><div class="dc-kick dc-acc" style="--d:.6s;animation:dc-in .8s ease both">{{kicker}}</div><div class="dcc-t dc-disp" style="--d:.8s">{{title}}</div></div>`,
        `@keyframes dcc-n{from{opacity:0;transform:scale(1.25);filter:blur(1.2cqmin)}}
.dcc-n{font-size:34cqmin;line-height:.95;font-weight:700;color:transparent;-webkit-text-stroke:.22cqmin var(--p);margin-bottom:2cqmin;animation:dcc-n 1.4s cubic-bezier(.16,1,.3,1) both}
.dcc-t{margin-top:2cqmin;font-size:min(8.4cqmin,8.6cqw);font-weight:500;line-height:1.1;text-wrap:balance;animation:dc-rise 1.1s cubic-bezier(.2,.7,.2,1) both}`,
      ),
    },
  },
  // ------------------------------------------------------------------ trailer hits
  {
    name: "scene-doc-hits",
    title: "Scene — trailer hits",
    description:
      "Three short hits cut hard one after another, each a word or two punched in with a flash ('Seven seasons.' 'One killer.' 'No psychics.'). Builds tension late in a trailer, just before the reveal. Each hit ≤ ~16 characters. 3.6 s.",
    category: "scene",
    tags: tags(FILM, "hits", "kinetic", "words", "tension", "build"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("hit1", "Hit 1", "Seven seasons."), text("hit2", "Hit 2", "One killer."), text("hit3", "Hit 3", "No psychics."), ...DOC_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3.6 * S,
      template: docScene(
        `<div class="dcx" style="--d:0s;--k:0"><span class="dc-disp">{{hit1}}</span></div>
<div class="dcx" style="--d:calc(var(--T) / 3);--k:1"><span class="dc-disp">{{hit2}}</span></div>
<div class="dcx dcx-last" style="--d:calc(var(--T) * 2 / 3)"><span class="dc-disp dc-acc">{{hit3}}</span></div>
<div class="dcx-f" style="--d:0s"></div><div class="dcx-f" style="--d:calc(var(--T) / 3)"></div><div class="dcx-f" style="--d:calc(var(--T) * 2 / 3)"></div>`,
        `@keyframes dcx-show{0%{opacity:0}.5%{opacity:1;transform:scale(1.18)}12%{transform:scale(1)}99.5%{opacity:1;transform:scale(.97)}100%{opacity:0}}
@keyframes dcx-last{0%{opacity:0}.5%{opacity:1;transform:scale(1.18)}12%{transform:scale(1)}100%{opacity:1;transform:scale(.96)}}
@keyframes dcx-flash{0%{opacity:0}2%{opacity:.85}100%{opacity:0}}
.dcx{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;animation:dcx-show calc(var(--T) / 3) cubic-bezier(.2,.8,.2,1) both}
.dcx-last{animation-name:dcx-last;animation-duration:calc(var(--T) / 3)}
.dcx span{font-size:min(13cqmin,10.5cqw);font-weight:700;text-transform:uppercase;letter-spacing:.04em;text-align:center;line-height:1}
.dcx-f{position:absolute;inset:0;background:var(--ink);opacity:0;animation:dcx-flash .18s ease-out both}`,
      ),
    },
  },
  // ------------------------------------------------------------------ reveal (closer)
  {
    name: "scene-doc-reveal",
    title: "Scene — title reveal (closer)",
    description:
      "Ends a trailer or documentary: the title flickers up out of the dark, a band of light sweeps across its letters, then a tagline and a closing line ('All seven seasons. Streaming now.', 'Coming this fall'). Always the last scene. Title ≤ ~20 characters. 6 s.",
    category: "scene",
    tags: tags(FILM, "closer", "outro", "title", "reveal", "end card"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("title", "Title", "The Mentalist"), text("tagline", "Tagline", "Every lie leaves a tell."), text("cta", "Closing line", "All seven seasons · Streaming now"), ...DOC_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 6 * S,
      template: docScene(
        `<div class="dc-c"><div class="dcr-t dc-disp" style="--d:.4s"><span style="--d:1.2s">{{title}}</span></div>
<div class="dct-r" style="--d:2.2s"></div>
<div class="dcr-g dc-disp" style="--d:2.6s">{{tagline}}</div>
<div class="dc-kick" style="--d:3.5s;animation:dc-in 1s ease both;margin-top:4cqmin">{{cta}}</div></div>`,
        `@keyframes dcr-sweep{from{background-position:120% 0}to{background-position:-20% 0}}
.dcr-t{font-size:min(16cqmin,11.5cqw);font-weight:600;letter-spacing:.08em;text-transform:uppercase;line-height:1.02;text-wrap:balance;animation:dc-flicker 1.3s linear both}
.dcr-t span{background:linear-gradient(100deg,var(--ink) 40%,#fff 50%,var(--p) 53%,var(--ink) 62%) 0 0/300% 100% no-repeat,var(--ink);-webkit-background-clip:text;background-clip:text;color:transparent;animation:dcr-sweep 2.2s cubic-bezier(.4,0,.2,1) both}
.dct-r{width:min(56cqmin,64cqw);height:.18cqmin;margin:3.4cqmin 0;background:linear-gradient(90deg,transparent,var(--p),transparent);animation:dc-rule 1.2s cubic-bezier(.16,1,.3,1) both}
.dcr-g{font-size:5.6cqmin;font-style:italic;color:var(--ink);animation:dc-rise 1.2s cubic-bezier(.2,.7,.2,1) both}`,
      ),
    },
  },
];

/**
 * The film look laid over a whole film on its own top track: animated grain,
 * a vignette and 2.39:1 letterbox bars (bars only in landscape).
 */
export const FILM_OVERLAY: BlockInput = {
  name: "overlay-film-look",
  title: "Overlay — film grain and letterbox",
  description:
    "Lays a cinematic finish over the whole film: moving grain, a soft vignette and 2.39:1 letterbox bars in landscape. Place it once on a track above the scenes, spanning the film. `grain` 0–0.3, `vignette` 0–1.",
  category: "overlay",
  tags: ["film", "grain", "letterbox", "vignette", "cinematic", "overlay"],
  aspects: ["16:9", "9:16", "1:1"],
  fields: [
    num("grain", "Grain", 0.14, "Grain opacity, 0–0.3."),
    num("vignette", "Vignette", 0.5, "Vignette strength, 0–1."),
    { key: "letterbox", label: "Letterbox", type: "boolean", default: true, description: "2.39:1 bars in landscape." },
  ],
  content: {
    kind: "html",
    animated: true,
    durationUs: 10 * S,
    template: `<div class="fo"><style>*{box-sizing:border-box;margin:0}
.fo{position:relative;width:100%;height:100%;overflow:hidden;container-type:size;pointer-events:none}
@keyframes fo-j{0%{transform:translate(0,0)}20%{transform:translate(-3%,2%)}40%{transform:translate(2%,-3%)}60%{transform:translate(-2%,-1%)}80%{transform:translate(3%,3%)}100%{transform:translate(0,0)}}
.fo-g{position:absolute;left:-10%;top:-10%;width:120%;height:120%;animation:fo-j .5s steps(5) infinite;--d:0s}
.fo-v{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(0,0,0,.85) 100%)}
.fo-bars i{position:absolute;left:0;right:0;height:max(0px,calc((100cqh - 100cqw / 2.39) / 2));background:#000}
.fo-bars i:first-child{top:0}.fo-bars i:last-child{bottom:0}
.fo-false{display:none}
@container (max-aspect-ratio:1/1){.fo-bars{display:none}}</style>
<svg class="fo-g" style="opacity:{{grain}}" xmlns="http://www.w3.org/2000/svg"><filter id="fo-n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -.55"/></filter><rect width="100%" height="100%" filter="url(#fo-n)"/></svg>
<div class="fo-v" style="opacity:{{vignette}}"></div><div class="fo-bars fo-{{letterbox}}"><i></i><i></i></div></div>`,
  },
};

/** Every film scene: the launch scenes and the documentary / trailer scenes. */
export const FILM_SCENES: BlockInput[] = [...LAUNCH_SCENES, ...DOC_SCENES, ...COURSE_SCENES];
