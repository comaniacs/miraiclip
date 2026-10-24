# Scene patterns

Patterns proven in the first five templates (launch film, product tour, AI agent demo, metrics reel, testimonial wall). Each one renders the same in the studio preview and in export, in all four themes. Snippets assume the kit's `BASE` CSS, so `lift`, `clear`, `popIn`, `reveal`, `grow`, `spin`, `gone`, `--spring`, `--bounce`, `--out` and `--move` exist.

Contents:
- Timing: start times, nesting, show-then-hide, staggers
- Type: hook, typing, streaming lines, highlighter, wipe-down quote, stamp
- Numbers and data: counter, line chart, ranked bars, goal ring, star fill, mini sparklines
- UI: product window with a screenshot, spotlight, hotspots, spinner to check, workflow, phone tap and sheet, command palette
- People and proof: avatar from a name, quote card wall, marquee rows, ticker
- Endings: end card

## Timing

**Start times.** `style="--d:.4s"` is when an element's animations start, measured from the scene's start. Children inherit it unless they set their own. Every animation on one element shares it.

**Different times on one thing: nest.**

```html
<!-- fades in at .9 s, fades out at 2.05 s -->
<div class="cap" style="--d:.9s"><div style="--d:2.05s">Caption</div></div>
```
```css
.cap{animation:fadein .3s ease-out both}
.cap>div{animation:fadeout .25s ease-in both}
```

**Staggers.** Generate them in JS so they stay even: ``${[1,2,3].map((i)=>`<div class="card" style="--d:${(0.3+(i-1)*0.14).toFixed(2)}s">…</div>`).join("")}``. Use 0.12–0.14 s for cards and rows, 0.45–0.5 s for steps that should be read one at a time.

**Syncing to a linear reveal.** If a line draws from `d0` over `D` seconds with `linear`, point i of n (0-based) is reached at `d0 + D·i/(n−1)`. Pop each dot then.

## Type

**Hook** (every template): the eyebrow tracks in, line 1 rises, and line 2 (accent) wipes on and keeps shimmering.

```css
@keyframes track{from{letter-spacing:.9em;opacity:0;filter:blur(6px)}}
.eyebrow{animation:track 1.1s var(--out) both}
.l2{display:inline-block;animation:reveal .9s cubic-bezier(.65,0,.35,1) both,shimmer 3.2s linear infinite}
```
```html
<div class="eyebrow" style="--d:.05s">{{brand}}</div>
<div class="h1 disp r" style="--d:.15s">{{hook1}}</div><div class="h1 disp grad l2" style="--d:.6s">{{hook2}}</div>
```

**Typing** (editable text, any length up to the cap): `.typed` animates `max-width` with `steps()`. Shorten it per line with `animation-duration`, and follow it with `<span class="caret"></span>`.

**Streaming lines** (an answer arriving): each line is `display:table` with `animation:reveal .8s steps(24,end) both`, staggered by about 0.35 s.

**Highlighter across wrapped lines:**

```css
@keyframes mark{from{background-size:0% 100%}to{background-size:100% 100%}}
.mk{background:linear-gradient(color-mix(in srgb,{{secondary}} 34%,transparent),color-mix(in srgb,{{secondary}} 34%,transparent)) no-repeat 0 85%/0% 100%;
  -webkit-box-decoration-break:clone;box-decoration-break:clone;animation:mark 1.2s cubic-bezier(.65,0,.35,1) both}
```

**Wipe-down quote** (line by line, stepped): `@keyframes wipeDown{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}` with `steps(4,end)`, where 4 is about the number of lines.

**Stamp slam:** `@keyframes slam{from{transform:rotate(-8deg) scale(2.4);opacity:0}}` with `cubic-bezier(.5,0,.75,0)` (accelerating into the hit), on an element whose resting transform is `rotate(-8deg)`, with a `var(--shade)` background so it reads over anything.

## Numbers and data

**Counter** (whole numbers up to 4 digits):

