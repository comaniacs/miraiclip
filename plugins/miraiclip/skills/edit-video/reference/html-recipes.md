# HTML clip recipes

Tested patterns for titles and motion graphics. All of them render the same in `preview_frame` and in export.

## Rules (the renderer is strict)

- The template is parsed as **XML**: close every tag (`<br/>`, `<img .../>`), quote attributes, write `&amp;`, and write `<` / `>` inside CSS as `&lt;` / `&gt;` (e.g. `@property` syntax `'&lt;integer&gt;'`).
- Inline `<svg>` needs `xmlns="http://www.w3.org/2000/svg"` or it draws nothing.
- No scripts, no network: images are `src="asset:<id>"`, fonts are font assets named by `family` in the CSS, anything else is a `data:` URI.
- Static clips (no `animated`) render once. Clips with `"animated": true` render every frame and play CSS `@keyframes`:
  - Delay elements with the custom property `--d` (e.g. `style="--d:.4s"`). Never set `animation-delay`; the renderer controls it.
  - Always use `animation-fill-mode: both` (the `both` keyword) so elements stay at their end state.
  - `--T` is the clip's length in seconds: `--d: calc(var(--T) - .5s)` starts an exit 0.5 s before the end. `--d` inherits, so give animated children their own.
  - CSS transitions don't play. Use keyframes.
  - Infinite animations work, but every animated clip costs a full render per frame. Prefer **one animated full-frame clip per scene** over many small animated clips, and make anything that doesn't move a static clip.
- Raster size: `widthPx` × `heightPx` (default: the composition size). Content outside it is cut off. For a full-frame scene, give the root element the composition's exact pixel size.
- In JSON, the template is a string: use single quotes inside CSS and double quotes for attributes (escaped as `\"`), or no quotes where CSS allows.

## Base kit

Put this `<style>` at the top of every scene so all scenes share one look. Change the palette variables per brand.

```html
<div class="root"><style>
*{box-sizing:border-box;margin:0}
.root{--bg:#0a0d18;--ink:#fff;--muted:#a8b2cc;--a1:#8b7bff;--a2:#22d3ee;--card:#121828;--line:#ffffff1c;
  width:1920px;height:1080px;position:relative;overflow:hidden;font-family:Inter,sans-serif;color:var(--ink)}
@keyframes rise{from{transform:translateY(48px);opacity:0;filter:blur(10px)}}
@keyframes fadein{from{opacity:0}}
@keyframes pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.06);opacity:1}100%{transform:scale(1)}}
@keyframes reveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes growx{from{transform:scaleX(0)}}
@keyframes out{to{opacity:0;transform:translateY(-24px)}}
.r{display:inline-block;animation:rise .7s cubic-bezier(.2,.8,.2,1) both}
.f{animation:fadein .6s ease-out both}
.p{display:inline-block;animation:pop .55s cubic-bezier(.2,.8,.2,1) both}
.grad{background:linear-gradient(90deg,var(--a1),var(--a2));-webkit-background-clip:text;background-clip:text;color:transparent}
.eyebrow{font-weight:600;font-size:26px;letter-spacing:.32em;color:var(--muted)}
.card{border-radius:28px;background:var(--card);border:1px solid var(--line);box-shadow:0 40px 120px #0008}
</style>
<!-- scene content -->
</div>
```

For 1080×1920, change the root size to `width:1080px;height:1920px`.

## Background (static, full frame, bottom track)

```html
<div style="width:1920px;height:1080px;background:radial-gradient(900px 600px at 15% 20%,#2a1f6b 0%,transparent 70%),radial-gradient(800px 600px at 90% 85%,#0e4a5c 0%,transparent 70%),#0a0d18"></div>
```

One clip spanning the whole video, then `mc animate --clip bg --loop kenburns` and optionally `effect/add` `grain` with `{ "intensity": 0.12 }`. The slow drift keeps static scenes alive.

## Kinetic headline (word by word)

