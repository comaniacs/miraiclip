/**
 * The built-in blocks: 20 tested pieces that cover what most product, tutorial
 * and social videos need. Each one renders the same in preview, browser and
 * server export (the test suite renders every block). Sized blocks are drawn
 * at the 1080p reference and scaled by `blockCommands` for other sizes;
 * full-frame blocks size themselves with vmin units.
 *
 * Templates follow the html-clip rules: well-formed XML, no scripts, and
 * animated blocks drive CSS @keyframes with `--d` delays and `--T` (the clip's
 * length in seconds).
 */
import type { BlockInput } from "./types.js";

const FONT = "Inter,system-ui,'Segoe UI',Roboto,sans-serif";
const S = 1_000_000;

const textField = (key: string, label: string, value: string) => ({ key, label, type: "text" as const, default: value });
const colorField = (key: string, label: string, value: string) => ({ key, label, type: "color" as const, default: value });

/** Shared keyframes for animated blocks. */
const KEYFRAMES = `@keyframes mc-rise{from{transform:translateY(40%);opacity:0}}
@keyframes mc-fade{from{opacity:0}}
@keyframes mc-out{to{opacity:0}}
@keyframes mc-pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.06);opacity:1}100%{transform:scale(1)}}
@keyframes mc-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes mc-growx{from{transform:scaleX(0)}}`;

/**
 * Wrap content in an exit fade that starts `seconds` before the clip ends.
 * (The renderer sets every animation's delay from `--d`, so an element can't
 * carry both an entrance and an exit: the exit lives on this wrapper, and
 * the content resets `--d` for its own entrance.)
 */
const exit = (inner: string, seconds = 0.4, style = ""): string =>
  `<div style="${style}animation:mc-out ${seconds}s ease-in both;--d:calc(var(--T) - ${seconds}s)">${inner}</div>`;

