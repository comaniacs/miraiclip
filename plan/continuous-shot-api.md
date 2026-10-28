# Continuous shot: stage kit API (draft for approval)

Status: draft, awaiting approval (checklist item P0.8). No kit code is written against this until it is approved. After approval this becomes the "Continuous shot" section of `creative/sequences.mdx` (P1.31), and the implemented signatures are checked against it.

## Conventions

- Everything below needs `data-stage-version="2"` on the `.stage` root. Without it the kit behaves exactly as today (guarded by `test/browser/legacy.browser.ts`). Using a version-2 verb without the attribute is a `lintSequence` error and a runtime `data-stage-error`.
- Times are seconds. `pos` is the existing position syntax (number, label, `"label+=0.3"`, `"<"`, `">"`).
- Sizes are stage pixels at the current frame size; use `S.w/h/min` for percentages so a sequence re-lays itself out at any aspect ratio.
- `target` is a CSS selector, an element or an array of elements. `from`/`to`/`into` are selectors or elements and must match exactly one element.
- Every verb measures elements after fonts load, with the camera at rest, and is a pure function of the timeline (seeking the same time twice gives the same styles).
- Every verb returns `tl` so calls chain.
- Error messages follow one shape: `verb(): <what is wrong> "<selector>". <how to fix>`.

## Carry verbs

### `tl.morph(from, to, vars?, pos?)`
The `from` element's box (left, top, width, height, border-radius, background colour) animates to the measured box of `to`. `to`'s content rises in over the last 40 % of the move. On the end frame `from` hands over to `to` with no visible swap (no frame shows both fully opaque).

| var | default | meaning |
| --- | --- | --- |
| `duration` | `0.9` | seconds |
| `ease` | `"inOut(3)"` | any kit ease |
| `content` | `"rise"` | `"rise"` fades `to`'s children in over the last 40 %; `"none"` leaves them alone |
| `radius` | `true` | animate border-radius between the two |

Records a carry `from → to` (see Events).

### `tl.iris(target, { from, duration?, ease?, edge? })`
A circular clip on `target` opens from the centre of `from` until it covers the stage. Radius 0 at the start; the end radius reaches the farthest corner.
Defaults: `duration 0.9`, `ease "inOut(3)"`, `edge 0` (px of soft edge).

### `tl.zoomThrough(target, { fit?, into?, duration?, ease? })`
Sets the camera origin on `target` and pushes in (log space) until it fills the frame. `fit`: `"cover"` (default) or `"contain"`. With `into` (a selector of an inner scene), the inner scene takes over on a frame where only the target's surface is visible, and the camera resets there. Defaults: `duration 1.2`, `ease "inOut(3)"`. `target` must be inside `.world`.

### `tl.hop(target, { to, height?, duration?, squash? })`
An arc from the element to another slot, landing with a squash. `height` defaults to 18 % of the stage height, `duration 0.7`, `squash 0.18` (scaleY dips to `1 − squash` on landing). The highest point is at mid-duration; the end centre equals `to`'s centre.

### `tl.gather(targets, { into, arc?, stagger?, spin?, duration? })`
Many elements travel on fanned arcs into one box. `arc 0.25` (sideways bow as a fraction of distance, alternating sides), `stagger 0.06`, `spin 0` (degrees), `duration 0.8`. Every target ends inside `into`'s box.

### Ease `"spring(zeta, omega)"` and `tl.impact(target, pos, { squash?, duration? })`
`spring` is a closed-form damped spring: 0 at t = 0, overshoots when `zeta < 1`, settles to within 0.1 % of 1. Defaults `zeta 0.55`, `omega 9`. `impact` squashes and recovers the target (`squash 0.12`, `duration 0.5`) and records a `hit`.

