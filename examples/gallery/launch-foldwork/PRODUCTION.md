# Foldwork: production script

A 30-second launch film for **Foldwork**, an invented tool that turns flat plans into 3D spaces. It is made from HTML and CSS 3D only, with no WebGL. Every frame is a pure function of `t` on one timeline, and the camera moves in one take.

## A. Concept

| | |
|---|---|
| **Idea** | *Every world starts flat.* A blank page is creased by a line of light and folds up, piece by piece, into a city: a pop-up book. The left page keeps the flat plan and the right page becomes the place. At the end the city folds back down and the book closes into the brand. |
| **Visual metaphor** | The fold: 2D becoming 3D. The left page is the blueprint (the plan), the right page is the pop-up city (the result), and a coral crease line joins them. |
| **Narrative** | A flat sheet → the first fold → a city rising → how it works (plan ↔ building) → the city comes alive at dusk, paper birds fly → the whole spread from above → it folds away into a closed book: Foldwork. |
| **Art direction** | A paper diorama in a dark studio. Warm paper `#f2ede3`, ink blue-black `#0e1016`, one coral accent `#ff5b3a` for the crease line, warm window light `#ffb45c` at dusk, and navy book cloth `#1b2440` with a coral foil stamp for the cover. |
| **Materials** | Matte paper on every fold, shaded per face from its angle to the key light, with a soft paper grain. The blueprint is printed ink lines. The cover is cloth with an embossed foil mark. Windows are cut-outs that glow from inside at dusk. |
| **Lighting** | One warm key from high front-left, a cool fill from the right, and a soft contact shadow under every fold. At 15–18 s the key swings low and warm (dusk); the windows take over as the light source. |
| **Motion language** | Paper moves like paper: folds spring up with a slight overshoot and settle, birds flap with quick, light strokes, the camera glides heavily, and type rises through masks. |
| **Sound** | Original synthesized score. Paper folds are soft, filtered "snaps". A warm music-box motif builds through the city's rise, the birds add an airy shimmer, the reveal lands a full chord, and the ending is the dull thud of a closing book and one bell. |
| **Payoff** | The closed book with the foil-stamped mark: the world you just saw lives inside a flat object. *Every world starts flat.* |

## B. Production script

Coordinates: px in world space, y down. The book lies on the plane y = 0 with the spine along the z axis at x = 0, the left page from x −1600 to 0 and the right page from 0 to 1600, both spanning z −550…550. Camera keys are `[t, yaw, elev, dist, tx, ty]` (`film/60-camera.js`), joined by monotone cubics, so velocity is continuous and nothing overshoots.

| Time | Scene | What happens | Camera | Type and graphics | Sound | Hand-off |
|---|---|---|---|---|---|---|
| 0.0–4.0 | **1 · Hook** | Darkness, and a single blank sheet in a pool of light. A coral line scores a crease across it (0.3–1.9). The paper folds up along it into the first facade (2.0–3.4) and springs into place. | Top-down macro (elev 88°, dist 700) over the crease, then easing back and tilting. | "Every world" / "starts flat." rises through masks. | A held low tone. A pencil-scratch hiss under the line. A paper snap on the fold. | The first building is up; the camera is already pulling back. |
| 4.0–9.0 | **2 · Introduction** | More creases draw across the right page in a street grid, and buildings fold up in a wave out from the first (4.4–8.2). The left page shows the same plan as ink lines. | Pull back and tilt to a wide 3/4 (elev 30°, dist 2300). | "Fold by fold," / "it takes shape." | A music-box motif enters. A snap per fold, softened by distance. | The camera keeps moving down toward the streets. |
| 9.0–15.0 | **3 · Discovery** | One last tower folds up slowly while it is annotated: its dashed fold lines, a 0°→90° angle arc, and a coral projection line from its rectangle on the plan to the real building. | A dive to street level (elev 8°, dist 820) and a dolly between the facades. | Annotation `FOLD 90°`. "Every crease," / "a plan." | Ticks on the angle counter; one snap. | The light starts to warm. |
| 15.0–21.0 | **4 · Transformation** | Dusk. The key light swings low and warm and windows light up in a wave. Three paper birds fold up from the left page and fly through the streets along the coral line. | Tracking the birds up and around (yaw 90°→150°), rising. | "Every plan," / "a place." | The motif swells. Wing flutters. A rising chord. | The birds lead the camera up. |
| 21.0–26.0 | **5 · Reveal** | The whole spread from above: the left page plan and the lit city on the right are the same layout. The coral line traces from plan to city and draws the Foldwork mark on the plan. | Top-down wide (elev 78°, dist 3300), then easing into a turn. | "From flat plans" / "to living worlds." | The full chord lands. | The city starts to fold down. |
| 26.0–30.0 | **6 · Resolution** | The city folds flat in a wave (25.8–27.2), the left page swings over and closes (26.6–28.4), and the cover shows the foil-stamped mark and **FOLDWORK**. Held from 28.8 s. | Settles to a 3/4 hero on the closed book. | Wordmark on the cover; "Every world starts flat." and an "Unfold yours" pill below. | A soft book thud, one bell; it ends exactly at 30 s. | — |

## C. Storyboard

Real frames from the render every half second: `stills/sheet-1.png`, `stills/sheet-2.png`.

## D. Assets

- **Pages:** two planes with paper grain. The left page is a group hinged on the spine. Its front is the blueprint (SVG ink lines plus the mark); its back is the cover (cloth texture, foil mark, embossed wordmark).
- **Buildings:** 16 boxes, each four facades and a roof, with windows cut in a grid. A building hinges on its base edge from flat (−90°) to standing, with a damped overshoot. Each face is shaded from its rotated normal against the key and fill lights.
- **Creases:** SVG lines on the right page, drawn with a dash offset.
- **Birds:** three paper planes (two wing triangles and a keel) that flap and fly along a 3D path.
- **Shadows:** a blurred contact quad per building on the page, which shortens as the building stands up.