```html
<div style="position:absolute;left:160px;top:360px">
  <div class="eyebrow f" style="--d:.05s">MIRAICLIP</div>
  <div style="height:28px"></div>
  <div style="font-weight:800;font-size:118px;line-height:1.08;letter-spacing:-.02em">
    <span class="r" style="--d:.20s">Build</span> <span class="r" style="--d:.32s">video</span> <span class="r" style="--d:.44s">editors,</span>
  </div>
  <div class="grad" style="font-weight:800;font-size:118px;line-height:1.08;letter-spacing:-.02em;animation:reveal 1s cubic-bezier(.65,0,.35,1) both;--d:1.05s">not video editor plumbing.</div>
</div>
```

Word spans need the space between them outside the spans. 0.12 s per word. A gradient line is revealed as a whole (`reveal`), not word by word, so the gradient stays continuous.

## Lower third (over footage)

Static raster, positioned with `transform`, animated with presets: `widthPx: 900, heightPx: 140, transform: { "x": 0.3, "y": 0.84 }`, then `mc animate --clip lt --in left --out fade --easing snappy`.

```html
<div style="display:flex;align-items:center;gap:22px;height:140px;padding:0 34px;border-radius:20px;background:#0a0d18e6;border:1px solid #ffffff22;font-family:Inter,sans-serif;color:#fff">
  <div style="width:8px;height:76px;border-radius:4px;background:linear-gradient(#8b7bff,#22d3ee)"></div>
  <div><div style="font:800 46px Inter,sans-serif">{{name}}</div><div style="font:500 30px Inter,sans-serif;color:#c3cbe0">{{role}}</div></div>
</div>
```

Put the text in `params` (`{ "name": "Ada Lovelace", "role": "Founder, Analytical Co." }`) so it can be changed with `clip/set-property` without touching the markup. Hold it on screen 4–6 s.

## Stat counters

```html
<style>
@property --n{syntax:'&lt;integer&gt;';inherits:false;initial-value:0}
@keyframes count{to{--n:var(--to)}}
.num{font-weight:800;font-size:150px;line-height:1;letter-spacing:-.04em;counter-reset:n var(--n);animation:count 1.4s cubic-bezier(.2,.8,.2,1) both}
.num::after{content:counter(n)}
</style>
<div class="card r" style="--d:.35s;width:507px;height:400px;padding:56px 48px">
  <div class="grad"><span class="num" style="--to:125;--d:.5s"></span><span style="font-size:64px;margin-left:6px">min</span></div>
  <div style="margin-top:28px;font-size:32px;line-height:1.35;color:var(--muted);font-weight:500">timeline with 4,464 clips</div>
</div>
```

Counters are integers. For decimals or thousands separators, count the integer part and write the rest as static text. Three cards in a row with 0.15 s stagger (`display:flex;gap:40px`) fill a 16:9 frame.

## Code card

```html
<style>.ln{font-family:'JetBrains Mono',Consolas,Menlo,monospace;font-size:28px;line-height:1.75;white-space:pre;color:#d7dcf0;animation:rise .5s cubic-bezier(.2,.8,.2,1) both}
.k{color:#8b7bff}.s{color:#5eead4}.c{color:#6b7591}</style>
<div class="card f" style="--d:.35s;position:absolute;left:900px;top:300px;width:860px;padding:44px 48px">
  <div class="ln" style="--d:.6s">project.<span class="k">dispatch</span>({</div>
  <div class="ln" style="--d:.75s">  type: <span class="s">"clip/add"</span>,</div>
  <div class="ln" style="--d:.9s">})</div>
</div>
```

Keep lines under ~45 characters at 28 px in an 860 px card, or the text runs out of the card. Check with `preview_frame`.

## Checklist / steps

