# Gallery: Continuous shot: the mascot is the pointer

A 19 s, 1920×1080 single shot for an invented desktop assistant, "Nudge". The mascot, Pip, is the pointer: landing on an icon is the click, a hop along the input row types a word, carrying a file overhead is the drag, and stamping a window's yellow light sends it home to the dock. The story is one prompt that asks for a button that does nothing. The button does nothing, and the window shakes its head anyway.

It is an original film made from a brief (a mascot that causes every interface action with its body, on a flat desktop). It is built from the stage kit's DOM and CSS, so it is a flat desktop rather than a 3D one.

| t (s) | beat | what carries it |
| --- | --- | --- |
| 0–1.2 | Pip drops onto the first icon and the dock ripples | the camera pushes in on Pip |
| 1.2–3.4 | it runs icon to icon, stamps the terminal, which bounces twice with it riding | `tl.follow` |
| 3.4–4.4 | the window springs out of the terminal icon | `tl.morph` |
| 4.4–6.1 | four hops type the prompt, a stamp sends it | the hops, `tl.press` |
| 6.1–8.3 | spinner, three verbs, the reply streams | Pip jabs along the row |
| 8.3–10.2 | a file is stamped out and carried overhead to the web icon | the file travels with Pip |
| 10.2–11.9 | the web window springs out, a long leap onto the button | `tl.morph`, the leap |
| 11.9–14.4 | the window shakes "no", a banner slides in, Pip looks left, right and blinks | |
| 14.4–17.4 | the camera rises, Pip stamps each window's yellow light and each goes home to the dock | `tl.camera` zoom |
| 17.4–19 | it runs home, the end line appears, Pip leaps off the first icon | |

What it uses: `tl.morph` for the windows, `tl.follow` and `tl.camera` for the chase and the overview, `tl.press`, `tl.hit` on every landing, `tl.handheld`. Pip moves with its own keyframed `tl.to` calls rather than `tl.hop`, because a hop is measured from the element's resting position and so can't be chained.

Checked with the shot check (no findings) and by eye on stills. Build it with `node build.mjs` (needs `@miraiclip/core` built), then open `video.miraiclip.json` in an editor, or export with `npx -p @miraiclip/server-export miraiclip-export video.miraiclip.json --out nudge.mp4`.
