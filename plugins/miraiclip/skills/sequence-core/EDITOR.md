---
name: sequence-core
description: The contract for compose_sequence acts — the stage kit API (tl, S, camera), positions, units, params, the hand-off between acts, and the rules every sequence must pass. Load it before writing your first act; load motion for the techniques.
---

# Sequence core

A motion-graphics film is a few **acts**. Each act is one `compose_sequence` call: one continuous animation on **one timeline**, 8–25 s long, with the beats marked as labels. Elements stay on screen and change from beat to beat, and the camera keeps moving. This file is the contract for what you write. The `motion` skill has the techniques.

## What you write

`compose_sequence` takes four things, and wraps them in the film's stage (colours, fonts, the root):

- **`markup`**: the act's elements.
  - Everything the camera sees goes inside `<div class="world">…</div>`.
  - Put a `<div class="hud">…</div>` beside it, not inside, for anything that must stay put while the camera moves (a caption bar, a small logo, a progress rail).
- **`css`**: the look of those elements.
- **`script`**: the body of `stage.build((tl, S) => { … })`. Write the body only, not the call.
- **`durationSeconds`**: the act's length. The timeline must end within it. End it on a slow drift (a camera move, a breathing accent), so the act is still moving at its last frame.

`params` (optional): `{{name}}` in the markup becomes an editable field in the editor, filled from `params`. Use it for the words people will want to change. Give each param a meaningful name (`headline`, `step2`, `cta`), not `a`, `b`, `c`. Values are inserted as text.

The stage gives you these CSS variables, from `plan_film`:

| Variable | What it is |
|---|---|
| `--bg` | Background |
| `--ink` | Text |
| `--mut` | Muted text |
| `--p` | The accent |
| `--s` | The second accent |
| `--card` | A card surface |
| `--line` | Hairlines |
| `--onp` | Text on the accent |

It also gives you two fonts: the body font on the root, and the display font on `.k-display`. Any other font family you name in the CSS is added to the project for you. Static helpers `k-fill` (fill the frame) and `k-cover` (a cover-fit picture) work. The animated `k-*` classes (`k-rise`, `k-pop`, `k-cam`, …) belong to `design_scene` and are refused here: in a sequence every move is on the timeline.

## The timeline: `tl`

All times are in **seconds**. Every method returns `tl`, so calls chain.

| Call | Does |
|---|---|
| `tl.to(targets, vars, position)` | Animate from the current state to `vars` |
| `tl.from(targets, vars, position)` | Animate from `vars` to the current (CSS) state: the usual entrance |
| `tl.fromTo(targets, fromVars, toVars, position)` | Both ends explicit |
| `tl.set(targets, vars, position)` | Change instantly at that time (a word swap, a caret jump, a hard cut) |
| `tl.label(name, position)` | Mark a beat. Define a label before you use it in a position |
| `tl.camera(vars, position)` | Move the camera (the `.world` layer). See below |

**Targets**: a CSS selector (`".card"`), an element, or a list of elements (`S.split(…)` returns one).

**Vars**:

- **Transform:** `x`, `y` (always through `S.w` / `S.h` / `S.min`), `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` (degrees).
- **Look:** `opacity`, `blur` (px, mapped to `filter: blur()`), `color`, `backgroundColor`, `borderRadius`, `width`, `height`, `clipPath` (strings like `"inset(0 100% 0 0)"`), CSS variables (`"--n": 10`).
- **Keyframes:** an array (`x: [0, S.w(10), 0]`).
- **Timing:** `duration` (default 0.6), `delay`, `ease`, and `stagger` (seconds between targets, or `{ each, from: "first" | "center" | "last" }`).

Any value can be a function `(i, el) => value`.

**Eases**:

| Ease | Use it for |
|---|---|
| `"expo.out"` | Arrivals |
| `"expo.in"` | Exits |
| `"power3.inOut"` / `"expo.inOut"` | Moving between places |
| `"back.out"` | Pops |
| `"elastic.out"` | Wobbly landings |
| `"sine.inOut"` | Drift |
| `"linear"` | Constant rates |
| `"steps(n)"` | Ticking, typing |

`power1`–`power4`, `circ`, `bounce` and anime.js names (`"out(3)"`) also work.

**Positions**:

| Position | Means |
|---|---|
| `2.4` | At that second |
| `"hook"` | At the label |
| `"hook+=0.3"` / `"hook-=0.2"` | Offset from the label |
| `"<"` | With the previous step |
| `">"` | After the previous step |
| `"<+=0.2"` | Shortly after the previous step starts |
| `"+=0.5"` | 0.5 s after everything so far |
| *(none)* | At the end of everything so far |

## The camera

`tl.camera({ x, y, zoom, rotate, tiltX, tiltY, duration, ease }, position)` moves `.world`:

- `zoom` is scale;
- `tiltX` / `tiltY` rotate it in depth, with perspective already set;
- the default is a 1.2 s `power2.inOut`-style ease.

Zoom pivots on `.world`'s transform origin (the centre). To push into a corner, first `tl.set(".world", { transformOrigin: "70% 30%" }, t)`. A camera move with `duration: 0.01` is an instant reset, which hides a cut.