### `tl.pointer({ path, clicks?, look? })` and `tl.press(target, t)`
`path: [{ t, x, y }]` (stage px) is a smooth path that passes through every knot. A cursor is drawn at `look` (`"arrow"` default, `"dot"`); its scale dips at each time in `clicks`. `tl.press(target, t)` gives the pressed element its reaction (small depress, then release) and records a `hit`. `S.pointerPath(clicklog)` converts a desktop-recorder click log into the same `path` and `clicks`.

## Measuring helpers on `S`

- `S.rect(el)` → `{ x, y, w, h }` in stage px, measured with the camera at rest.
- `S.center(el)` → `{ x, y }`.
- `S.grid({ depth?, spacing?, dot? })` adds a faint dot lattice behind the scene; dots keep a constant size on screen at any zoom. Defaults `depth 0.5`, `spacing S.min(6)`, `dot 2` px.

## The camera (version 2)

The camera is its own track, evaluated on every seek and written to `.world` once per frame. Keyed moves, `follow`, `handheld` and `shake` are summed, so they never overwrite each other. Existing `tl.camera({ zoom, x, y, rotate, tiltX, tiltY, duration, ease }, pos)` calls become keys on the track; zoom interpolates in log space (1 → 100 reads 10 at the midpoint).

- `tl.camera({ anchor, at: [x%, y%], zoom, duration, ease }, pos)`: keys the zoom in screen space, so the anchor element sits at the given screen position at any zoom (for deep zooms). Zoom above 50× without `anchor` is a lint warning.
- `tl.follow(target, { lead?, from?, to? })`: camera keys that keep the target near the frame centre, leading by `lead` seconds (default `0.1`). Computed once at build by a pre-pass that seeks the timeline without the camera and samples the target at 60 Hz. Cached, deterministic.
- `tl.whip(target, { duration? })`: an expo in-out snap, landing with the target centred. Default `duration 0.45`.
- `tl.handheld({ amount? }, from, to)`: a slow two-sine float. `amount` default `S.min(0.35)` px. Exactly zero outside its range and inside declared rests.
- `tl.shake(pos, { amp?, decay?, seed? })`: deterministic, zero before its time, applied in screen space (same on-screen size at any zoom). `amp S.min(1.2)`, `decay 0.35` s, `seed 1`. Records a `hit`.
- `data-depth="d"` on children of `.world`: parallax from the one camera; a layer moves `1 / (1 + d)` as far as depth 0.
- `data-lod="minPx,maxPx"`: the element fades in by its on-screen size; elements fully off-frame are left out of the snapshot. Nested levels may be authored at their own scale.

## Events, rests and cuts

- `tl.hit(name, pos, { pan?, kind? })`: a sound moment. `pan` is −1…1, `kind` one of `"impact" | "click" | "whoosh" | "land" | "shake"` (default `"impact"`). Carry landings, `shake`, `press` and `impact` record hits automatically.
- `tl.rest(from, to, { allow? })`: a declared dead-still stretch. Only elements in `allow` may move; camera layers are zero. Build fails with a clear `data-stage-error` if anything else inside `.world` moves during it.
- `tl.cut(pos)`: a deliberate hard cut. Undeclared hard cuts count against the carry check.

Rest rule (P0.4): stillness is allowed only when declared with `tl.rest`. Undeclared stillness over 0.8 s is still flagged by the motion metrics.

## What the stage root reports

Attributes on `.stage` (all JSON, all visible in the snapshot markup):

| attribute | content |
| --- | --- |
| `data-stage-version` | `"2"` (author-set) |
| `data-stage-carries` | `[{ "from", "to", "start", "end", "kind" }]` |
| `data-stage-events` | `[{ "name", "t", "kind", "pan" }]` |
| `data-stage-rests` | `[{ "from", "to" }]` |
| `data-stage-cuts` | `[t, …]` |
| `data-stage-error` | first runtime error (existing) |

## Not in this API

Shot checks (`checkShot`, `check_sequence`), the `carry` and `zoomThrough` editor transitions, the motion-blur export option and the skill are specified in their own phases (2–5).