```html
<style>.row{display:flex;align-items:center;gap:22px;margin-top:22px;padding:24px 30px;border-radius:20px;background:var(--card);border:1px solid var(--line);font-size:30px;animation:rise .5s cubic-bezier(.2,.8,.2,1) both}
.ok{width:44px;height:44px;border-radius:50%;background:var(--a2);color:#04121a;font-weight:900;font-size:26px;display:flex;align-items:center;justify-content:center}</style>
<div style="position:absolute;left:900px;top:260px;width:860px">
  <div class="row" style="--d:1.0s"><div class="ok">✓</div>Cut the pauses</div>
  <div class="row" style="--d:1.3s"><div class="ok">✓</div>Add captions</div>
</div>
```

0.3 s between rows so each can be read as it lands.

## Bar chart

```html
<style>@keyframes growy{from{transform:scaleY(0)}}
.bar{position:absolute;bottom:0;width:120px;border-radius:14px 14px 0 0;transform-origin:bottom;animation:growy .8s cubic-bezier(.2,.8,.2,1) both}</style>
<div style="position:absolute;left:300px;top:300px;width:1320px;height:560px;border-bottom:2px solid #ffffff33">
  <div class="bar" style="left:80px;height:180px;background:#ffffff33;--d:.3s"></div>
  <div class="bar" style="left:320px;height:290px;background:#ffffff33;--d:.45s"></div>
  <div class="bar" style="left:560px;height:520px;background:linear-gradient(#8b7bff,#22d3ee);--d:.6s"></div>
</div>
```

Highlight the bar the story is about; mute the rest. Label values above bars with a `.f` text that fades in after its bar.

## Line drawing (SVG)

```html
<style>@keyframes draw{from{stroke-dashoffset:1200}}.path{stroke-dasharray:1200;animation:draw 1.4s ease-out both}</style>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" style="position:absolute;left:360px;top:420px">
  <path class="path" d="M10 380 L300 250 L600 300 L1190 20" fill="none" stroke="#22d3ee" stroke-width="10" stroke-linecap="round"/>
</svg>
```

`stroke-dasharray` must be at least the path's length.

## Screenshot in a browser frame

Register the screenshot as an image asset (`id: "shot"`), then:

```html
<div class="card r" style="--d:.2s;position:absolute;left:260px;top:170px;width:1400px;overflow:hidden">
  <div style="height:52px;display:flex;align-items:center;gap:10px;padding:0 22px;background:#1a2033">
    <span style="width:14px;height:14px;border-radius:50%;background:#ff5f57"></span><span style="width:14px;height:14px;border-radius:50%;background:#febc2e"></span><span style="width:14px;height:14px;border-radius:50%;background:#28c840"></span>
    <span style="margin-left:24px;font-size:22px;color:#8c95ad">{{url}}</span>
  </div>
  <img src="asset:shot" style="display:block;width:1400px;height:788px;object-fit:cover;object-position:top"/>
</div>
```

For a slow scroll through a tall screenshot, animate `object-position` from `top` to `bottom` over the scene, or put the screenshot in its own image clip and keyframe `y`.

## Scrim behind text over footage

A static full-width HTML clip on the track under the text: `heightPx: 420, transform: { "y": 0.81 }`:

```html
<div style="width:1920px;height:420px;background:linear-gradient(transparent,#000000cc)"></div>
```

## Call to action / end card

```html
<style>@keyframes pulse{0%,100%{box-shadow:0 0 0 0 #22d3ee66}50%{box-shadow:0 0 0 22px #22d3ee00}}
.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.cta{margin-top:70px;padding:26px 54px;border-radius:999px;background:#fff;color:#0a0d18;font-weight:700;font-size:40px;animation:pulse 1.6s ease-in-out 3 both}</style>
<div class="c">
  <div class="p" style="--d:.1s;font-weight:800;font-size:180px;letter-spacing:-.045em">{{brand}}</div>
  <div class="f" style="--d:.55s;margin-top:18px;font-size:42px;color:var(--muted);font-weight:500">{{tagline}}</div>
  <div class="f" style="--d:.9s"><div class="cta" style="--d:1.3s">{{url}}</div></div>
</div>
```