```css
@property --n{syntax:'&lt;integer&gt;';inherits:false;initial-value:0}
@keyframes count{from{--n:0}to{--n:var(--to)}}
.num{counter-reset:n var(--n);animation:count 1.6s var(--out) both}
.num::after{content:counter(n)}
```
```html
<span class="pre">{{heroPre}}</span><span class="num" style="--to:{{heroNum}};--d:.2s"></span><span class="unit">{{heroUnit}}</span>
```

Keep symbols in their own fields (`$`, `K`, `%`). Field pattern: `^[0-9]{1,4}$`. Inside `.grad`, put any blur on the `.grad` wrapper, never on `.num`.

**Line chart from field values:**

```html
<div class="plot">  <!-- position:relative; a fixed height -->
 <div class="draw" style="--d:.7s"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 100" preserveAspectRatio="none">
  <g transform="translate(0 100) scale(1 -1)">
   <path d="M0 0 L0 {{p1}} L100 {{p2}} … L500 {{p6}} L500 0 Z" fill="url(#cg)"/>
   <path d="M0 {{p1}} L100 {{p2}} … L500 {{p6}}" fill="none" stroke="{{primary}}" stroke-width="6" vector-effect="non-scaling-stroke"/>
  </g></svg></div>
 <div class="dot" style="left:0%;bottom:calc({{p1}} * 1%)"><i style="--d:.7s"></i></div> …
</div>
```

- Flipping the y axis makes each field (0–100) a height directly.
- `preserveAspectRatio="none"` plus `non-scaling-stroke` keeps the line crisp at any shape.
- Draw it on with a `reveal` on the wrapper (`linear`), not `stroke-dashoffset`, which non-scaling strokes break. A 2 px scan line can travel with it: `@keyframes scan{from{left:0}to{left:100%}}`, same timing.
- Dots and tooltips are HTML placed with `bottom:calc({{pN}} * 1%)`.

**Ranked bars, scaled to the largest** (pure CSS):

```html
<div class="fill" style="width:calc({{b1v}} / max({{b1v}},{{b2v}},{{b3v}},{{b4v}},{{b5v}}) * 82%);--d:.55s"></div>
```

Animate with `@keyframes wgrow{from{width:0}}`, and put the value right after the bar in the same flex row so it rides along. The leader gets the gradient.

**Goal ring that laps past 100 %:**

```css
@property --a{syntax:'&lt;number&gt;';inherits:false;initial-value:0}
@keyframes ring{from{--a:0}to{--a:var(--to)}}
.rg{position:absolute;inset:0;border-radius:50%;mask:radial-gradient(farthest-side,transparent calc(100% - 50px),#000 calc(100% - 49px));animation:ring 1.9s cubic-bezier(.45,0,.2,1) both}
.r1{background:conic-gradient({{primary}} calc(min(var(--a),100) * 3.6deg),color-mix(in srgb,var(--ink) 10%,transparent) 0)}
.r2{inset:64px;background:conic-gradient({{secondary}} calc(max(var(--a) - 100,0) * 3.6deg),transparent 0)}
```

Give the number in the middle the same duration and easing. On paper and pop, set the ring on its own card (`.gw::before` with `var(--surface)`, `var(--border)`, `var(--shadow)`).

**Star fill from a rating field** (`4.9`): `style="--r:{{rating}}"` on a wrapper. Two rows of ★★★★★ are stacked; the top one is `width:calc(var(--r) / 5 * 100%);overflow:hidden;white-space:nowrap`, and grows from `width:0`.

**Mini sparklines** (decoration, not data): an SVG polyline in `viewBox="0 0 100 30"` with `preserveAspectRatio="none"`, an area polygon under it, and a `reveal` 0.5 s after its tile lands.

## UI

**Product window with a screenshot field:**
- a frame with a 44 px bar of three dots;
- `<img src="asset:shot" alt=""/>` at a fixed size with `object-fit:cover`;
- `var(--surface)`, `var(--border)`, `var(--shadow)`.

