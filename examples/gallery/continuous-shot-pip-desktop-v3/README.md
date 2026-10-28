# Gallery: Continuous shot: the mascot is the pointer (v3)

The same 19 s story as v1 and v2, rebuilt to close the remaining gaps with a fully 3D reference film. Pip, an invented mascot for an invented assistant, "Nudge", is the pointer: landing on an icon is the click, hops along the prompt type it, a file carried overhead is the drag, and stamping a window's yellow light sends it home. One prompt asks for a button that does nothing; the button does nothing, and the window shakes its head anyway.

What v3 adds over v2:

| Gap | v3 |
| --- | --- |
| Camera always straight on | The whole plane swings and its tilt changes between beats, so the camera appears to orbit and the dock runs diagonally |
| Everything in focus | Depth of field: the dock, the terminal window and the web window are blurred in turn when they are out of focus. The blur is hand-timed per object, not a lens model |
| Flat button | A glossy pill with a thick edge, a squash under the landing and a light sweep across it |
| Flat banner | A thick notification card that lies on the desktop and slides in, with an icon, a file name and "now" |
| Nothing left behind | A file icon with its name stays on the desktop; its ghost is carried to the dock |
| Plain box mascot | Arms that swing up in the air, feet, a crouch before each jump, a stretch in the air and a lean and squash on landing |
| Only Pip casts a shadow | Every slab (dock, icons, windows, button, card) has a soft shadow on what is below |
| Opaque windows | Translucent, bevelled windows. Real refraction of the wallpaper needs a 3D clip type and is not here |
| Words appear a word at a time | The prompt types letter by letter behind a moving block cursor |
| Five icons | Twelve original icons with rims, gradients and detailed glyphs |

How it is built: `.world` carries the perspective and the camera; `.table` is rotated with `preserve-3d` and tilts per beat; `.spin` swings the plane. Depth of field is a CSS blur on the faces of out-of-focus slabs, driven by three variables, because a blur on a 3D container would flatten it. Anchors and follow measure projected positions, so the camera stays correct over the swinging plane, and the camera itself is never tilted.

Measured frame to frame at 12 fps on low-res renders, against the reference film:

| | reference | v1 | v2 | v3 |
| --- | --- | --- | --- | --- |
| Average change per frame | 7.8 | 1.2 | 5.2 | 8.6 |
| Frames where nothing moves | 0% | 39% | 6% | 1% |
| Longest stretch with nothing moving | 0 s | 1.7 s | 0.7 s | 0.25 s |
| Share of the frame changing (median) | 16.7% | 0.9% | 7.8% | 14.8% |

Cost: this is the heaviest example in the gallery. The blurred faces, the shadows and the many stacked layers made a 480×270 still take about 4 s here, with software rendering in a headless browser. Expect a slow export, and try it on your GPU machine first. If it is too slow, drop the three `--b…` blur variables to 0.

Export with shutter motion blur on (the exporter's `motionBlur` option or the playground checkbox) for the fast moves: the leap onto the button and the shake are meant to be soft. The film records a hit on every landing, press and whoosh for sound, but nothing turns those into foley yet.

Checked with the shot check and by eye on stills. Build it with `node build.mjs` (needs `@miraiclip/core` built), then open `video.miraiclip.json` in an editor, or export with `npx -p @miraiclip/server-export miraiclip-export video.miraiclip.json --out nudge3.mp4`.
