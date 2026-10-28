# Gallery: Continuous shot dive

A 14 s, 1920×1080 single shot made with the stage kit's continuous-shot verbs. A dot morphs into a monitor, the camera dives through four screens inside screens (about 160× deep), rests on the last one, and pulls back out to where it began. Nothing cuts.

| File | What it is |
| --- | --- |
| `build.mjs` | Generates `sequence.html` and `video.miraiclip.json` |
| `sequence.html` | The sequence on its own: paste it into an html clip with `scripted: true` |
| `video.miraiclip.json` | The finished project: one scripted html clip |

What it uses: `tl.morph` (the opening hand-over), `tl.camera({ anchor, at, zoom })` (the dive and the return), `tl.shake` and `tl.hit` (the landing), `tl.rest` with an allowed blinking caret, `tl.handheld`, and `S.grid` / `S.center` for the ground and the way home. Its events (`data-stage-events`) list the whoosh, landing and return hits, ready for sound.

Build it with `node build.mjs` (needs `@miraiclip/core` built), then open `video.miraiclip.json` in an editor. Rendering needs an exporter that includes the continuous-shot stage kit: build `@miraiclip/server-export` from this branch until it is released. After that, `npx -p @miraiclip/server-export miraiclip-export video.miraiclip.json --out dive.mp4` works.