The pulse runs a fixed number of times (`3`) so the card ends still. Hold the end card ≥ 2.5 s.

## Progress bar (9:16 stories, tutorials)

An animated clip on the top track spanning the whole video: `"animated": true, "widthPx": 1080, "heightPx": 12, "transform": { "y": 0.006 }`.

```html
<div style="width:1080px;height:12px;background:#ffffff26"><style>@keyframes growx{from{transform:scaleX(0)}}</style><div style="height:12px;background:#fff;transform-origin:left;animation:growx var(--T) linear both"></div></div>
```

`var(--T)` makes the bar exactly as long as the clip.

## Beat-synced, playful style

Tested in the "funky launch" gallery sample. Pick the music's BPM first; then one beat = `60 / BPM` s, one bar = 4 beats. Give every scene a whole number of bars and write every `--d` in beats (`--d: calc(<beats> * <beat>s)`, or compute it when you generate the template). Hard cuts on bar lines feel energetic; save dissolves for calm videos.

| Pattern | CSS |
| --- | --- |
| Colour flash per beat | `.flash{position:absolute;inset:0;animation:flash <4 beats>s step-end both}` with `@keyframes flash{0%{background:#2fd3b9}25%{background:#ff6f5e}50%{background:#ffb423}75%{background:#39a7ff}}` |
| Sticker look | `border:4px solid #0c1010;box-shadow:8px 9px 0 #0c1010;border-radius:22px` (hard offset shadow, no blur) |
| Boing in (overshoot) | `@keyframes boing{0%{transform:scale(0) rotate(-12deg)}60%{transform:scale(1.12) rotate(3deg)}80%{transform:scale(.96)}100%{transform:scale(1)}}` .6s |
| Slam a word | `@keyframes slam{0%{transform:scale(2.4);opacity:0;filter:blur(18px)}55%{transform:scale(.94);opacity:1;filter:blur(0)}100%{transform:scale(1)}}` .45s, one word or letter per beat |
| Retro offset shadow | `text-shadow:10px 10px 0 #ff6f5e,20px 20px 0 #39a7ff` |
| Bounce on every beat | `animation:bob <beat>s cubic-bezier(.3,0,.3,1) infinite both` with a squash/stretch keyframe |
| Sunburst | `repeating-conic-gradient(#ffffff22 0 8deg,transparent 8deg 22deg)` on a 2400 px square, slowly rotated |
| Fly in from the right | `@keyframes fromright{0%{transform:translateX(120%) skewX(-12deg)}70%{transform:translateX(-4%) skewX(3deg)}100%{transform:none}}` |

### Typewriter

```html
<style>@keyframes type{from{width:0}to{width:calc(var(--n) * 1ch)}}
.tw{display:inline-block;overflow:hidden;white-space:nowrap;vertical-align:bottom}</style>
<span class="tw" style="--d:.5s;--n:43;animation:type 2.5s steps(43) both">make a funky launch video for miraiclip.com</span>
```

Monospace font only, `--n` = character count, and **no `letter-spacing`** (it makes the text wider than `n × 1ch` and the end gets cut off).

### One element after another in the same spot

Show item *i* from its start beat and hide it at the next one with two nested wrappers (one animation each, because `--d` sets the delay for every animation on an element):

```html
<style>@keyframes on{from{opacity:0}to{opacity:1}}@keyframes off{from{opacity:1}to{opacity:0}}
.show{animation:on .01s step-end both}.hide{animation:off .01s step-end both}</style>
<div class="hide" style="--d:2.22s;position:absolute;inset:0"><div class="show" style="--d:1.11s;position:absolute;inset:0">…item 2…</div></div>
```

### Screenshot montage

For one screenshot per beat, use **image clips** on their own track (one clip per beat, hard cuts, a small `scale` keyframe bump 0.8 → 0.74 over 180 ms, `roundedCorners`), not images inside an animated HTML clip: an animated HTML clip re-inlines every image on every frame. Put titles and labels in one HTML overlay clip above them.