Write the coordinates of the areas you point at in the image's own pixel space, plus the bar offset. For the 9:16 window, scale them by its width ratio (for example, 0.762 for 960 / 1260).

**Spotlight gliding between areas:** one element inside the window's `overflow:hidden`. `box-shadow:0 0 0 2400px #000000a6` dims everything else, and `outline:4px solid {{secondary}}` marks the edge. Animate `left/top/width/height` through keyframe stops (hold, move, hold), `cubic-bezier(.65,0,.35,1)`, and show one caption per stop with show-then-hide.

**Hotspots:** a zero-size `.pin` at the point holds a numbered dot (`popIn` with `--bounce`), a ping ring (`@keyframes ping{from{transform:scale(.6);opacity:.8}to{transform:scale(2.6);opacity:0}}`, infinite) and a label that `reveal`s out of it. Flip a label to the left near the right edge.

**Spinner to check:**

```html
<div class="st"><div class="sw" style="--d:1.05s"><div class="ring" style="--d:0s"></div></div><div class="ok" style="--d:1.05s">✓</div></div>
```
```css
.sw{position:absolute;inset:0;animation:gone .18s ease-in both}
.ring{position:absolute;inset:4px;border-radius:50%;border:4px solid color-mix(in srgb,var(--ink) 18%,transparent);border-top-color:{{secondary}};animation:spin .7s linear infinite}
.ok{position:absolute;inset:0;border-radius:50%;background:{{secondary}};animation:popIn .7s var(--spring) both,clear .3s var(--out) both}
```

**Workflow run:**
- node cards land in a wave;
- the wires between them `grow` from the left as each node lights (`@keyframes lit{to{border-color:{{primary}};box-shadow:…}}` on an inset overlay);
- a check pops on each node;
- a result chip closes it.

In 9:16 the flow becomes a column, and the wires use `growY` with `transform-origin:center top`.

**Phone:** a 420×860 frame with 64 px corners and a notch. A finger dot fades in, a tap ripple runs (`@keyframes tap{0%{transform:scale(.3);opacity:.9}100%{transform:scale(2.2);opacity:0}}`), then a sheet slides up (`@keyframes sheet{from{transform:translateY(100%)}}` with the spring) and a check pops on it.

**Command palette:** the room dims (`@keyframes dim{to{background:var(--shade)}}`), the palette opens with a scale and fade, the query is typed, and a row gets picked (a background pulse), then the palette closes and a toast pops.

## People and proof

**Avatar from a name** (no image, and it follows edits):

```css
.av{width:64px;height:64px;border-radius:50%;overflow:hidden;font-size:0;line-height:64px;text-align:center;white-space:nowrap;
  color:#fff;background:linear-gradient(135deg,{{primary}},{{secondary}});font-family:var(--display);font-weight:var(--dw)}
.av::first-letter{font-size:30px}
```
```html
<span class="av">{{name}}</span>
```

The same trick at 440 px makes a portrait card with a big initial.

**Quote card wall:**
- four columns of six cards, each column moving 420 px over the scene, alternating `up` and `down` (one column at a different speed);
- the wall tipped back with `transform:perspective(2400px) rotateX(14deg)` on the wall element itself;
- the top and bottom faded with `mask:linear-gradient(transparent,#000 14%,#000 80%,transparent)`.

In 9:16, hide two columns.

**Marquee rows:** two rows of pills translating in opposite directions (`translateX(0 → −640px)` and back) over the scene, with the edges faded by a horizontal mask. Repeat the items so a row never runs out.

**Ticker:** one strip at the bottom of the hook, `translateX(0 → −50%)` linear over about twice the scene length, with its content written twice. Fill it with the template's own numbers (other fields), so it previews what's coming.

## Endings

**End card** (in the starter):
- a radial glow blooms;
- the wordmark comes into focus;
- a gradient dot drops with `--bounce`;
- the tagline rises;
- the button pings three times (`@keyframes pulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.35,1.8);opacity:0}}`).

The end card has `last: true`, so it doesn't exit.