export const BUILTIN_BLOCKS: BlockInput[] = [
  // ---------------------------------------------------------------- lower thirds
  {
    name: "lower-third-classic",
    title: "Lower third — classic",
    description: "Name and role on a dark card with an accent bar. Slides in and fades out on its own.",
    category: "lower-third",
    tags: ["name", "interview", "speaker"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [textField("name", "Name", "Ada Lovelace"), textField("role", "Role", "Founder, Analytical Co."), colorField("accent", "Accent", "#8b7bff")],
    content: {
      kind: "html",
      animated: true,
      widthPx: 900,
      heightPx: 160,
      durationUs: 5 * S,
      transform: { x: 0.3, y: 0.84 },
      template: `<div style="width:900px;height:160px;font-family:${FONT}"><style>${KEYFRAMES}
.lt{display:flex;align-items:center;gap:24px;height:140px;margin-top:10px;padding:0 34px;border-radius:20px;background:#0a0d18e6;border:1px solid #ffffff22;color:#fff;--d:0s;animation:mc-wipe .6s cubic-bezier(.65,0,.35,1) both}</style>
${exit(`<div class="lt"><div style="width:8px;height:80px;border-radius:4px;background:{{accent}}"></div>
<div><div style="font-weight:800;font-size:46px;line-height:1.1">{{name}}</div><div style="font-weight:500;font-size:30px;color:#c3cbe0;margin-top:4px">{{role}}</div></div></div>`)}</div>`,
    },
  },
  {
    name: "lower-third-pill",
    title: "Lower third — pill",
    description: "A bright rounded pill with a name and a short role. Pops in.",
    category: "lower-third",
    tags: ["name", "social", "playful"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [textField("name", "Name", "Sam Rivera"), textField("role", "Role", "Product designer"), colorField("color", "Pill colour", "#ffffff"), colorField("ink", "Text colour", "#0a0d18")],
    content: {
      kind: "html",
      animated: true,
      widthPx: 760,
      heightPx: 130,
      durationUs: 4 * S,
      transform: { x: 0.5, y: 0.82 },
      template: `<div style="width:760px;height:130px;display:flex;align-items:center;justify-content:center;font-family:${FONT}"><style>${KEYFRAMES}</style>
${exit(`<div style="display:flex;align-items:baseline;gap:18px;padding:22px 44px;border-radius:999px;background:{{color}};color:{{ink}};box-shadow:0 18px 50px #0006;--d:0s;animation:mc-pop .5s cubic-bezier(.2,.8,.2,1) both">
<span style="font-weight:800;font-size:44px">{{name}}</span><span style="font-weight:500;font-size:30px;opacity:.7">{{role}}</span></div>`, 0.35)}</div>`,
    },
  },
  {
    name: "lower-third-minimal",
    title: "Lower third — minimal",
    description: "White text with a thin line that draws in. Quiet enough for documentary and interview footage.",
    category: "lower-third",
    tags: ["name", "minimal", "documentary"],
    aspects: ["16:9", "1:1"],
    fields: [textField("name", "Name", "Dr. Mei Tanaka"), textField("role", "Role", "Climate scientist")],
    content: {
      kind: "html",
      animated: true,
      widthPx: 800,
      heightPx: 150,
      durationUs: 5 * S,
      transform: { x: 0.27, y: 0.83 },
      template: `<div style="width:800px;height:150px;font-family:${FONT};color:#fff;text-shadow:0 2px 12px #000a"><style>${KEYFRAMES}
</style>
${exit(`<div style="font-weight:700;font-size:48px;--d:0s;animation:mc-rise .6s cubic-bezier(.2,.8,.2,1) both">{{name}}</div>
<div style="height:3px;width:420px;margin:14px 0;background:#fff;transform-origin:left;animation:mc-growx .7s cubic-bezier(.65,0,.35,1) both;--d:.15s"></div>
<div style="font-weight:400;font-size:30px;opacity:.85;animation:mc-fade .6s ease-out both;--d:.35s">{{role}}</div>`)}</div>`,
    },
  },
  {
    name: "lower-third-gradient",
    title: "Lower third — gradient",
    description: "A gradient card with a name, a role and a handle. Good for creators and launch videos.",
    category: "lower-third",
    tags: ["name", "creator", "brand"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [textField("name", "Name", "Jordan Lee"), textField("role", "Role", "Developer advocate"), textField("handle", "Handle", "@jordanbuilds"), colorField("from", "Gradient start", "#8b7bff"), colorField("to", "Gradient end", "#22d3ee")],
    content: {
      kind: "html",
      animated: true,
      widthPx: 940,
      heightPx: 180,
      durationUs: 5 * S,
      transform: { x: 0.3, y: 0.83 },
      template: `<div style="width:940px;height:180px;font-family:${FONT}"><style>${KEYFRAMES}</style>
${exit(`<div style="height:160px;margin-top:10px;padding:26px 40px;border-radius:24px;background:linear-gradient(110deg,{{from}},{{to}});color:#fff;box-shadow:0 24px 60px #0007;--d:0s;animation:mc-rise .6s cubic-bezier(.2,.8,.2,1) both">
<div style="font-weight:800;font-size:46px;line-height:1.1">{{name}}</div>
<div style="display:flex;gap:18px;margin-top:8px;font-size:28px;font-weight:500"><span>{{role}}</span><span style="opacity:.75">{{handle}}</span></div></div>`)}</div>`,
    },
  },
  // ---------------------------------------------------------------- callouts
  {
    name: "callout-tooltip",
    title: "Callout — tooltip",
    description: "A dark tooltip with a pointer arrow. Place it beside the control you're talking about.",
    category: "callout",
    tags: ["tutorial", "screen", "label", "step"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [textField("text", "Text", "Click Save to publish"), { key: "side", label: "Arrow side (left/right/top/bottom)", type: "text", default: "left" }],
    content: {
      kind: "html",
      animated: true,
      widthPx: 640,
      heightPx: 140,
      durationUs: 3 * S,
      transform: { x: 0.6, y: 0.4 },
      template: `<div style="width:640px;height:140px;display:flex;align-items:center;font-family:${FONT}"><style>${KEYFRAMES}
.tip{position:relative;margin:0 30px;padding:22px 32px;border-radius:18px;background:#111827f2;color:#fff;font-weight:600;font-size:34px;box-shadow:0 16px 40px #0008;--d:0s;animation:mc-pop .45s cubic-bezier(.2,.8,.2,1) both}
.tip::before{content:'';position:absolute;width:26px;height:26px;background:#111827f2;transform:rotate(45deg)}
.left::before{left:-12px;top:calc(50% - 13px)}.right::before{right:-12px;top:calc(50% - 13px)}
.top::before{top:-12px;left:40px}.bottom::before{bottom:-12px;left:40px}</style>
${exit(`<div class="tip {{side}}">{{text}}</div>`, 0.3)}</div>`,
    },
  },
  {
    name: "callout-step-badge",
    title: "Callout — step badge",
    description: "A numbered circle that pops in with a pulse ring. Mark the order of steps on screen.",
    category: "callout",
    tags: ["tutorial", "step", "number"],
    aspects: ["any"],
    fields: [textField("n", "Number", "1"), colorField("color", "Colour", "#22d3ee")],
    content: {
      kind: "html",
      animated: true,
      widthPx: 200,
      heightPx: 200,
      durationUs: 3 * S,
      transform: { x: 0.5, y: 0.5 },
      template: `<div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;font-family:${FONT}"><style>${KEYFRAMES}
@keyframes ring{0%{transform:scale(.8);opacity:.8}100%{transform:scale(1.6);opacity:0}}</style>
${exit(`<div style="position:relative;width:200px;height:200px;display:flex;align-items:center;justify-content:center"><div style="position:absolute;left:45px;top:45px;width:110px;height:110px;box-sizing:border-box;border-radius:50%;border:6px solid {{color}};animation:ring 1.2s ease-out 2 both;--d:.3s"></div>
<div style="width:110px;height:110px;border-radius:50%;background:{{color}};color:#04121a;font-weight:900;font-size:58px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px #0007;--d:0s;animation:mc-pop .45s cubic-bezier(.2,.8,.2,1) both">{{n}}</div></div>`, 0.3)}</div>`,
    },
  },
  {
    name: "callout-highlight-box",
    title: "Callout — highlight box",
    description: "A rounded outline that draws around a part of the screen. Resize it with the clip's scale or widthPx/heightPx.",
    category: "callout",
    tags: ["tutorial", "screen", "focus"],
    aspects: ["any"],
    fields: [colorField("color", "Colour", "#facc15")],
    content: {
      kind: "html",
      animated: true,
      widthPx: 520,
      heightPx: 200,
      durationUs: 3 * S,
      transform: { x: 0.5, y: 0.5 },
      template: `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="200" viewBox="0 0 520 200"><style>@keyframes draw{from{stroke-dashoffset:1500}}@keyframes out{to{opacity:0}}
.b{stroke-dasharray:1500;--d:0s;animation:draw .8s cubic-bezier(.65,0,.35,1) both}
.g{animation:out .3s ease-in both;--d:calc(var(--T) - .3s)}</style>
<g class="g"><rect class="b" x="8" y="8" width="504" height="184" rx="22" fill="none" stroke="{{color}}" stroke-width="8"/></g></svg>`,
    },
  },
  {
    name: "callout-arrow-label",
    title: "Callout — arrow and label",
    description: "A hand-drawn style arrow that sweeps in, with a label at its tail.",
    category: "callout",
    tags: ["tutorial", "explainer", "pointer"],
    aspects: ["16:9", "1:1"],
    fields: [textField("text", "Label", "New in v2"), colorField("color", "Colour", "#ffffff")],
    content: {
      kind: "html",
      animated: true,
      widthPx: 560,
      heightPx: 260,
      durationUs: 3 * S,
      transform: { x: 0.65, y: 0.35 },
      template: `<div style="width:560px;height:260px;position:relative;font-family:${FONT}"><style>${KEYFRAMES}
@keyframes draw{from{stroke-dashoffset:600}}.a{stroke-dasharray:600;animation:draw .7s ease-out both}</style>
${exit(`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="260" style="position:absolute;left:0;top:0;--d:0s">
<path class="a" d="M520 210 C 420 220, 300 170, 120 60" fill="none" stroke="{{color}}" stroke-width="8" stroke-linecap="round"/>
<path class="a" d="M120 60 L 150 110 M120 60 L 180 50" fill="none" stroke="{{color}}" stroke-width="8" stroke-linecap="round" style="--d:.5s"/></svg>
<div style="position:absolute;right:0;bottom:0;color:{{color}};font-weight:800;font-size:40px;text-shadow:0 3px 14px #000a;animation:mc-fade .4s ease-out both;--d:.4s">{{text}}</div>`, 0.3, "position:absolute;inset:0;")}</div>`,
    },
  },
  // ---------------------------------------------------------------- titles and intros
  {
    name: "intro-kinetic-headline",
    title: "Intro — kinetic headline",
    description: "An eyebrow line, then a headline that rises in, with a gradient second line. Full frame on a dark background.",
    category: "intro",
    tags: ["launch", "headline", "title", "opener"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [textField("eyebrow", "Eyebrow", "INTRODUCING"), textField("line1", "Headline", "Your product,"), textField("line2", "Second line", "in one minute."), colorField("from", "Gradient start", "#8b7bff"), colorField("to", "Gradient end", "#22d3ee"), colorField("bg", "Background", "#0a0d18")],
    content: {
      kind: "html",
      animated: true,
      durationUs: 4 * S,
      template: `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 9vmin;box-sizing:border-box;background:radial-gradient(70vmin 50vmin at 15% 20%,#2a1f6b 0%,transparent 70%),{{bg}};color:#fff;font-family:${FONT}"><style>${KEYFRAMES}</style>
<div style="font-weight:600;font-size:2.6vmin;letter-spacing:.32em;color:#a8b2cc;animation:mc-fade .6s ease-out both">{{eyebrow}}</div>
<div style="height:2.6vmin"></div>
<div style="font-weight:800;font-size:10vmin;line-height:1.08;letter-spacing:-.02em;animation:mc-rise .7s cubic-bezier(.2,.8,.2,1) both;--d:.2s">{{line1}}</div>
<div style="font-weight:800;font-size:10vmin;line-height:1.08;letter-spacing:-.02em;background:linear-gradient(90deg,{{from}},{{to}});-webkit-background-clip:text;background-clip:text;color:transparent;animation:mc-wipe 1s cubic-bezier(.65,0,.35,1) both;--d:.75s">{{line2}}</div></div>`,
    },
  },
  {
    name: "intro-logo-reveal",
    title: "Intro — brand reveal",
    description: "A brand name pops in centre-frame with a tagline underneath.",
    category: "intro",
    tags: ["brand", "logo", "opener"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [textField("brand", "Brand", "Acme"), textField("tagline", "Tagline", "Make it simple."), colorField("bg", "Background", "#0a0d18"), colorField("ink", "Text colour", "#ffffff")],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3 * S,
      template: `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:{{bg}};color:{{ink}};font-family:${FONT}"><style>${KEYFRAMES}</style>
<div style="font-weight:800;font-size:16vmin;letter-spacing:-.045em;animation:mc-pop .6s cubic-bezier(.2,.8,.2,1) both;--d:.1s">{{brand}}</div>
<div style="margin-top:1.6vmin;font-size:3.8vmin;font-weight:500;opacity:.75;animation:mc-fade .6s ease-out both;--d:.6s">{{tagline}}</div></div>`,
    },
  },
  {
    name: "title-chapter",
    title: "Title — chapter card",
    description: "A full-frame card announcing the next part: a step number and a title. Use between sections of a tutorial.",
    category: "title",
    tags: ["chapter", "section", "tutorial", "step"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [textField("kicker", "Kicker", "STEP 2"), textField("title", "Title", "Connect your data"), colorField("accent", "Accent", "#22d3ee"), colorField("bg", "Background", "#0f172a")],
    content: {
      kind: "html",
      animated: true,
      durationUs: 2.5 * S,
      template: `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 10vmin;box-sizing:border-box;background:{{bg}};color:#fff;font-family:${FONT}"><style>${KEYFRAMES}</style>
<div style="width:9vmin;height:1vmin;border-radius:1vmin;background:{{accent}};transform-origin:left;animation:mc-growx .5s cubic-bezier(.65,0,.35,1) both"></div>
<div style="margin-top:3vmin;font-weight:700;font-size:3vmin;letter-spacing:.28em;color:{{accent}};animation:mc-fade .5s ease-out both;--d:.2s">{{kicker}}</div>
<div style="margin-top:1.5vmin;font-weight:800;font-size:8vmin;line-height:1.1;letter-spacing:-.02em;animation:mc-rise .6s cubic-bezier(.2,.8,.2,1) both;--d:.3s">{{title}}</div></div>`,
    },
  },
  {
    name: "title-centered",
    title: "Title — centred over footage",
    description: "A large centred title with a soft shadow, for over footage or images. Transparent background.",
    category: "title",
    tags: ["title", "overlay", "headline"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [textField("text", "Title", "The Big Idea"), colorField("color", "Colour", "#ffffff")],
    content: {
      kind: "html",
      animated: true,
      durationUs: 3 * S,
      template: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:${FONT}"><style>${KEYFRAMES}</style>
${exit(`<div style="max-width:80vmax;text-align:center;font-weight:800;font-size:11vmin;line-height:1.05;letter-spacing:-.03em;color:{{color}};text-shadow:0 1vmin 4vmin #000b;--d:0s;animation:mc-rise .7s cubic-bezier(.2,.8,.2,1) both">{{text}}</div>`)}</div>`,
    },
  },
  {
    name: "outro-cta",
    title: "End card — call to action",
    description: "Brand, tagline and a pulsing URL button. Hold it at least 2.5 seconds.",
    category: "outro",
    tags: ["cta", "end card", "url", "brand"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [textField("brand", "Brand", "Acme"), textField("tagline", "Tagline", "Start free today"), textField("url", "URL", "acme.com"), colorField("bg", "Background", "#0a0d18")],
    content: {
      kind: "html",
      animated: true,
      durationUs: 4 * S,
      template: `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:{{bg}};color:#fff;font-family:${FONT}"><style>${KEYFRAMES}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 #22d3ee66}50%{box-shadow:0 0 0 2vmin #22d3ee00}}</style>
<div style="font-weight:800;font-size:15vmin;letter-spacing:-.045em;animation:mc-pop .55s cubic-bezier(.2,.8,.2,1) both;--d:.1s">{{brand}}</div>
<div style="margin-top:1.5vmin;font-size:3.9vmin;font-weight:500;color:#a8b2cc;animation:mc-fade .6s ease-out both;--d:.5s">{{tagline}}</div>
<div style="margin-top:6vmin;padding:2.4vmin 5vmin;border-radius:999px;background:#fff;color:#0a0d18;font-weight:700;font-size:3.7vmin;animation:mc-fade .5s ease-out both,pulse 1.6s ease-in-out 3 both;--d:.85s">{{url}}</div></div>`,
    },
  },
  // ---------------------------------------------------------------- cursor
  {
    name: "cursor-arrow",
    title: "Cursor — arrow",
    description: "A crisp pointer cursor. Keyframe its x/y (or let a cursor planner do it) to show where to click.",
    category: "cursor",
    tags: ["cursor", "pointer", "screen", "tutorial"],
    aspects: ["any"],
    fields: [colorField("fill", "Fill", "#ffffff"), colorField("stroke", "Outline", "#111111")],
    content: {
      kind: "html",
      widthPx: 64,
      heightPx: 64,
      durationUs: 5 * S,
      transform: { x: 0.5, y: 0.5 },
      template: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g transform="translate(32 32)"><path d="M0 0 L0 26 L7 19 L12 30 L17 28 L12 17 L22 17 Z" fill="{{fill}}" stroke="{{stroke}}" stroke-width="2.5" stroke-linejoin="round"/></g></svg>`,
    },
  },
  {
    name: "cursor-highlight",
    title: "Cursor — arrow with highlight",
    description: "A pointer with a soft coloured circle around its tip, so viewers always find it. Same hot spot as cursor-arrow (the block's centre).",
    category: "cursor",
    tags: ["cursor", "pointer", "highlight", "screen", "tutorial"],
    aspects: ["any"],
    fields: [colorField("fill", "Fill", "#ffffff"), colorField("stroke", "Outline", "#111111"), colorField("highlight", "Highlight", "#facc15")],
    content: {
      kind: "html",
      widthPx: 64,
      heightPx: 64,
      durationUs: 5 * S,
      transform: { x: 0.5, y: 0.5 },
      template: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="21" fill="{{highlight}}" fill-opacity="0.38"/><circle cx="32" cy="32" r="21" fill="none" stroke="{{highlight}}" stroke-opacity="0.7" stroke-width="1.5"/><g transform="translate(32 32)"><path d="M0 0 L0 26 L7 19 L12 30 L17 28 L12 17 L22 17 Z" fill="{{fill}}" stroke="{{stroke}}" stroke-width="2.5" stroke-linejoin="round"/></g></svg>`,
    },
  },
  {
    name: "cursor-hand",
    title: "Cursor — hand",
    description: "A pointing hand, fingertip on the hot spot (the block's centre), like the pointer over a link.",
    category: "cursor",
    tags: ["cursor", "pointer", "hand", "link", "screen", "tutorial"],
    aspects: ["any"],
    fields: [colorField("fill", "Fill", "#ffffff"), colorField("stroke", "Outline", "#111111")],
    content: {
      kind: "html",
      widthPx: 64,
      heightPx: 64,
      durationUs: 5 * S,
      transform: { x: 0.5, y: 0.5 },
      // The shapes are drawn twice: outlined and thick first, then filled on top, so they read as one hand.
      template: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g transform="translate(32 32)"><g fill="{{stroke}}" stroke="{{stroke}}" stroke-width="5" stroke-linejoin="round"><rect x="-3" y="0" width="6" height="18" rx="3"/><rect x="3" y="8" width="5.5" height="12" rx="2.75"/><rect x="8.5" y="9.5" width="5.5" height="11" rx="2.75"/><rect x="14" y="11.5" width="5" height="9" rx="2.5"/><rect x="-10" y="13" width="5" height="10" rx="2.5" transform="rotate(-38 -7.5 18)"/><rect x="-5" y="14" width="24" height="14" rx="6"/></g><g fill="{{fill}}"><rect x="-3" y="0" width="6" height="18" rx="3"/><rect x="3" y="8" width="5.5" height="12" rx="2.75"/><rect x="8.5" y="9.5" width="5.5" height="11" rx="2.75"/><rect x="14" y="11.5" width="5" height="9" rx="2.5"/><rect x="-10" y="13" width="5" height="10" rx="2.5" transform="rotate(-38 -7.5 18)"/><rect x="-5" y="14" width="24" height="14" rx="6"/></g></g></svg>`,
    },
  },
  {
    name: "cursor-halo",
    title: "Cursor — halo",
    description: "A soft coloured glow centred on the hot spot, with no pointer of its own: highlights a real pointer that's already in the video.",
    category: "cursor",
    tags: ["cursor", "highlight", "halo", "spotlight", "screen", "tutorial"],
    aspects: ["any"],
    fields: [colorField("highlight", "Colour", "#facc15")],
    content: {
      kind: "html",
      widthPx: 64,
      heightPx: 64,
      durationUs: 5 * S,
      transform: { x: 0.5, y: 0.5 },
      template: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><radialGradient id="g"><stop offset="0" stop-color="{{highlight}}" stop-opacity="0.55"/><stop offset="0.7" stop-color="{{highlight}}" stop-opacity="0.35"/><stop offset="1" stop-color="{{highlight}}" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#g)"/></svg>`,
    },
  },
  {
    name: "cursor-dot",
    title: "Cursor — dot",
    description: "A soft round dot, like a finger on a touch screen. Its centre is the hot spot.",
    category: "cursor",
    tags: ["cursor", "dot", "touch", "screen", "tutorial"],
    aspects: ["any"],
    fields: [colorField("highlight", "Colour", "#38bdf8")],
    content: {
      kind: "html",
      widthPx: 64,
      heightPx: 64,
      durationUs: 5 * S,
      transform: { x: 0.5, y: 0.5 },
      template: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="15" fill="{{highlight}}" fill-opacity="0.55" stroke="#ffffff" stroke-opacity="0.9" stroke-width="2.5"/></svg>`,
    },
  },
  {
    name: "cursor-ring",
    title: "Cursor — ring",
    description: "A ring with a small centre dot: a light, see-through pointer that marks the spot without hiding it.",
    category: "cursor",
    tags: ["cursor", "ring", "spotlight", "screen", "tutorial"],
    aspects: ["any"],
    fields: [colorField("highlight", "Colour", "#f43f5e")],
    content: {
      kind: "html",
      widthPx: 64,
      heightPx: 64,
      durationUs: 5 * S,
      transform: { x: 0.5, y: 0.5 },
      template: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="19" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="6"/><circle cx="32" cy="32" r="19" fill="none" stroke="{{highlight}}" stroke-width="3.5"/><circle cx="32" cy="32" r="3.5" fill="{{highlight}}" stroke="#ffffff" stroke-width="1.5"/></svg>`,
    },
  },
  {
    name: "cursor-click",
    title: "Cursor — click ripple",
    description: "An expanding ring that marks a click. Drop one at each click position for half a second.",
    category: "cursor",
    tags: ["click", "ripple", "screen", "tutorial"],
    aspects: ["any"],
    fields: [colorField("color", "Colour", "#38bdf8")],
    content: {
      kind: "html",
      animated: true,
      widthPx: 160,
      heightPx: 160,
      durationUs: 0.6 * S,
      transform: { x: 0.5, y: 0.5 },
      template: `<div style="width:160px;height:160px;display:flex;align-items:center;justify-content:center"><style>@keyframes ripple{0%{transform:scale(.2);opacity:.9}100%{transform:scale(1);opacity:0}}@keyframes dot{0%{transform:scale(1);opacity:.9}100%{transform:scale(.6);opacity:0}}</style>
<div style="position:absolute;width:140px;height:140px;border-radius:50%;border:6px solid {{color}};animation:ripple var(--T) cubic-bezier(.2,.8,.2,1) both"></div>
<div style="width:30px;height:30px;border-radius:50%;background:{{color}};animation:dot var(--T) ease-out both"></div></div>`,
    },
  },
  // ---------------------------------------------------------------- progress / background
  {
    name: "progress-bar",
    title: "Progress bar",
    description: "A thin bar along the top that fills over the clip's length. Span the whole video for stories and tutorials.",
    category: "progress",
    tags: ["progress", "stories", "tutorial"],
    aspects: ["16:9", "9:16", "1:1"],
    fields: [colorField("color", "Bar colour", "#ffffff"), colorField("track", "Track colour", "#ffffff33")],
    content: {
      kind: "html",
      animated: true,
      durationUs: 10 * S,
      template: `<div style="width:100%;height:100%;position:relative"><style>@keyframes fill{from{transform:scaleX(0)}}</style>
<div style="position:absolute;left:0;right:0;top:0;height:1.1vmin;background:{{track}}"><div style="height:100%;background:{{color}};transform-origin:left;animation:fill var(--T) linear both"></div></div></div>`,
    },
  },
  {
    name: "background-gradient",
    title: "Background — soft gradient",
    description: "Two soft colour glows on a dark base. Put it on the bottom track under titles and screenshots.",
    category: "background",
    tags: ["background", "gradient", "brand"],
    aspects: ["any"],
    fields: [colorField("base", "Base", "#0a0d18"), colorField("glow1", "Glow 1", "#2a1f6b"), colorField("glow2", "Glow 2", "#0e4a5c")],
    content: {
      kind: "html",
      durationUs: 10 * S,
      template: `<div style="width:100%;height:100%;background:radial-gradient(70vmax 50vmax at 15% 20%,{{glow1}} 0%,transparent 70%),radial-gradient(60vmax 45vmax at 90% 85%,{{glow2}} 0%,transparent 70%),{{base}}"></div>`,
    },
  },
  // ---------------------------------------------------------------- caption styles
  {
    name: "caption-bold-pop",
    title: "Captions — bold pop",
    description: "Big uppercase words, the active one enlarged in yellow with a heavy outline. The short-form social look.",
    category: "caption-style",
    tags: ["captions", "social", "reels", "tiktok"],
    aspects: ["9:16", "1:1", "16:9"],
    content: {
      kind: "caption-style",
      style: { preset: "pop", display: "block", fontFamily: "Inter, sans-serif", fontWeight: 900, fontSizeFrac: 0.075, textTransform: "uppercase", color: "#ffffff", highlightColor: "#ffd400", strokeColor: "#000000", strokeWidthFrac: 0.12 },
    },
  },
  {
    name: "caption-karaoke",
    title: "Captions — karaoke",
    description: "Every spoken word lights up and stays lit, on a soft shadow. Clear for music and podcasts.",
    category: "caption-style",
    tags: ["captions", "karaoke", "podcast", "music"],
    aspects: ["any"],
    content: {
      kind: "caption-style",
      style: { preset: "karaoke", fontFamily: "Inter, sans-serif", fontWeight: 800, fontSizeFrac: 0.06, color: "#ffffff99", highlightColor: "#ffffff", shadowColor: "#000000cc", shadowBlurFrac: 0.2, shadowOffsetFrac: 0.05 },
    },
  },
  {
    name: "caption-boxed",
    title: "Captions — boxed",
    description: "Calm sentence-case captions on a dark box, with the active word on a coloured highlight. Readable over any footage.",
    category: "caption-style",
    tags: ["captions", "accessible", "tutorial", "interview"],
    aspects: ["any"],
    content: {
      kind: "caption-style",
      style: { preset: "highlight", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSizeFrac: 0.052, color: "#ffffff", highlightColor: "#0a0d18", backgroundColor: "#000000b3", activeBackgroundColor: "#22d3ee" },
    },
  },
  {
    name: "caption-minimal",
    title: "Captions — minimal",
    description: "Plain white sentence-case captions with a light shadow: closest to broadcast subtitles.",
    category: "caption-style",
    tags: ["captions", "subtitles", "minimal"],
    aspects: ["any"],
    content: {
      kind: "caption-style",
      style: { preset: "plain", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSizeFrac: 0.048, color: "#ffffff", shadowColor: "#000000e6", shadowBlurFrac: 0.12, shadowOffsetFrac: 0.04 },
    },
  },
];
