# Gallery: Continuous shot: cursor tour

A 14 s, 1920×1080 single shot made with the stage kit's continuous-shot verbs. An invented settings screen, "Dial": a cursor flips three switches and presses Save, and the camera dives to each switch just before its click, then pans on. Both the cursor and the camera are operated.

| File | What it is |
| --- | --- |
| `build.mjs` | Generates `sequence.html` and `video.miraiclip.json` |
| `sequence.html` | The sequence on its own: paste it into an html clip with `scripted: true` |
| `video.miraiclip.json` | The finished project: one scripted html clip |

What it uses: `tl.pointer` (a smooth path that dips on each click), `tl.press`, `tl.camera({ anchor, at, zoom })` to put each switch at the centre of the frame, `tl.hit` and `tl.handheld`. The cursor draws in screen space, so its knots are screen positions at each click, not the switch positions.

Checked with the shot check (no findings) and by eye on stills. Build it with `node build.mjs` (needs `@miraiclip/core` built), then open `video.miraiclip.json` in an editor. Rendering needs an exporter that includes the continuous-shot stage kit (`@miraiclip/server-export` from the latest release): `npx -p @miraiclip/server-export miraiclip-export video.miraiclip.json --out cursor-tour.mp4`.
