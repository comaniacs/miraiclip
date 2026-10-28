# Carry types

A continuous shot is a chain of beats where something from each beat becomes the next. Pick the carry for each boundary from this list, say which one in the beat sheet, and build it with the verbs named. `check_sequence` confirms it landed: the boundary must read **carried** (or **anchored** for a held ground).

All verbs need `data-stage-version="2"`. Sizes are in `S.*` units so every aspect ratio works.

## 1. Same element, new job

One element stays on screen and becomes something else: a dot becomes a button, a button becomes a card.
Verbs: `tl.morph(from, to)` (box, radius and colour become the target's; content rises in), `tl.hop(target, { to })` for an arc to a new slot.
Example: a seed-shaped dot on a dark ground morphs into a rounded search field; the placeholder text rises as it settles.

## 2. Scale

The camera falls into a detail and the detail is the next world. What was a full stop is a planet; what was a window is a room.
Verbs: `tl.camera({ anchor, at, zoom })` for a deep zoom that keeps the anchor fixed on screen, `tl.zoomThrough(target, { into })` to hand over to an inner scene on a frame where only the target's surface is visible.
Example: push into the dot of an "i" until its surface fills the frame, and the next scene is lit from inside it.

## 3. Cause

A hit or press causes the next beat: the click that sends the message, the drop that breaks the surface.
Verbs: `tl.press(target, t)`, `tl.impact(target, pos)`, `tl.shake(pos)`, `tl.hit(name, pos)`. The effect of the cause (ripple, iris, scatter) starts on the same frame as the hit.
Example: a cursor presses "Send"; the button squashes, the screen shakes once, and the iris that opens from the button reveals the reply.

## 4. Container

Many small things gather into one box, which is the next beat's subject.
Verbs: `tl.gather(targets, { into })`, then `tl.morph` or `tl.hop` to move the container on.
Example: ten scattered receipts fly on fanned arcs into one folder; the folder is the card that comes forward.

## 5. Persistent ground

The ground stays and the cast changes. A dot grid, a horizon or a paper texture is always on screen and the camera travels across it, so the eye never loses its place. This reads **anchored** when nothing else survives.
Verbs: `S.grid({ depth, spacing, dot })`, `data-depth` parallax layers, `tl.follow(target)`.
Example: a lattice of dots stays under every beat; a bright dot rolls through it and the camera follows.

## 6. Split that collapses

One element breaks into parts that act separately, then the parts rejoin as a different whole.
Verbs: `tl.gather` in reverse reads as the collapse; for the split, `tl.hop` each part to its own slot with a short stagger. Hide the original at the instant of the split.
Example: a headline splits into words that hop to the corners of a diagram, then fold back into the product name.

## 7. Material state

An element changes state: solid to liquid, flat to deep, light to dark. The shape or position stays, the surface changes.
Verbs: `tl.morph` with `radius` and colour, `tl.iris` for a lighting change that spreads from a point, `data-lod` to fade detail in as the camera nears.
Example: a flat white card sharpens into a screen glowing from within, as an iris of dark opens from its centre.

## 8. The subject as the pointer

The subject (a cursor, a ball, a finger) leads the eye, and the camera and the next beat are where it points or lands.
Verbs: `tl.pointer({ path, clicks })`, `tl.follow(target, { lead })`, `tl.whip(target)`.
Example: a cursor slides to a toggle, clicks, and the whip pan lands on the panel it opened.

## Choosing

- Every boundary needs one. If you can't name which, the beat is a cut: either redesign it or declare `tl.cut` and treat it as a deliberate hard cut.
- Don't use the same carry on more than two boundaries in a row; the shot starts to feel like a formula.
- Pair a carry with a sound moment (`tl.hit`): the landing is where the picture and the sound agree.
- A rest (`tl.rest`) is not a carry; it is a pause between two carries, and it must be declared.
