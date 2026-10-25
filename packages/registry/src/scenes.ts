/**
 * Launch scenes: full-frame, animated scenes for product launch films,
 * teasers and promos, in the fast "launch trailer" style — a typed hook that
 * names the viewer's problem, moving camera on every shot, big type, cards in
 * perspective, image montages, a number that counts, and a wordmark reveal.
 *
 * Every scene takes the brand as fields (`primary`, `secondary`, `bg`, `ink`,
 * `font`), so one set of scenes becomes any brand's film. Image fields take
 * an image asset id (`brand-image-1`), used as `asset:<id>`.
 *
 * Sizes are in cqmin, so the scenes work in 16:9, 9:16 and 1:1. Each scene
 * keeps moving for its whole length (a slow camera push or pan) and ends with
 * a short blur-and-push exit, so a 0.3 s dissolve between scenes reads as one
 * continuous move.
 */
import type { BlockField, BlockInput } from "./types.js";

const S = 1_000_000;

const text = (key: string, label: string, value: string, description?: string): BlockField => ({ key, label, type: "text", default: value, ...(description ? { description } : {}) });
const num = (key: string, label: string, value: number, description?: string): BlockField => ({ key, label, type: "number", default: value, ...(description ? { description } : {}) });
const image = (key: string, label: string): BlockField => ({ key, label, type: "text", default: "", description: "An image asset id in the project (e.g. brand-image-1). Required." });

/** The brand, on every scene. */
export const BRAND_FIELDS: BlockField[] = [
  { key: "primary", label: "Primary colour", type: "color", default: "#3b5bfd" },
  { key: "secondary", label: "Second colour", type: "color", default: "#8b5cf6" },
  { key: "bg", label: "Background", type: "color", default: "#f7f6f2" },
  { key: "ink", label: "Text colour", type: "color", default: "#111318" },
  text("font", "Font family", "Inter", "A font family name the project has (a font asset), e.g. the brand's."),
];

/** Field keys every launch scene has; the add_scene tool fills them from the brand. */
export const BRAND_FIELD_KEYS = BRAND_FIELDS.map((f) => f.key);


/**
 * Each scene comes in three looks, so a long film can change its light:
 * `light` (the brand's background and text), `dark` (a deep tint of the brand
 * colour, light text) and `brand` (the brand colour itself, white type).
 */
export const LOOK_FIELD: BlockField = { key: "look", label: "Look", type: "text", default: "light", description: "light | dark | brand" };
export const LOOKS = ["light", "dark", "brand"] as const;
/** Fields every scene ends with: the brand, then the look. */
const COMMON: BlockField[] = [...BRAND_FIELDS, LOOK_FIELD];

/** The root element of every scene (its look picks the colour variables). */
const ROOT_OPEN = `<div class="ls-root ls-{{look}}">`;

const ROOT_CSS = `.ls-root{position:relative;width:100%;height:100%;overflow:hidden;container-type:size;--p:{{primary}};--s:{{secondary}};--bg:{{bg}};--ink:{{ink}};--onp:#ffffff;background:var(--bg);color:var(--ink);font-family:'{{font}}',Inter,system-ui,sans-serif}
.ls-dark{--bg:color-mix(in srgb,{{primary}} 14%,#07090e);--ink:#f4f6f9}
.ls-brand{--bg:{{primary}};--ink:#ffffff;--p:#ffffff;--s:color-mix(in srgb,{{secondary}} 35%,#ffffff);--onp:{{primary}}}
.ls-root{--mut:color-mix(in srgb,var(--ink) 60%,var(--bg));--card:color-mix(in srgb,var(--ink) 6%,var(--bg));--line:color-mix(in srgb,var(--ink) 14%,transparent)}
.ls-brand .ls-blob{opacity:.18}`;

/** Shared motion vocabulary. Easing: out-expo for arrivals, in-out for camera. */
const CSS = `*{box-sizing:border-box;margin:0}
${ROOT_CSS}
@keyframes ls-push{from{transform:scale(1)}to{transform:scale(1.09)}}
@keyframes ls-pull{from{transform:scale(1.14)}to{transform:scale(1)}}
@keyframes ls-out{to{transform:scale(1.06);filter:blur(1.2cqmin);opacity:0}}
@keyframes ls-rise{from{transform:translateY(6cqmin);opacity:0;filter:blur(.8cqmin)}}
@keyframes ls-fade{from{opacity:0}}
@keyframes ls-pop{0%{transform:scale(.4);opacity:0}65%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}
@keyframes ls-blurin{from{opacity:0;filter:blur(2.4cqmin);transform:scale(1.12)}}
@keyframes ls-drift{from{transform:translate(0,0)}to{transform:translate(var(--dx,3cqmin),var(--dy,-2cqmin))}}
@keyframes ls-grow{from{transform:scaleX(0)}}
@keyframes ls-type{from{clip-path:inset(-20% 100% -20% 0)}to{clip-path:inset(-20% -2% -20% 0)}}
@keyframes ls-caret{from{left:0}to{left:100%}}
@keyframes ls-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes ls-off{to{opacity:0}}
.ls-cam{position:absolute;inset:0;animation:ls-push var(--T) cubic-bezier(.35,0,.25,1) both;--d:0s}
.ls-exit{position:absolute;inset:0;animation:ls-out .35s cubic-bezier(.5,0,.75,0) both;--d:calc(var(--T) - .35s)}
.ls-blob{position:absolute;width:80cqmin;height:80cqmin;border-radius:50%;filter:blur(14cqmin);opacity:.28;animation:ls-drift var(--T) ease-in-out both}
.ls-grad{background:linear-gradient(90deg,var(--p),var(--s));-webkit-background-clip:text;background-clip:text;color:transparent}`;

/** Soft brand-coloured light behind a scene. */
const BLOBS = `<div class="ls-blob" style="left:-22cqmin;top:-30cqmin;background:var(--p);--dx:8cqmin;--dy:6cqmin"></div><div class="ls-blob" style="right:-26cqmin;bottom:-34cqmin;background:var(--s);--dx:-6cqmin;--dy:-4cqmin"></div>`;

/** A scene: root, background light, camera, exit. */
const scene = (body: string, extraCss = "", camera = "ls-cam"): string =>
  `${ROOT_OPEN}<style>${CSS}${extraCss}</style>${BLOBS}<div class="ls-exit"><div class="${camera}">${body}</div></div></div>`;

/** A generic UI panel drawn in brand colours (no screenshots needed). */
const panel = (style: string, accent: number, rows = 3): string =>
  `<div class="lsf" style="${style}"><div class="lsf-top"><i></i><i></i><i></i></div>${Array.from({ length: rows }, (_, i) =>
    `<div class="lsf-bar" style="width:${[86, 62, 74, 48][i % 4]}%${i === accent ? ";background:var(--p);animation:ls-grow .9s cubic-bezier(.2,.8,.2,1) both;transform-origin:left;--d:.4s" : ""}"></div>`,
  ).join("")}</div>`;