## Continuous shot (version 2)

Put `data-stage-version="2"` on the stage root to turn on the operated camera and the carry verbs. Without it everything above behaves as before. With it, `tl.camera` keys a camera track that follow, handheld and shake add to (zoom is interpolated in log space, so 1 to 100 reads 10 halfway), and these calls exist. Times are seconds, sizes are stage pixels (use `S.*`), and every call returns `tl`.

**Carry one subject from beat to beat**

| Call | Does |
|---|---|
| `tl.morph(from, to, { duration, ease, content, radius }, position)` | The `from` element's box, radius and colour become `to`'s, and `to`'s content rises in over the last 40 %. The two hand over on the last frame with no swap. `from` must be `position: absolute` or `relative` |
| `tl.iris(target, { from, duration, ease, edge }, position)` | A circular clip opens from the centre of `from` until `target` covers the stage |
| `tl.zoomThrough(target, { fit: "cover" \| "contain", into, duration, ease }, position)` | Pushes the camera into `target` until it fills the frame. With `into` (an element outside `.world`), that scene takes over on the last frame and the camera resets |
| `tl.hop(target, { to, height, duration, squash }, position)` | An arc to another element's slot, landing with a squash |
| `tl.gather(targets, { into, arc, stagger, spin, duration }, position)` | Many elements fly on fanned arcs into one box |
| `tl.impact(target, position, { squash, duration })` | A squash and spring-back, and a hit |
| `tl.press(target, time)` | A pressed-button reaction, and a click hit |
| `tl.pointer({ path, clicks, look })` | A cursor that passes through every `{ t, x, y }` knot on a smooth path and dips on each click time. `S.pointerPath(log)` builds the path from a recorded click log |

Elements these verbs drive keep their own `transform` and `opacity` for the verb's duration: don't animate the same properties with `tl.to`. Ease `"spring(zeta, omega)"` (defaults 0.55, 14) is a damped spring that has settled by the end of the tween.

**Operate the camera**

| Call | Does |
|---|---|
| `tl.camera({ anchor, at: [x%, y%], zoom, duration, ease }, position)` | Keys the zoom in screen space: the anchor element stays at that screen position, at any zoom. Use it for every zoom above 50× |
| `tl.follow(target, { lead, from, to }, position)` | The camera keeps `target` near the centre, leading it by `lead` seconds (default 0.1) |
| `tl.whip(target, { duration }, position)` | A fast expo snap that lands with `target` centred |
| `tl.handheld({ amount }, from, to)` | A slow float, exactly zero outside its range and inside declared rests |
| `tl.shake(position, { amp, decay, seed })` | A deterministic hit shake in screen space (the same size at any zoom), recorded as a hit |

`data-depth="d"` on a child of `.world` gives parallax from the one camera (a layer moves 1 / (1 + d) as far as depth 0). `data-lod="minPx,maxPx"` fades an element in by its size on screen and drops it when it is off-frame.

**Say what the shot does**

| Call | Does |
|---|---|
| `tl.hit(name, position, { pan, kind })` | Marks a sound moment (`kind`: `impact`, `click`, `whoosh`, `land`, `shake`). Shakes, presses, impacts, pointer clicks and carry landings add their own |
| `tl.rest(from, to, { allow })` | Declares a dead-still stretch. Only elements in `allow` may move, and the camera layers are zero. The build fails, naming what moved, if anything else does |
| `tl.cut(position)` | Marks a deliberate hard cut |

The stage root reports `data-stage-carries`, `data-stage-events`, `data-stage-rests` and `data-stage-cuts` as JSON, for the checks and for placing sound.

**Check the shot**

Mark every beat with `tl.label(name, time)`: labels are the beats the check looks at. Put `data-keep-in-frame="t0,t1"` on a subject that must stay on screen (add `,whole` to also forbid it being cut off by the frame edge). Then run `check_sequence` (when the tool is offered). For each label it compares the frame 0.2 s before and after and reports the beat as **carried** (something survives and moves, scales, or the camera moves with it), **anchored** (something large stays put) or **bare** (nothing survives), with a hint naming what left and what arrived. It also warns about subjects that leave the frame, beats spaced too evenly, and hard cuts outside a burst of cuts. A bare beat is fixed by carrying an element across it (`tl.morph`, `tl.hop`, `tl.zoomThrough`, `tl.gather`). Beats at `tl.cut` times, bursts of three or more beats within 1.5 s, and the last 1.2 s are not scored. Warnings never block an export.

## The stage helpers: `S`

