# Camera

The camera is the `.world` layer: everything inside `<div class="world">…</div>` moves with it. `tl.camera(vars, position)` animates that layer:

| Camera var | What it does | Typical range |
|---|---|---|
| `zoom` | push in (> 1) or pull back (< 1) | 0.9–1.15 for drift; 3–7 for zoom-through and reveals |
| `x`, `y` | pan; always `S.w(%)` / `S.h(%)` | 2–6% for drift; 100% for a whip to the next panel |
| `rotate` | roll | ±1–3° |
| `tiltX`, `tiltY` | tilt in depth (perspective is set for you) | 6–20° |
| `duration`, `ease` | default 1.2 s, power2.inOut | match the beat or overlap it |

Elements **outside** `.world` (for example a `.hud` with a chip or a caption) don't move with the camera.

The camera zooms about the `.world` transform-origin (the centre by default). To push into a detail, put the origin on that detail. Measure it with `getBoundingClientRect()` before any camera move, then `tl.set(".world", { transformOrigin: "x% y%" }, 0)`.

## The camera keeps moving, except in a declared rest

Give each beat one camera move that lasts the beat, or longer, overlapping the next. A static camera is allowed only during a hold that has something else moving, and for less than 0.8 s. The one exception is a stretch you declare with `tl.rest(from, to)` (stage version 2): everything in `.world` is dead still on purpose, for a punchline or a pause. Undeclared stillness is still flagged, and the build fails if something moves during a declared rest. After composing, run `check_sequence` to see which beats start from nothing.

## Moves and when to use them

- **Slow push (zoom 1 → 1.05–1.1, sine.inOut):** the default for any beat. It adds life without drawing attention.
- **Pull back (zoom 1.3 → 1):** opening a beat close on a detail and revealing context. At an extreme, it's a zoom-out-reveal.
- **Pan with the type (x −3 to −6%):** while a line types or words land left to right, drift the same way so the text slides across at an angle.
- **Tilt in depth (tiltX/tiltY 8–20°):** windows, cards and stacks feel like objects in a space. Combine it with a slight zoom.
- **Untilt to resolve (tilt → 0, power3.inOut):** the end of a section. The frame flattens as the idea lands.
- **Push-through (zoom to 4–7, expo.in):** into an element whose colour becomes the next background (zoom-through). Reset the camera on the frame where only that colour fills the screen.
- **Whip (x ±100%, 0.3–0.4 s, power4.inOut, with blur):** to the next panel (whip-pan).
- **Kick (zoom −5% in 0.25 s, then back):** on an impact (collide-and-merge, a beat hit).

## Rules

- Sizes are always in S units (`S.w`, `S.h`, `S.min`). Never pixel numbers: the act must work in 16:9, 9:16 and 1:1.
- One camera move at a time per property. Start the next move when the last one ends (or with `">"`), not on top of it.
- Pair tilt with `transform-style: preserve-3d` on `.world` and on any wrapper when children use `z` (depth-stack).
- Keep the subject inside the safe area during moves (about 5% in from each edge, more in 9:16). Check the filmstrip.
- Don't reset the camera to neutral between beats. Carry the motion on.

## The operated camera (version 2)

Add `data-stage-version="2"` to the stage root and the camera becomes a track you can operate, not just keyframe. Everything below sums on the one `.world` layer, so moves never fight each other.

| Call | Use it to |
|---|---|
| `tl.camera({ zoom })` | Zoom in log space: 1 to 100 reads 10 halfway, so a long dive feels even |
| `tl.camera({ anchor, at: [x%, y%], zoom })` | Hold a subject at a screen position while the zoom changes. Use it for every zoom above 50× |
| `tl.follow(target, { lead: 0.1 })` | Chase a moving subject, keyed slightly ahead of it |
| `tl.whip(target, { duration })` | Snap to the next subject and land with it centred |
| `tl.zoomThrough(target, { into })` | Push into a surface and hand over to the scene inside it |
| `tl.handheld({ amount }, from, to)` | A slow float so a held shot still breathes |
| `tl.shake(position, { amp, decay, seed })` | A hit shake that reads the same at any zoom |

Keep the subject inside the safe area while the camera moves, and put hits on the beat with `tl.hit` so sound can follow them.
