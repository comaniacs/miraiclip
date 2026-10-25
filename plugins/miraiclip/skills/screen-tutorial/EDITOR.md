---
name: screen-tutorial
description: Turn a screen recording in the editor into a tutorial or product walkthrough - chapters per step, zooms onto the action, sped-up waiting, held frames, blurred private data, step callouts. Use when the project holds a screen recording and the user wants a how-to, demo or walkthrough.
---

# Screen tutorial

Load `edit-video` first if you haven't. A tutorial guides the eye: zoom to where the action is, cut or speed up dead time, hold a frame when something needs reading, and hide anything private.

You can't see the recording. The step times and the places on screen come from the user ("at 0:12 they click Save, top right"), from markers or a recording log already in the project, or from a transcript of the narration. If you have none of these, ask the user for the steps (time, what happens, where on screen) before editing.

## 1. Structure

- One `marker/add` per step: `durationUs` for the step's span, `data: { "kind": "step", "n": 1 }`, a 2–5 word `label`. Markers become chapters.
- The recording sits on its own track at `scale: 1`, in the recording's shape.

## 2. Pace

- **Dead time** (loading, long typing, waiting): `clip/split` around it and `clip/set-speed` the middle 2–4× with `ripple: true`. Over 4× looks broken: cut instead.
- **Hold a frame** when the viewer must read something: `clip/freeze` for 1–2 s.
- **Cut** mistakes and repeats (split, remove, `close_gaps`).
- Aim for one step every 4–10 s of finished video.

## 3. Zoom to the action

`set_keyframes` on the recording's `scale`, `x`, `y`. For a target box centred at `(cx, cy)` (fractions of the frame) at zoom `z`:

- `scale = z`, `x = 0.5 + (0.5 − cx) × z`, `y = 0.5 + (0.5 − cy) × z`
- clamp so the frame stays filled: `x` and `y` within `[1 − z/2, z/2]`

Zoom in over 0.4–0.6 s with easeInOut, stay while the step happens, zoom out before jumping to a distant part of the screen. `z` 1.5–2.5. Zoom when the target is small, not on every click.

## 4. Privacy and focus

- **Blur private data** the user points out (emails, keys, names): `effect/add` `pixelate` (or `blur` 0.03) with `region: { x, y, width, height }` as fractions of the clip's frame; it follows your zooms. If it moves, keyframe it with `effect/set-region-keyframe`. If you were told about private data but not where it is, ask.
- **Spotlight** a control: `effect/add` `colorAdjust` `{ brightness: -0.45 }` with `region: { …, shape: "ellipse", feather: 0.5, invert: true }` for the step's span.

## 5. Callouts and titles

- Step labels: a small pill or lower third near (not over) the target, 2–5 words, one on screen at a time (`reference/html-recipes.md`).
- **An intro (≤ 3–4 s) and an end card** (the result or next step). When `compose_sequence` is available, make each one a short act in the product's look (`get_brand` if it's a product), using one technique from the `motion` skill:
  - the title types in (typewriter), then the three things you'll learn swap in place (swap-in-place);
  - or the product's own UI card pushes in (zoom-through) and hands off to the recording's first frame.

  Use `plan_film` (format `explainer`, the brand's look) before it, so the act gets the colours and fonts. Without `compose_sequence`, use an html title (`reference/html-recipes.md` in `edit-video`).
- Captions from the narration if there are words (`captions`), clear of the callouts.

## 6. Check and hand off

From the state: zoom values within the clamp, every step's label on screen during its action, sped-up parts ≤ 4×, nothing private left without a region. Reply with the steps one line each (so the user can paste them into a help article) and ask them to check every frame where private data appears.
