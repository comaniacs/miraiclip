# Resolution v2: one phone is one pixel, in 3D (25.6 s)

The same film as `continuous-shot-domino-resolution`, rebuilt as a real domino run in three.js. 12,293 phones stand on a white studio floor. Each one tips on its bottom edge into the next, and its screen lights as it lands, so a picture (a smiling classic computer, drawn in code) appears exactly where the wave has passed: 1, 3×3, 10×10, 32×32 (dark until the drop) and 100×100. The film ends on one phone left standing in the field, showing the whole picture, which winks and goes dark on the last hit.

The phone is generic: a rounded slab with a plain square camera bump and no marks. Nothing is copied from another film.

```
node build.mjs     # writes sequence.html and video.miraiclip.json from film.js
```

## Beat sheet (140 BPM, `beat(n) = 0.029 + n·60/140`)

| t (s) | What happens |
|---|---|
| 0–1.74 | Close on the back of one phone, the camera turning round it |
| 1.74–2.60 | It tips in slow motion; its screen wakes blue |
| 2.60 | It lands on the 3×3, which falls row by row |
| 3.46 (beat 8) | The S-line launches; the camera rides beside its front |
| ~6.9 | The 10×10's header row is struck in the middle and every column runs |
| 7.8–10.3 | Ride on the front of the trunk as it splits: 1, 2, 4, 8, 16, 32 lines, one generation every 0.69 s |
| 10.3–12.2 | Stepped pull-back, one step a split |
| 12.0–13.5 | The 32 lines run on into the 32×32, screens dark |
| 13.74 (beat 32) | **Drop**: all 1,024 screens light at once (shake) |
| 13.6–16.74 | The chase line snakes to the big field, the camera low beside it |
| 16.74 | The 100×100 is struck at its entrance: a circular front through 10,000 phones |
| 16.74–21.4 | Surf behind the front, then climb to a wide reveal; the picture winks on beats 48 and 50 |
| 22.31 | Dive to the one phone left standing |
| 23.6 / 24.89 | It winks, then its screen goes dark on the last hit |

## How it is built

- **3D in a sequence.** `data-libs="stage three"` loads three.js (bundled with the renderer), and `tl.frame(draw, { motion })` draws each frame from the time alone.
- **Instancing.** Two instanced meshes: the phone body (a rounded box merged with its camera bump) and the screen. Each frame, every phone's matrix is written from `lean(i, t)`, a rotation about its bottom edge on the side it falls toward. Each screen's glow is its picture colour mixed by how far the phone has fallen. Screens skip tone mapping so the picture keeps its colours.
- **Layout.** The lines are Catmull-Rom curves with phones every 0.72 units, packed tighter than the fields (0.9), so a fallen line lies as an overlapping stack. Each line runs for a set time, so a split always arrives on its beat. The splits are a binary tree whose 32 leaves are the 32×32's columns. Each field's phones fall in columns, with the picture row 0 at the far end, so it reads upright from the entrance.
- **Look.** A white floor and fog, a sun whose shadow box follows the camera's target, a room environment for reflections on the glossy backs, and ACES tone mapping.
- **Camera.** Keyed segments blended over half a second. Some are fixed moves; others ride a line's front, banking with its curvature.
- **Motion blur.** The `motion` function projects points around the subject from both camera poses, plus a tipping phone, so the exporter's motion blur gets a real sample count.

## Notes

- **Render cost.** Without a GPU (software WebGL), one 1080p frame takes 12–30 s, so the sequence sets `data-frame-timeout="120"`. On a machine with a GPU it renders at normal speed. Export with motion blur on: the fronts are fast.
- **Shot check.** `check_sequence` reports every beat as bare, because the film is one canvas. Read that as expected, not as a fault.
- **Physics.** Phones lean at a fixed rest angle rather than being simulated, so in close-ups a fallen phone's top can pass slightly into the next one. In wide shots of the big field a few phones show their dark edges as specks.
- **Sound.** There is no audio; the hit events (`data-stage-events`) are there to cut a score to.
