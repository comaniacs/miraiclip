# Gallery: Continuous shot: the mascot is the pointer (v2)

The same 19 s story as `continuous-shot-pip-desktop`, rebuilt to close the gap with a fully 3D reference film. Pip, an invented mascot for an invented assistant, "Nudge", is still the pointer: landing on an icon is the click, a hop along the prompt types a word, a file carried overhead is the drag, and stamping a window's yellow light sends it home. One prompt asks for a button that does nothing; the button does nothing, and the window shakes its head anyway.

What changed from v1, and why:

| v1 gap | v2 |
| --- | --- |
| Flat, frontal desktop | The desktop is a plane tilted 58° under perspective, built from slabs with real thickness (dock, icons, windows), and a floor with a faint grid so camera moves read |
| Flat blob mascot | Pip is a CSS box with a lit top, front and sides, eyes that look and blink, and a squash on every landing |
| No depth cue | A contact shadow under Pip that shrinks and softens as it jumps |
| Camera far away and still | Zoom between 1.6× and 2.4× on every beat, `tl.follow` on Pip, a slow roll on each move, and one rise to 0.62× for the overview |
| Small sans text | Large monospace prompt, verbs and end line |
| Dull beats | The prompt types as Pip lands, the button is pressed down with a visible lip, and the whole window and Pip shake together |

How it is built: `.world` carries the perspective and the camera; a `.table` child is rotated with `preserve-3d`. Anchors and follow measure the projected positions, so they stay correct over the tilted plane. The camera itself is never tilted, because its anchor maths assumes a flat image.

What it uses: `tl.follow`, `tl.camera` (zoom and roll), `tl.handheld`, `tl.hit` on every landing and press, and keyed `x`, `y` and `z` moves for Pip. The window pops are `tl.fromTo` scales rather than `tl.morph`, because a morph measures a flat bounding box and a tilted slab's projected box is not its plane size.

Measured against v1 and the reference, frame to frame at 12 fps on low-res renders:

| | reference | v1 | v2 |
| --- | --- | --- | --- |
| Average change per frame | 7.8 | 1.2 | 5.2 |
| Frames where nothing moves | 0% | 39% | 6% |
| Longest stretch with nothing moving | 0 s | 1.7 s | 0.7 s |
| Share of the frame changing (median) | 16.7% | 0.9% | 7.8% |

Not in this version: glass refraction, real lens blur, a depth-of-field pass and sound. Export with shutter motion blur on for the fast moves, and note that the hits are recorded for sound but nothing turns them into foley yet.

Checked with the shot check and by eye on stills. Build it with `node build.mjs` (needs `@miraiclip/core` built), then open `video.miraiclip.json` in an editor, or export with `npx -p @miraiclip/server-export miraiclip-export video.miraiclip.json --out nudge2.mp4`.
