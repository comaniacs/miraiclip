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

## The stage helpers: `S`

| Helper | Gives |
|---|---|
| `S.w(p)`, `S.h(p)`, `S.min(p)` | `p` percent of the stage's width, height or shorter side, in pixels. Use these for every x, y and size in the script |
| `S.width`, `S.height`, `S.portrait` | The stage size, and whether it is portrait |
| `S.split(target, "words" \| "chars")` | Wraps each word or character in a span (`.word` / `.char`). Returns them in reading order. Styled children (`<em>`) stay, with their words split inside |
| `S.rand(seed)` | A repeatable random function: `const r = S.rand(7); r()` gives 0–1, the same numbers on every render |
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
| `duration`, `libs` | compose_sequence sets these for you |

Warnings (fix them):

- `pixels`: a raw number over 40 for x, y, left, top, width or height won't fit another frame size. Use `S.*`.
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
