# Gallery: Continuous shot: whip tour

A 14 s, 1920×1080 single shot made with the stage kit's continuous-shot verbs. An invented trip planner, "Wayfinder": four stops sit along one long line, the camera whips from stop to stop, and a last pull-back shows the whole route. The line is the thing that survives every beat.

| File | What it is |
| --- | --- |
| `build.mjs` | Generates `sequence.html` and `video.miraiclip.json` |
| `sequence.html` | The sequence on its own: paste it into an html clip with `scripted: true` |
| `video.miraiclip.json` | The finished project: one scripted html clip |

What it uses: `tl.whip` (three snaps that land with the next stop centred), `tl.camera({ anchor, at, zoom })` for the pull-back, `tl.hit` (a whoosh per whip, a landing at the end) and `tl.handheld`. Note the world layer stays stage-sized and the stops overflow it, which is what the camera maths expects.

Checked with the shot check (no findings) and by eye on stills. Build it with `node build.mjs` (needs `@miraiclip/core` built), then open `video.miraiclip.json` in an editor. Rendering needs an exporter that includes the continuous-shot stage kit (`@miraiclip/server-export` from the latest release): `npx -p @miraiclip/server-export miraiclip-export video.miraiclip.json --out whip-tour.mp4`.