| Helper | Gives |
|---|---|
| `S.w(p)`, `S.h(p)`, `S.min(p)` | `p` percent of the stage's width, height or shorter side, in pixels. Use these for every x, y and size in the script |
| `S.width`, `S.height`, `S.portrait` | The stage size, and whether it is portrait |
| `S.split(target, "words" \| "chars")` | Wraps each word or character in a span (`.word` / `.char`). Returns them in reading order. Styled children (`<em>`) stay, with their words split inside |
| `S.rand(seed)` | A repeatable random function: `const r = S.rand(7); r()` gives 0–1, the same numbers on every render |
| `S.rect(el)`, `S.center(el)` | An element's resting box `{ x, y, w, h }` and centre `{ x, y }` in stage pixels (version 2) |
| `S.grid({ depth, spacing, dot })` | A faint dot lattice behind the scene that keeps its dot size at any zoom, so camera moves read on an empty ground (version 2) |
| `S.pointerPath(log)` | Turns a recorded click log `[{ t, x, y, type }]` into `{ path, clicks }` for `tl.pointer` (version 2) |
| `S.beats`, `S.beat(n)` | The music's beat grid in seconds, when the film has one (otherwise `S.beat(n)` is n × 0.5 s) |

## Rules (compose_sequence checks them)

Each rule protects one of two things: every frame must be the same however often and in whatever order it is rendered (preview, scrubbing, export), and the act must fit any frame size.

| Rule | Instead |
|---|---|
| `random`: no `Math.random()` | `S.rand(seed)` |
| `clock`: no `Date`, `performance.now()` | Timeline positions |
| `async-loop`: no `requestAnimationFrame`, `setTimeout`, `setInterval` | Put every change on the timeline. Frames are sought, never played |
| `network`: no `fetch`, `XMLHttpRequest`, `import()` | Pictures are `asset:ID` references |
| `infinite`: no `repeat: -1`, `loop: true` | Repeat a finite number of times within the act |
| `owned-hooks`: no `__timelines`, `__miraiclipSeek`… | `stage.build` only |
| `gsap`: GSAP isn't available | The `tl` API above |
| `units`: no `vw`, `vh`, `vmin` | `cqw`, `cqh`, `cqmin` in CSS; `S.w/h/min` in the script |
| `fixed`: no `position: fixed` | `position: absolute` inside the stage |
| `external-script`: no `<script src>` | Everything inline |
| `build`: `stage.build` exactly once | One timeline per act |
| `version`: continuous-shot verbs need `data-stage-version="2"` | Add it to the stage root |
| `carry-target`: a verb names an element the markup doesn't have | Add the element or fix the selector |
| `zoom-target`: `zoomThrough` target outside `.world` | Move it inside the world |
| `duration`, `libs` | compose_sequence sets these for you |

Warnings (fix them):

- `pixels`: a raw number over 40 for x, y, left, top, width or height won't fit another frame size. Use `S.*`.
- `zoom-anchor`: a zoom above 50× without an `anchor` drifts off its subject. Key it in screen space.
- `verb-transform`: a CSS `transform` on an element that `morph`, `hop`, `gather`, `impact` or `press` drives is replaced. Put it on a wrapper.
- `engine`: calling anime.js directly bypasses the kit's deterministic seeking. Use `tl`.
- `big-blur`: a large layer (30% of the frame or more) with `filter: blur()` can render with tile-shaped artifacts while the camera tilts. Make soft glows and colour blooms with a `radial-gradient(circle, <colour>, transparent 65%)` instead. Blur on small elements (an entrance focus-in, motion blur on a word) is fine.

The tool also runs the act once before placing it. A script error, or a timeline longer than the act, comes back as an error with the reason, and nothing is placed.

## Things that trip people up

- **The timeline owns `transform`** on every element it animates: a CSS `transform` on that element is replaced. Centre with a grid or flex wrapper, `inset` and margins, or put the CSS transform on a wrapper and animate the child.
- **`from` animates to the CSS state.** Write the CSS for where the element should *end up*, then `tl.from` its entrance.
- **Elements that appear later** start hidden with `tl.set(el, { opacity: 0 }, 0)`, or with a `from` at their beat. CSS `opacity: 0` with a later `to` also works. Nothing should flash at frame 0 by accident.
- **Colours** tween to real values (`"#ffcf5a"`, `"rgb(…)"`), not `var(--p)`. Read the plan's hex values.
- **Measuring** (`el.offsetWidth`, `getBoundingClientRect()`) is fine: the script runs after fonts load.
- **Keep the DOM fixed.** Create elements in the markup, or with `S.split`, before the timeline. Don't add or remove elements during it: use `opacity` and `tl.set`.

## Hand-off between acts

Acts join with a 0.3 s dissolve by default. Design the dissolve away:

- The next act's first frame starts where the last act's final frame ended: the same element, in the same place, at the same size.
- Then it moves on. The orb that became the logo at the end of act 1 is the logo at the start of act 2.
- Use `join: "cut"` when both sides hide the cut themselves (a blur-through or a whip on each side).
- Use `join: "dip"` only at a real chapter break.

## The loop

1. Write the act's beats (motion skill, `reference/timing.md`).
2. Compose it.
3. Look at the filmstrip compose_sequence returns, and read its problems:
   - layout at each beat;
   - a timeline that ends early;
   - too few beats;
   - a still camera.
4. Fix with `replace: "<act id>"`, which keeps the act's place and length.
5. Then compose the next act.

`preview_film` shows the whole film when every act is in.