const PANEL_CSS = `.lsf{position:absolute;padding:2.2cqmin 2.4cqmin;border-radius:2cqmin;background:var(--card);border:.15cqmin solid var(--line);box-shadow:0 4cqmin 10cqmin color-mix(in srgb,var(--ink) 9%,transparent);animation:ls-drift var(--T) ease-in-out both}
.lsf-top{display:flex;gap:.8cqmin;margin-bottom:1.6cqmin}.lsf-top i{width:1.1cqmin;height:1.1cqmin;border-radius:50%;background:var(--line)}
.lsf-bar{height:1.6cqmin;border-radius:1cqmin;background:var(--line);margin-top:1.4cqmin}`;

export const LAUNCH_SCENES: BlockInput[] = [
  // ------------------------------------------------------------------ hook
  {
    name: "scene-hook-typed",
    title: "Scene — typed hook question",
    description:
      "Opens the film by naming the viewer's problem as a question: `before` is on screen from the first frame (so the thumbnail has words), then the highlighted word in the brand gradient and the second line type out with a caret. Brand-coloured UI panels float at depth behind it while the camera pushes in. 3–3.6 s.",
    category: "scene",
    tags: ["format:course", "format:launch", "format:explainer", "launch", "hook", "opener", "typewriter", "question"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("before", "Line 1", "Still juggling", "Up to ~3 words, ends before the highlight."),
      text("highlight", "Highlighted word", "ten tools", "1–2 words, the pain point."),
      text("after", "Line 2", "to win one client?", "Up to ~5 words."),
      num("len", "Characters", 18, "Characters in the longer line, to size the type to the frame (add_scene fills it in)."),
      ...COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3.4 * S,
      template: scene(
        `${panel("left:-6cqmin;top:-3cqmin;width:60cqmin;filter:blur(.3cqmin);opacity:.9;--dx:5cqmin;--dy:3cqmin", 1, 4)}
${panel("right:-6cqmin;top:-6cqmin;width:52cqmin;opacity:.95;--dx:-6cqmin;--dy:4cqmin", 0, 3)}
${panel("left:-2cqmin;bottom:-12cqmin;width:56cqmin;filter:blur(.6cqmin);opacity:.75;--dx:4cqmin;--dy:-4cqmin", 2, 4)}
${panel("right:-3cqmin;bottom:-6cqmin;width:58cqmin;filter:blur(.15cqmin);--dx:-4cqmin;--dy:-5cqmin", 1, 3)}
<div class="lsh">
<div class="lsh-l">{{before}} <span class="lsh-w" style="--d:.15s"><span class="lsh-t ls-grad" style="animation:ls-type .6s steps(10) both">{{highlight}}</span><i class="lsh-c" style="animation:ls-caret .6s steps(10) both,lsh-gone .85s step-end both"></i></span></div>
<div class="lsh-l"><span class="lsh-w" style="--d:1s"><span class="lsh-t" style="animation:ls-type 1s steps(18) both">{{after}}</span><i class="lsh-c" style="animation:ls-caret 1s steps(18) both,ls-fade .01s step-end both"></i></span></div>
</div>`,
        `${PANEL_CSS}
@keyframes lsh-gone{0%,99%{opacity:1}100%{opacity:0}}
.lsh{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:1cqmin}
.lsh-l{font-size:min(10.8cqmin,calc(168cqw / {{len}}));font-weight:500;letter-spacing:-.035em;line-height:1.12;white-space:nowrap}
.lsh-w{position:relative;display:inline-block}
.lsh-t{display:inline-block}
.lsh-c{position:absolute;top:10%;bottom:6%;width:.55cqmin;margin-left:.8cqmin;background:var(--p);border-radius:.3cqmin}
@container (max-aspect-ratio:1/1){.lsh-l{font-size:min(7cqmin,calc(168cqw / {{len}}))}}`,
      ),
    },
  },
  // ------------------------------------------------------------------ prompt + cards
  {
    name: "scene-prompt-cards",
    title: "Scene — tilted prompt and cards",
    description:
      "A greeting and a question set at an angle in perspective, with a row of option cards sliding past underneath; the third card lights up in the brand colour. The camera dollies across. Use for 'what can it do' moments: the cards are things the product does. 3 s.",
    category: "scene",
    tags: ["format:launch", "launch", "ai", "prompt", "options", "perspective"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("greeting", "Greeting", "Hello, Alex."),
      text("question", "Question", "What are we growing today?"),
      text("card1", "Card 1", "Book more calls"),
      text("card2", "Card 2", "Follow up on leads"),
      text("card3", "Card 3 (highlighted)", "Launch a funnel"),
      text("card4", "Card 4", "Send a campaign"),
      ...COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3 * S,
      template: scene(
        `<div class="lsp"><div class="lsp-in">
<div class="lsp-g" style="animation:ls-rise .6s cubic-bezier(.16,1,.3,1) both;--d:.05s">{{greeting}}</div>
<div class="lsp-q" style="animation:ls-rise .7s cubic-bezier(.16,1,.3,1) both;--d:.2s">{{question}}</div>
<div class="lsp-row">
<div class="lsp-c" style="--d:.45s">{{card1}}</div><div class="lsp-c" style="--d:.55s">{{card2}}</div><div class="lsp-c lsp-hot" style="--d:.65s">{{card3}}</div><div class="lsp-c" style="--d:.75s">{{card4}}</div>
</div></div></div>`,
        `@keyframes lsp-dolly{from{transform:perspective(150cqmin) rotateX(22deg) rotateZ(-7deg) translate(14cqmin,8cqmin) scale(1.05)}to{transform:perspective(150cqmin) rotateX(16deg) rotateZ(-5deg) translate(-8cqmin,-2cqmin) scale(1)}}
@keyframes lsp-slide{from{transform:translateX(24cqmin)}to{transform:translateX(-16cqmin)}}
@keyframes lsp-card{from{opacity:0;transform:translateY(8cqmin) rotate(4deg)}}
@keyframes lsp-lit{0%,55%{background:var(--card);color:var(--ink);box-shadow:0 2cqmin 6cqmin color-mix(in srgb,var(--ink) 8%,transparent)}70%,100%{background:var(--p);color:var(--onp);box-shadow:0 3cqmin 9cqmin color-mix(in srgb,var(--p) 45%,transparent);transform:scale(1.06)}}
.lsp{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.lsp-in{width:min(150cqmin,92cqw);animation:lsp-dolly var(--T) cubic-bezier(.3,0,.2,1) both;transform-origin:50% 50%}
.lsp-g{font-size:6.4cqmin;font-weight:600;letter-spacing:-.03em;color:var(--p)}
.lsp-q{font-size:8.2cqmin;font-weight:600;letter-spacing:-.035em;line-height:1.1;color:var(--mut);margin-top:.6cqmin}
.lsp-row{display:flex;gap:3cqmin;margin-top:6cqmin;animation:lsp-slide var(--T) cubic-bezier(.3,0,.2,1) both}
.lsp-c{flex:0 0 auto;width:34cqmin;height:21cqmin;padding:3cqmin;border-radius:3cqmin;background:var(--card);border:.15cqmin solid var(--line);font-size:3.6cqmin;font-weight:500;line-height:1.2;box-shadow:0 2cqmin 6cqmin color-mix(in srgb,var(--ink) 8%,transparent);animation:lsp-card .7s cubic-bezier(.16,1,.3,1) both}
@container (max-aspect-ratio:1/1){.lsp-in{width:88cqw}.lsp-g{font-size:6cqmin}.lsp-q{font-size:6.6cqmin}@keyframes lsp-dolly{from{transform:perspective(150cqmin) rotateX(18deg) rotateZ(-5deg) translate(4cqmin,6cqmin)}to{transform:perspective(150cqmin) rotateX(14deg) rotateZ(-4deg) translate(-2cqmin,-2cqmin)}}}
.lsp-hot{animation:lsp-card .7s cubic-bezier(.16,1,.3,1) both,lsp-lit 2.4s cubic-bezier(.16,1,.3,1) both}`,
      ),
    },
  },
  // ------------------------------------------------------------------ word slam
  {
    name: "scene-word-slam",
    title: "Scene — word slam",
    description:
      "Three words slammed full-frame one per beat, each on its own colour (background, brand primary, ink). The fastest beat in a film: put it right after the hook or before the reveal. `beat` is seconds per word (0.35–0.6; match the music). Length about 3 × beat + 0.4 s. It cuts out hard (no dissolve), on the beat.",
    category: "scene",
    tags: ["format:launch", "launch", "beat", "kinetic", "words", "energy"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("word1", "Word 1", "Capture."), text("word2", "Word 2", "Nurture."), text("word3", "Word 3", "Close."), num("beat", "Seconds per word", 0.45), ...COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 1.8 * S,
      template: `${ROOT_OPEN}<style>${CSS}
@keyframes lsw-slam{0%{transform:scale(1.9);opacity:0;filter:blur(2cqmin)}55%{transform:scale(.96);opacity:1;filter:blur(0)}100%{transform:scale(1)}}
@keyframes lsw-on{from{opacity:0}to{opacity:1}}
@keyframes lsw-hold{from{transform:scale(1)}to{transform:scale(1.08)}}
.lsw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.lsw-on{animation:lsw-on .01s step-end both}
.lsw-off{animation:ls-off .01s step-end both}
.lsw-word{font-size:19cqmin;font-weight:800;letter-spacing:-.05em;line-height:1;animation:lsw-slam .38s cubic-bezier(.16,1,.3,1) both}
.lsw-zoom{animation:lsw-hold 1.6s linear both}</style>
<div class="lsw-off lsw" style="--d:calc({{beat}}s * 1)"><div class="lsw-on lsw" style="--d:0s;background:var(--bg);color:var(--ink)"><div class="lsw-zoom" style="--d:0s"><div class="lsw-word" style="--d:0s">{{word1}}</div></div></div></div>
<div class="lsw-off lsw" style="--d:calc({{beat}}s * 2)"><div class="lsw-on lsw" style="--d:calc({{beat}}s * 1);background:var(--p);color:var(--onp)"><div class="lsw-zoom" style="--d:calc({{beat}}s * 1)"><div class="lsw-word" style="--d:calc({{beat}}s * 1)">{{word2}}</div></div></div></div>
<div class="lsw-on lsw" style="--d:calc({{beat}}s * 2);background:var(--ink);color:var(--bg)"><div class="lsw-zoom" style="--d:calc({{beat}}s * 2)"><div class="lsw-word" style="--d:calc({{beat}}s * 2)">{{word3}}</div></div></div></div>`,
    },
  },
  // ------------------------------------------------------------------ product hero
  {
    name: "scene-product-hero",
    title: "Scene — product shot in 3D",
    description:
      "A product screenshot (an image asset of the brand's real product) swings up from a 3D tilt to flat, glowing in the brand colour, under a short headline, with three feature chips popping in around it. The camera keeps pushing. Only for real images of THIS product. 3.4 s.",
    category: "scene",
    tags: ["format:launch", "format:explainer", "launch", "product", "screenshot", "hero", "3d"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("headline", "Headline", "Everything in one place."),
      image("image", "Product image"),
      text("chip1", "Chip 1", "CRM"),
      text("chip2", "Chip 2", "Funnels"),
      text("chip3", "Chip 3", "Automations"),
      ...COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3.4 * S,
      template: scene(
        `<div class="lsx-h" style="animation:ls-rise .7s cubic-bezier(.16,1,.3,1) both;--d:.05s">{{headline}}</div>
<div class="lsx-f"><div class="lsx-bar"><i></i><i></i><i></i></div><img src="asset:{{image}}" class="lsx-img"/></div>
<div class="lsx-chip" style="left:12%;top:46%;--d:.95s"><b></b>{{chip1}}</div>
<div class="lsx-chip" style="right:11%;top:38%;--d:1.15s"><b></b>{{chip2}}</div>
<div class="lsx-chip" style="right:15%;top:76%;--d:1.35s"><b></b>{{chip3}}</div>`,
        `@keyframes lsx-swing{from{transform:translateX(-50%) perspective(140cqmin) rotateX(34deg) translateY(26cqmin) scale(.86);opacity:0}to{transform:translateX(-50%) perspective(140cqmin) rotateX(0deg) translateY(0) scale(1);opacity:1}}
.lsx-h{position:absolute;left:0;right:0;top:8%;text-align:center;font-size:8cqmin;font-weight:700;letter-spacing:-.035em}
.lsx-f{position:absolute;left:50%;top:25%;width:min(104cqmin,88cqw);border-radius:2.2cqmin;overflow:hidden;background:var(--card);border:.2cqmin solid var(--line);box-shadow:0 0 0 .1cqmin var(--line),0 5cqmin 16cqmin color-mix(in srgb,var(--p) 38%,transparent);animation:lsx-swing 1.1s cubic-bezier(.16,1,.3,1) both;--d:.25s}
.lsx-bar{height:4cqmin;display:flex;align-items:center;gap:1cqmin;padding:0 2cqmin;background:color-mix(in srgb,var(--ink) 6%,var(--bg))}
.lsx-bar i{width:1.2cqmin;height:1.2cqmin;border-radius:50%;background:var(--line)}
.lsx-img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top}
.lsx-chip{position:absolute;display:flex;align-items:center;gap:1.2cqmin;padding:1.6cqmin 2.6cqmin;border-radius:999px;background:var(--bg);border:.15cqmin solid var(--line);box-shadow:0 2cqmin 6cqmin color-mix(in srgb,var(--ink) 14%,transparent);font-size:3.6cqmin;font-weight:600;animation:ls-pop .55s cubic-bezier(.16,1,.3,1) both}
.lsx-chip b{width:1.6cqmin;height:1.6cqmin;border-radius:50%;background:var(--p)}`,
      ),
    },
  },
  // ------------------------------------------------------------------ feature trio
  {
    name: "scene-feature-trio",
    title: "Scene — three features",
    description:
      "A short title, then three numbered feature cards that swing up in perspective one after another, each with an accent bar that draws in; the group pans slowly. One idea per card: a 1–3 word title and a short line. 3.2 s.",
    category: "scene",
    tags: ["format:launch", "format:explainer", "launch", "features", "cards", "benefits"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("title", "Title", "One platform. Every step."),
      text("f1", "Card 1 title", "Capture"),
      text("f1d", "Card 1 line", "Forms, funnels and ads that fill your pipeline."),
      text("f2", "Card 2 title", "Nurture"),
      text("f2d", "Card 2 line", "SMS, email and DMs in one inbox."),
      text("f3", "Card 3 title", "Close"),
      text("f3d", "Card 3 line", "Bookings, payments and reviews on autopilot."),
      ...COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3.2 * S,
      template: scene(
        `<div class="lst"><div class="lst-h" style="animation:ls-rise .6s cubic-bezier(.16,1,.3,1) both;--d:.05s">{{title}}</div>
<div class="lst-row">
<div class="lst-c" style="--d:.3s"><div class="lst-n">01</div><div class="lst-b" style="--d:.55s"></div><div class="lst-t">{{f1}}</div><div class="lst-d">{{f1d}}</div></div>
<div class="lst-c" style="--d:.45s"><div class="lst-n">02</div><div class="lst-b" style="--d:.7s"></div><div class="lst-t">{{f2}}</div><div class="lst-d">{{f2d}}</div></div>
<div class="lst-c" style="--d:.6s"><div class="lst-n">03</div><div class="lst-b" style="--d:.85s"></div><div class="lst-t">{{f3}}</div><div class="lst-d">{{f3d}}</div></div>
</div></div>`,
        `@keyframes lst-in{from{opacity:0;transform:perspective(120cqmin) rotateX(-38deg) translateY(14cqmin)}}
@keyframes lst-pan{from{transform:translateX(3cqmin)}to{transform:translateX(-3cqmin)}}
.lst{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6cqmin}
.lst-h{font-size:8.6cqmin;font-weight:700;letter-spacing:-.04em;text-align:center;margin-bottom:6cqmin}
.lst-row{display:flex;flex-wrap:wrap;justify-content:center;gap:3cqmin;animation:lst-pan var(--T) ease-in-out both}
.lst-c{width:min(52cqmin,86cqw);padding:4.4cqmin;border-radius:3.4cqmin;background:var(--card);border:.15cqmin solid var(--line);box-shadow:0 3cqmin 9cqmin color-mix(in srgb,var(--ink) 9%,transparent);animation:lst-in .8s cubic-bezier(.16,1,.3,1) both;transform-origin:50% 100%}
.lst-n{font-size:3cqmin;font-weight:700;letter-spacing:.2em;color:var(--p)}
.lst-b{height:.6cqmin;width:9cqmin;border-radius:1cqmin;background:linear-gradient(90deg,var(--p),var(--s));margin:1.8cqmin 0 2.4cqmin;transform-origin:left;animation:ls-grow .7s cubic-bezier(.16,1,.3,1) both}
.lst-t{font-size:6.4cqmin;font-weight:700;letter-spacing:-.03em}
.lst-d{margin-top:1.4cqmin;font-size:3.4cqmin;line-height:1.35;color:var(--mut)}`,
      ),
    },
  },
  // ------------------------------------------------------------------ montage
  {
    name: "scene-image-montage",
    title: "Scene — image montage",
    description:
      "Four images fly in from scattered, tilted, blurred positions and lock into a tight grid while the camera pulls back, with a label chip popping in over the middle (e.g. '30,000+ agencies', 'All your channels'). Use the brand's own images; the same id may repeat. 2.8 s.",
    category: "scene",
    tags: ["format:course", "format:launch", "format:trailer", "format:documentary", "launch", "montage", "images", "grid", "social proof"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [image("image1", "Image 1"), image("image2", "Image 2"), image("image3", "Image 3"), image("image4", "Image 4"), text("label", "Label", "Built for agencies"), ...COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 2.8 * S,
      template: scene(
        `<div class="lsm"><div class="lsm-g">
<div class="lsm-t" style="--fx:-46cqmin;--fy:-30cqmin;--fr:-14deg;--d:.05s"><img src="asset:{{image1}}"/></div>
<div class="lsm-t" style="--fx:44cqmin;--fy:-26cqmin;--fr:11deg;--d:.15s"><img src="asset:{{image2}}"/></div>
<div class="lsm-t" style="--fx:-40cqmin;--fy:34cqmin;--fr:9deg;--d:.25s"><img src="asset:{{image3}}"/></div>
<div class="lsm-t" style="--fx:48cqmin;--fy:30cqmin;--fr:-10deg;--d:.35s"><img src="asset:{{image4}}"/></div>
</div><div class="lsm-l" style="--d:.85s">{{label}}</div></div>`,
        `@keyframes lsm-in{from{transform:translate(var(--fx),var(--fy)) rotate(var(--fr)) scale(1.35);filter:blur(1.4cqmin);opacity:0}}
.lsm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.lsm-g{display:grid;grid-template-columns:repeat(2,min(48cqmin,44cqw));gap:1.8cqmin}
.lsm-t{aspect-ratio:4/3;border-radius:2cqmin;overflow:hidden;box-shadow:0 3cqmin 8cqmin color-mix(in srgb,var(--ink) 18%,transparent);animation:lsm-in .9s cubic-bezier(.16,1,.3,1) both}
.lsm-t img{display:block;width:100%;height:100%;object-fit:cover}
.lsm-cam{animation:ls-pull var(--T) cubic-bezier(.16,1,.3,1) both}
.lsm-l{position:absolute;padding:1.8cqmin 3.6cqmin;border-radius:999px;background:var(--bg);color:var(--ink);font-size:5.2cqmin;font-weight:700;letter-spacing:-.025em;box-shadow:0 2cqmin 8cqmin color-mix(in srgb,var(--ink) 25%,transparent);animation:ls-pop .55s cubic-bezier(.16,1,.3,1) both}`,
        "ls-cam lsm-cam",
      ),
    },
  },
  // ------------------------------------------------------------------ stat
  {
    name: "scene-stat",
    title: "Scene — number that counts",
    description:
      "One big number counting up in the brand gradient inside a ring that draws itself, with a label under it. Use only real numbers from the brand or the user; without one, use another scene. `value` is a whole number of 2 or more; `prefix` / `suffix` are symbols only, up to 3 characters ('+', '%', 'k', 'M+', '$'); words go in `label`. 2.6 s.",
    category: "scene",
    tags: ["format:course", "format:launch", "format:explainer", "format:documentary", "launch", "stat", "proof", "number", "counter"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("prefix", "Before the number", ""), num("value", "Number", 98), text("suffix", "After the number", "%"), text("label", "Label", "of leads answered in under a minute"), num("digits", "Characters", 3, "Characters in prefix + number + suffix, to size the number to its ring (add_scene fills it in)."), ...COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 2.6 * S,
      template: scene(
        `<div class="lss"><svg xmlns="http://www.w3.org/2000/svg" class="lss-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" style="stroke:var(--line)" stroke-width="1.2"/><circle class="lss-arc" cx="50" cy="50" r="46" fill="none" style="stroke:var(--p)" stroke-width="1.6" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg>
<div class="lss-in"><div class="lss-v ls-grad">{{prefix}}<span class="lss-n" style="--to:{{value}}"></span>{{suffix}}</div><div class="lss-l" style="animation:ls-rise .6s cubic-bezier(.16,1,.3,1) both;--d:.6s">{{label}}</div></div></div>`,
        `@property --n{syntax:'&lt;integer&gt;';inherits:false;initial-value:0}
@keyframes lss-count{to{--n:var(--to)}}
@keyframes lss-draw{from{stroke-dashoffset:290}to{stroke-dashoffset:60}}
.lss{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.lss-ring{position:absolute;width:74cqmin;height:74cqmin;animation:ls-fade .5s ease-out both}
.lss-arc{stroke-dasharray:290;animation:lss-draw 1.6s cubic-bezier(.16,1,.3,1) both;--d:.1s}
.lss-in{position:relative;text-align:center;max-width:60cqmin}
.lss-v{font-size:calc(21cqmin * min(1, 3.4 / {{digits}}));font-weight:800;letter-spacing:-.05em;line-height:1;animation:ls-blurin .6s cubic-bezier(.16,1,.3,1) both}
.lss-n{counter-reset:n var(--n);animation:lss-count 1.4s cubic-bezier(.16,1,.3,1) both;--d:.1s}
.lss-n::after{content:counter(n)}
.lss-l{margin-top:2.4cqmin;font-size:4cqmin;font-weight:500;line-height:1.3;color:var(--mut)}`,
      ),
    },
  },
  // ------------------------------------------------------------------ outro
  {
    name: "scene-wordmark-outro",
    title: "Scene — wordmark reveal and call to action",
    description:
      "The brand name blurs in with its letters closing up and a brand-coloured dot, the camera punches in on the end of the wordmark and back out, then the tagline and a call-to-action button with the web address land. The film's last scene; hold ≥ 4 s.",
    category: "scene",
    tags: ["format:launch", "format:explainer", "launch", "outro", "brand", "logo", "cta", "end card"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("brand", "Brand name", "Acme"), text("tagline", "Tagline", "Grow on autopilot."), text("cta", "Button", "Start free trial"), text("url", "Web address", "acme.com"), ...COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 4.4 * S,
      template: `${ROOT_OPEN}<style>${CSS}
@keyframes lso-in{from{opacity:0;filter:blur(3cqmin);letter-spacing:.35em}}
@keyframes lso-punch{0%,15%{transform:scale(1)}38%,50%{transform:scale(2.5)}78%,100%{transform:scale(1) translateY(-7cqmin)}}
.lso{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.lso-z{animation:lso-punch 2.6s cubic-bezier(.7,0,.2,1) both;--d:.3s;transform-origin:80% 50%;display:flex;align-items:baseline}
.lso-w{font-size:19cqmin;font-weight:800;letter-spacing:-.055em;line-height:1;animation:lso-in .9s cubic-bezier(.16,1,.3,1) both;--d:.05s;white-space:nowrap}
.lso-dot{width:4.2cqmin;height:4.2cqmin;border-radius:50%;margin-left:1.4cqmin;background:var(--p);box-shadow:0 0 6cqmin var(--p);animation:ls-pop .5s cubic-bezier(.16,1,.3,1) both;--d:.7s}
.lso-under{position:absolute;left:0;right:0;top:60%;display:flex;flex-direction:column;align-items:center;gap:3.4cqmin}
.lso-t{font-size:5cqmin;font-weight:500;color:var(--mut);animation:ls-rise .6s cubic-bezier(.16,1,.3,1) both;--d:2.4s}
.lso-row{display:flex;align-items:center;gap:2.6cqmin;animation:ls-rise .6s cubic-bezier(.16,1,.3,1) both;--d:2.6s}
.lso-cta{padding:2.4cqmin 5cqmin;border-radius:999px;background:var(--p);color:var(--onp);font-size:4.2cqmin;font-weight:700;box-shadow:0 2cqmin 7cqmin color-mix(in srgb,var(--p) 45%,transparent)}
.lso-url{font-size:4cqmin;font-weight:600;color:var(--ink)}</style>
${BLOBS}<div class="lso"><div class="lso-z"><div class="lso-w">{{brand}}</div><div class="lso-dot"></div></div></div>
<div class="lso-under"><div class="lso-t">{{tagline}}</div><div class="lso-row"><div class="lso-cta">{{cta}}</div><div class="lso-url">{{url}}</div></div></div></div>`,
    },
  },
  // ------------------------------------------------------------------ conversation
  {
    name: "scene-chat-thread",
    title: "Scene — conversation",
    description:
      "A headline beside a phone-style conversation in 3D: a customer message, the business replying (typing dots first), back and forth. For messaging, inbox, follow-up and AI-reply features. Short, real-sounding messages. 3.6 s.",
    category: "scene",
    tags: ["format:course", "format:launch", "format:explainer", "launch", "chat", "sms", "messaging", "conversation", "ai"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("headline", "Headline", "Reply before they bounce."),
      text("contact", "Contact name", "Jordan · SMS"),
      text("m1", "Customer message 1", "Hi! Do you have anything open this week?"),
      text("m2", "Reply 1", "Yes! Thursday 2pm or Friday 10am?"),
      text("m3", "Customer message 2", "Thursday works 🙌"),
      text("m4", "Reply 2", "Booked. See you Thursday!"),
      ...COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3.6 * S,
      template: scene(
        `<div class="lsc">
<div class="lsc-h" style="animation:ls-rise .7s cubic-bezier(.16,1,.3,1) both;--d:.05s">{{headline}}</div>
<div class="lsc-ph"><div class="lsc-top"><b></b><span>{{contact}}</span></div>
<div class="lsc-msg lsc-in" style="--d:.35s">{{m1}}</div>
<div class="lsc-msg lsc-out" style="--d:1.05s"><span class="lsc-dots" style="--d:.75s"><i></i><i></i><i></i></span>{{m2}}</div>
<div class="lsc-msg lsc-in" style="--d:1.7s">{{m3}}</div>
<div class="lsc-msg lsc-out" style="--d:2.35s">{{m4}}</div>
</div></div>`,
        `@keyframes lsc-turn{from{transform:perspective(150cqmin) rotateY(-22deg) rotateX(8deg) translateY(6cqmin)}to{transform:perspective(150cqmin) rotateY(-9deg) rotateX(3deg) translateY(0)}}
@keyframes lsc-msg{from{opacity:0;transform:translateY(3cqmin) scale(.92)}}
.lsc{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8cqmin;padding:0 8cqmin}
.lsc-h{flex:0 1 66cqmin;font-size:10.5cqmin;font-weight:700;letter-spacing:-.04em;line-height:1.05}
.lsc-ph{flex:0 0 auto;width:min(80cqmin,88cqw);padding:3.6cqmin;border-radius:5cqmin;background:var(--card);border:.2cqmin solid var(--line);box-shadow:0 5cqmin 14cqmin color-mix(in srgb,var(--ink) 16%,transparent);display:flex;flex-direction:column;gap:1.6cqmin;animation:lsc-turn var(--T) cubic-bezier(.3,0,.2,1) both}
.lsc-top{display:flex;align-items:center;gap:1.6cqmin;padding-bottom:1.8cqmin;border-bottom:.15cqmin solid var(--line);font-size:3.6cqmin;font-weight:600}
.lsc-top b{width:5cqmin;height:5cqmin;border-radius:50%;background:linear-gradient(135deg,var(--p),var(--s))}
.lsc-msg{max-width:80%;padding:2.2cqmin 3cqmin;border-radius:3.2cqmin;font-size:4cqmin;line-height:1.3;animation:lsc-msg .45s cubic-bezier(.16,1,.3,1) both}
.lsc-in{align-self:flex-start;background:color-mix(in srgb,var(--ink) 9%,var(--bg));border-bottom-left-radius:.8cqmin}
.lsc-out{align-self:flex-end;background:var(--p);color:var(--onp);border-bottom-right-radius:.8cqmin;position:relative}
.lsc-dots{position:absolute;right:0;bottom:calc(100% + 1.2cqmin);display:flex;gap:.7cqmin;padding:1.4cqmin 2cqmin;border-radius:3cqmin;background:color-mix(in srgb,var(--ink) 9%,var(--bg));animation:lsc-dots .3s step-end both}
@keyframes lsc-dots{0%,99%{opacity:1}100%{opacity:0}}
.lsc-dots i{width:1.1cqmin;height:1.1cqmin;border-radius:50%;background:var(--mut)}
@container (max-aspect-ratio:1/1){.lsc{flex-direction:column;gap:5cqmin}.lsc-h{flex:none;text-align:center;font-size:7.4cqmin}}`,
      ),
    },
  },
  // ------------------------------------------------------------------ notifications
  {
    name: "scene-notifications",
    title: "Scene — notifications landing",
    description:
      "A headline, and app notifications sliding in one after another and stacking up (new lead, booking, payment, review…), each with a coloured dot and 'now'. Shows results happening. Each line ≤ ~40 characters. 3.4 s.",
    category: "scene",
    tags: ["format:launch", "format:explainer", "launch", "notifications", "results", "activity", "proof"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("headline", "Headline", "While you sleep."),
      text("app", "App name", "Acme"),
      text("n1", "Notification 1", "New lead from your website"),
      text("n2", "Notification 2", "Appointment booked for 2:00 PM"),
      text("n3", "Notification 3", "Invoice paid · $1,200"),
      text("n4", "Notification 4", "New 5-star review"),
      ...COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3.4 * S,
      template: scene(
        `<div class="lsn"><div class="lsn-h" style="animation:ls-rise .7s cubic-bezier(.16,1,.3,1) both;--d:.05s">{{headline}}</div>
<div class="lsn-col">
<div class="lsn-t" style="--d:.3s;--c:var(--p)"><b></b><div><div class="lsn-a">{{app}} <span>now</span></div><div class="lsn-x">{{n1}}</div></div></div>
<div class="lsn-t" style="--d:.75s;--c:var(--s)"><b></b><div><div class="lsn-a">{{app}} <span>now</span></div><div class="lsn-x">{{n2}}</div></div></div>
<div class="lsn-t" style="--d:1.2s;--c:var(--p)"><b></b><div><div class="lsn-a">{{app}} <span>now</span></div><div class="lsn-x">{{n3}}</div></div></div>
<div class="lsn-t" style="--d:1.65s;--c:var(--s)"><b></b><div><div class="lsn-a">{{app}} <span>now</span></div><div class="lsn-x">{{n4}}</div></div></div>
</div></div>`,
        `@keyframes lsn-in{from{opacity:0;transform:translate(10cqmin,-4cqmin) scale(.9);filter:blur(.6cqmin)}}
.lsn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8cqmin;padding:0 8cqmin}
.lsn-h{flex:0 1 60cqmin;font-size:11cqmin;font-weight:700;letter-spacing:-.04em;line-height:1.05}
.lsn-col{flex:0 0 auto;width:min(86cqmin,90cqw);display:flex;flex-direction:column;gap:2.2cqmin}
.lsn-t{display:flex;align-items:center;gap:2.4cqmin;padding:2.4cqmin 3cqmin;border-radius:3cqmin;background:color-mix(in srgb,var(--card) 88%,transparent);border:.15cqmin solid var(--line);box-shadow:0 3cqmin 9cqmin color-mix(in srgb,var(--ink) 12%,transparent);animation:lsn-in .6s cubic-bezier(.16,1,.3,1) both}
.lsn-t b{flex:0 0 auto;width:7.4cqmin;height:7.4cqmin;border-radius:1.6cqmin;background:var(--c)}
.lsn-a{font-size:2.9cqmin;font-weight:700;letter-spacing:.04em;color:var(--mut)}.lsn-a span{font-weight:500;margin-left:1cqmin}
.lsn-x{margin-top:.4cqmin;font-size:4.3cqmin;font-weight:600}
@container (max-aspect-ratio:1/1){.lsn{flex-direction:column;gap:5cqmin}.lsn-h{flex:none;text-align:center;font-size:8cqmin}}`,
      ),
    },
  },
  // ------------------------------------------------------------------ product close-up
  {
    name: "scene-ui-zoom",
    title: "Scene — product close-up",
    description:
      "A real product screenshot fills the frame, then the camera zooms into one part of it (`x`, `y`: where, as 0–1 fractions of the image; `zoom` 1.6–3) while a ring marks it and a label card explains it. Use several with the same screenshot and different spots to walk through the product. 3.6 s.",
    category: "scene",
    tags: ["format:launch", "format:explainer", "launch", "product", "screenshot", "zoom", "walkthrough", "feature"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [image("image", "Product image"), num("x", "Focus x (0–1)", 0.3), num("y", "Focus y (0–1)", 0.35), num("zoom", "Zoom (1.6–3)", 2.2), text("label", "Label", "Every lead, one inbox"), text("sub", "Line under it", "SMS, email, DMs and calls together."), ...COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3.6 * S,
      template: scene(
        `<div class="lsz-frame"><div class="lsz-cam"><img src="asset:{{image}}" class="lsz-img"/><div class="lsz-ring"></div></div></div>
<div class="lsz-card"><div class="lsz-l">{{label}}</div><div class="lsz-s">{{sub}}</div></div>`,
        `@keyframes lsz-zoom{from{transform:scale(1)}to{transform:scale({{zoom}})}}
@keyframes lsz-in{from{opacity:0;transform:translate(-50%,-46%) scale(.94)}}
.lsz-frame{position:absolute;left:50%;top:50%;width:min(150cqmin,90cqw);aspect-ratio:16/10;transform:translate(-50%,-50%);border-radius:2.4cqmin;overflow:hidden;background:var(--card);border:.2cqmin solid var(--line);box-shadow:0 5cqmin 16cqmin color-mix(in srgb,var(--ink) 18%,transparent);animation:lsz-in .7s cubic-bezier(.16,1,.3,1) both}
.lsz-cam{position:absolute;inset:0;transform-origin:calc({{x}} * 100%) calc({{y}} * 100%);animation:lsz-zoom 1.8s cubic-bezier(.7,0,.2,1) both;--d:.5s}
.lsz-img{display:block;width:100%;height:100%;object-fit:cover;object-position:top left}
.lsz-ring{position:absolute;left:calc({{x}} * 100%);top:calc({{y}} * 100%);width:16%;aspect-ratio:1.6;transform:translate(-50%,-50%);border:.5cqmin solid var(--p);border-radius:1.6cqmin;box-shadow:0 0 0 100cqmax color-mix(in srgb,#000 22%,transparent);animation:ls-fade .4s ease-out both;--d:1.9s}
.lsz-card{position:absolute;left:6%;bottom:8%;max-width:72cqmin;padding:3.6cqmin 4.2cqmin;border-radius:3cqmin;background:var(--bg);color:var(--ink);box-shadow:0 4cqmin 12cqmin color-mix(in srgb,#000 25%,transparent);animation:ls-pop .6s cubic-bezier(.16,1,.3,1) both;--d:2s}
.lsz-l{font-size:6.4cqmin;font-weight:700;letter-spacing:-.03em;line-height:1.1}
.lsz-s{margin-top:1.2cqmin;font-size:3.6cqmin;color:var(--mut);line-height:1.35}`,
      ),
    },
  },
  // ------------------------------------------------------------------ before / after
  {
    name: "scene-before-after",
    title: "Scene — before and after",
    description:
      "Split frame: on the left the old way (four tool or task chips, scattered and tilted, then struck through and dimmed); on the right the brand's way, one clean card with a check. For 'replace your stack' moments. 3.6 s.",
    category: "scene",
    tags: ["format:launch", "format:explainer", "launch", "comparison", "before after", "replace", "problem"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("beforeTitle", "Before title", "Before"),
      text("b1", "Old way 1", "CRM"),
      text("b2", "Old way 2", "Email tool"),
      text("b3", "Old way 3", "Scheduler"),
      text("b4", "Old way 4", "Funnel builder"),
      text("afterTitle", "After title", "Now"),
      text("after", "The new way", "One platform for all of it."),
      ...COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3.6 * S,
      template: scene(
        `<div class="lsb"><div class="lsb-l"><div class="lsb-k">{{beforeTitle}}</div>
<div class="lsb-chips"><span style="--r:-8deg;--d:.15s">{{b1}}</span><span style="--r:6deg;--d:.25s">{{b2}}</span><span style="--r:-4deg;--d:.35s">{{b3}}</span><span style="--r:9deg;--d:.45s">{{b4}}</span></div>
<div class="lsb-dim" style="--d:1.2s"></div></div>
<div class="lsb-div" style="--d:1.1s"></div>
<div class="lsb-r"><div class="lsb-k lsb-kp" style="animation:ls-fade .4s ease-out both;--d:1.35s">{{afterTitle}}</div><div class="lsb-card" style="--d:1.5s"><b>✓</b>{{after}}</div></div></div>`,
        `@keyframes lsb-chip{from{opacity:0;transform:rotate(var(--r)) translateY(5cqmin) scale(.8)}to{transform:rotate(var(--r))}}
@keyframes lsb-strike{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes lsb-down{to{opacity:.35;filter:grayscale(1)}}
@keyframes lsb-grow{from{transform:scaleY(0)}}
@keyframes lsb-card{from{opacity:0;transform:translateX(8cqmin) scale(.94)}}
.lsb{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 8cqmin;gap:6cqmin}
.lsb-l,.lsb-r{flex:1 1 0;position:relative;display:flex;flex-direction:column;gap:3cqmin}
.lsb-k{font-size:3.8cqmin;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--mut)}
.lsb-kp{color:var(--p)}
.lsb-chips{display:flex;flex-wrap:wrap;gap:2.4cqmin;animation:lsb-down .5s ease-out both;--d:1.25s}
.lsb-chips span{position:relative;padding:2.6cqmin 3.8cqmin;border-radius:2.6cqmin;background:var(--card);border:.15cqmin solid var(--line);font-size:5cqmin;font-weight:600;animation:lsb-chip .55s cubic-bezier(.16,1,.3,1) both}
.lsb-dim{position:absolute;left:-2%;right:-2%;top:62%;height:.6cqmin;background:color-mix(in srgb,#e5484d 85%,var(--ink));transform-origin:left;animation:lsb-strike .45s cubic-bezier(.7,0,.2,1) both}
.lsb-div{flex:0 0 .3cqmin;align-self:stretch;margin:16cqmin 0;background:var(--line);transform-origin:top;animation:lsb-grow .5s cubic-bezier(.7,0,.2,1) both}
.lsb-card{display:flex;align-items:center;gap:2.6cqmin;padding:4cqmin;border-radius:3.4cqmin;background:var(--card);border:.2cqmin solid var(--p);box-shadow:0 4cqmin 12cqmin color-mix(in srgb,var(--p) 30%,transparent);font-size:7cqmin;font-weight:700;letter-spacing:-.03em;line-height:1.15;animation:lsb-card .7s cubic-bezier(.16,1,.3,1) both}
.lsb-card b{flex:0 0 auto;display:grid;place-items:center;width:8.4cqmin;height:8.4cqmin;border-radius:50%;background:var(--p);color:var(--onp);font-size:4cqmin}
@container (max-aspect-ratio:1/1){.lsb{flex-direction:column;justify-content:center}.lsb-l,.lsb-r{flex:none;width:100%}.lsb-div{display:none}}`,
      ),
    },
  },
  // ------------------------------------------------------------------ steps
  {
    name: "scene-steps",
    title: "Scene — how it works in steps",
    description:
      "A title, then a line drawing across four steps; each step's node lights up in the brand colour as the line reaches it and its label rises in. For 'how it works', onboarding or a workflow. Labels 1–3 words. 3.4 s.",
    category: "scene",
    tags: ["format:course", "format:launch", "format:explainer", "format:documentary", "launch", "steps", "workflow", "how it works", "timeline", "process"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("title", "Title", "From click to customer."), text("s1", "Step 1", "Ad click"), text("s2", "Step 2", "Instant reply"), text("s3", "Step 3", "Booked call"), text("s4", "Step 4", "Paid invoice"), ...COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3.4 * S,
      template: scene(
        `<div class="lsq"><div class="lsq-h" style="animation:ls-rise .6s cubic-bezier(.16,1,.3,1) both;--d:.05s">{{title}}</div>
<div class="lsq-row"><div class="lsq-line"><i style="--d:.45s"></i></div>
<div class="lsq-s" style="--d:.5s"><b></b><span>{{s1}}</span></div><div class="lsq-s" style="--d:.95s"><b></b><span>{{s2}}</span></div><div class="lsq-s" style="--d:1.4s"><b></b><span>{{s3}}</span></div><div class="lsq-s" style="--d:1.85s"><b></b><span>{{s4}}</span></div>
</div></div>`,
        `@keyframes lsq-draw{from{transform:scaleX(0)}}
@keyframes lsq-node{0%{transform:scale(.5);background:var(--bg)}60%{transform:scale(1.25)}100%{transform:scale(1);background:var(--p)}}
.lsq{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 8cqmin}
.lsq-h{font-size:9.4cqmin;font-weight:700;letter-spacing:-.04em;margin-bottom:9cqmin;text-align:center}
.lsq-row{position:relative;width:min(150cqmin,90cqw);display:flex;justify-content:space-between}
.lsq-line{position:absolute;left:6%;right:6%;top:2.6cqmin;height:.5cqmin;background:var(--line);border-radius:1cqmin}
.lsq-line i{position:absolute;inset:0;background:linear-gradient(90deg,var(--p),var(--s));border-radius:1cqmin;transform-origin:left;animation:lsq-draw 1.6s cubic-bezier(.45,0,.25,1) both}
.lsq-s{position:relative;flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:3cqmin;text-align:center}
.lsq-s b{width:5.6cqmin;height:5.6cqmin;border-radius:50%;border:.5cqmin solid var(--p);background:var(--bg);animation:lsq-node .5s cubic-bezier(.16,1,.3,1) both}
.lsq-s span{font-size:5cqmin;font-weight:700;letter-spacing:-.02em;animation:ls-rise .55s cubic-bezier(.16,1,.3,1) both}`,
      ),
    },
  },
  // ------------------------------------------------------------------ feature wall
  {
    name: "scene-feature-wall",
    title: "Scene — feature wall",
    description:
      "A tilted wall of giant words in three rows sliding in opposite directions (outlined, solid and brand-gradient), with a title pill popping in over the middle. Shows breadth: 'everything it does' in one beat. Words 1–2 each. 2.8 s.",
    category: "scene",
    tags: ["format:launch", "launch", "features", "marquee", "kinetic", "typography", "breadth"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("title", "Title", "All in one place"),
      text("w1", "Word 1", "CRM"),
      text("w2", "Word 2", "Funnels"),
      text("w3", "Word 3", "Websites"),
      text("w4", "Word 4 (highlighted)", "AI Employee"),
      text("w5", "Word 5", "Calendars"),
      text("w6", "Word 6", "Payments"),
      text("w7", "Word 7", "Reviews"),
      text("w8", "Word 8", "Courses"),
      ...COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 2.8 * S,
      template: scene(
        `<div class="lsm2"><div class="lsm2-wall">
<div class="lsm2-r lsm2-o" style="--a:lsm2-l">{{w1}} · {{w2}} · {{w3}} · {{w1}} · {{w2}} · {{w3}}</div>
<div class="lsm2-r" style="--a:lsm2-r">{{w5}} · <span class="ls-grad">{{w4}}</span> · {{w6}} · {{w5}} · <span class="ls-grad">{{w4}}</span> · {{w6}}</div>
<div class="lsm2-r lsm2-o" style="--a:lsm2-l">{{w7}} · {{w8}} · {{w2}} · {{w7}} · {{w8}} · {{w2}}</div>
</div><div class="lsm2-t" style="--d:.7s">{{title}}</div></div>`,
        `@keyframes lsm2-l{from{transform:translateX(-4%)}to{transform:translateX(-30%)}}
@keyframes lsm2-r{from{transform:translateX(-30%)}to{transform:translateX(-4%)}}
.lsm2{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.lsm2-wall{position:absolute;left:-20%;right:-20%;top:50%;transform:translateY(-50%) rotate(-7deg);display:flex;flex-direction:column;gap:2cqmin}
.lsm2-r{white-space:nowrap;font-size:15cqmin;font-weight:800;letter-spacing:-.04em;line-height:1.05;animation:var(--a) var(--T) linear both}
.lsm2-o{color:transparent;-webkit-text-stroke:.25cqmin var(--mut)}
.lsm2-o .ls-grad{-webkit-text-stroke:0}
.lsm2-t{position:relative;padding:2.8cqmin 6cqmin;border-radius:999px;background:var(--ink);color:var(--bg);font-size:6.6cqmin;font-weight:700;letter-spacing:-.02em;box-shadow:0 3cqmin 10cqmin color-mix(in srgb,#000 30%,transparent);animation:ls-pop .55s cubic-bezier(.16,1,.3,1) both}`,
      ),
    },
  },
  // ------------------------------------------------------------------ statement
  {
    name: "scene-statement",
    title: "Scene — kinetic statement",
    description:
      "A three-line statement set big and left-aligned, each line arriving with its own move (a masked rise, a scale-in in the brand gradient, a slide); the middle line is the biggest. For the 'big idea' or a turn in the story. Lines 1–4 words. 2.8 s.",
    category: "scene",
    tags: ["format:course", "format:launch", "format:explainer", "launch", "statement", "typography", "kinetic", "headline", "manifesto"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("line1", "Line 1", "Stop managing tools."), text("line2", "Line 2 (big)", "Start growing."), text("line3", "Line 3", "Everything else is automatic."), ...COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 2.8 * S,
      template: scene(
        `<div class="lsk"><div class="lsk-m"><div class="lsk-1" style="--d:.05s">{{line1}}</div></div>
<div class="lsk-2 ls-grad" style="--d:.45s">{{line2}}</div>
<div class="lsk-m"><div class="lsk-3" style="--d:.95s">{{line3}}</div></div></div>`,
        `@keyframes lsk-up{from{transform:translateY(110%)}}
@keyframes lsk-scale{from{opacity:0;transform:scale(1.3);filter:blur(1.6cqmin)}}
@keyframes lsk-slide{from{opacity:0;transform:translateX(-12cqmin)}}
.lsk{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 10cqmin;gap:1.6cqmin}
.lsk-m{overflow:hidden;padding-bottom:1cqmin}
.lsk-1{font-size:7cqmin;font-weight:600;letter-spacing:-.035em;color:var(--mut);animation:lsk-up .7s cubic-bezier(.16,1,.3,1) both}
.lsk-2{font-size:16cqmin;font-weight:800;letter-spacing:-.055em;line-height:1;transform-origin:left;animation:lsk-scale .8s cubic-bezier(.16,1,.3,1) both}
.lsk-3{font-size:5.6cqmin;font-weight:500;letter-spacing:-.02em;animation:lsk-slide .7s cubic-bezier(.16,1,.3,1) both}`,
      ),
    },
  },
  // ------------------------------------------------------------------ quote
  {
    name: "scene-quote",
    title: "Scene — customer quote",
    description:
      "A big quotation mark in the brand colour, a customer's words set large, and their name and role. Only for a real quote from the brand's site or the user, never invented. Quote ≤ ~110 characters. 3.8 s.",
    category: "scene",
    tags: ["format:course", "format:launch", "format:documentary", "launch", "testimonial", "quote", "proof", "customer"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("quote", "Quote", "We replaced six tools and doubled our booked calls in a month."), text("name", "Name", "Sam Rivera"), text("role", "Role", "Founder, Northwind Agency"), ...COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3.8 * S,
      template: scene(
        `<div class="lsu"><div class="lsu-mark" style="--d:.05s">“</div>
<div class="lsu-q" style="--d:.3s">{{quote}}</div>
<div class="lsu-by" style="--d:1.1s"><i></i><div><div class="lsu-n">{{name}}</div><div class="lsu-r">{{role}}</div></div></div></div>`,
        `.lsu{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 12cqmin}
.lsu-mark{font-size:30cqmin;line-height:.6;height:12cqmin;font-weight:800;color:var(--p);animation:ls-pop .6s cubic-bezier(.16,1,.3,1) both}
.lsu-q{max-width:150cqmin;font-size:7.4cqmin;font-weight:600;letter-spacing:-.035em;line-height:1.15;animation:ls-rise .9s cubic-bezier(.16,1,.3,1) both}
.lsu-by{display:flex;align-items:center;gap:2.4cqmin;margin-top:5cqmin;animation:ls-rise .6s cubic-bezier(.16,1,.3,1) both}
.lsu-by i{width:1cqmin;height:7cqmin;border-radius:1cqmin;background:linear-gradient(var(--p),var(--s))}
.lsu-n{font-size:3.8cqmin;font-weight:700}
.lsu-r{font-size:3cqmin;color:var(--mut);margin-top:.4cqmin}`,
      ),
    },
  },
];

/** Shared with the film scenes (not part of the package API). */
export { COMMON as SCENE_COMMON, CSS as SCENE_CSS, ROOT_OPEN as SCENE_ROOT_OPEN, image as imageField, num as numField, S as SECOND, text as textField };
