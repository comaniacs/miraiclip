# Gallery: Continuous shot: hop and gather

A 14 s, 1920×1080 single shot made with the stage kit's continuous-shot verbs. An invented team app, "Huddle": five avatars hop from a bench into their slots one after another, six task chips fly into an inbox, and the camera whips onto the inbox and pushes in.

| File | What it is |
| --- | --- |
| `build.mjs` | Generates `sequence.html` and `video.miraiclip.json` |
| `sequence.html` | The sequence on its own: paste it into an html clip with `scripted: true` |
| `video.miraiclip.json` | The finished project: one scripted html clip |

What it uses: `tl.hop` (one peg per slot, each landing with a squash and a hit), `tl.gather` (the chips fan into the inbox), `tl.impact` on the inbox, `tl.whip`, and `tl.camera`. Each hop drives its own element because a hop is measured from the element's resting position.

Checked with the shot check (no findings) and by eye on stills. Build it with `node build.mjs` (needs `@miraiclip/core` built), then open `video.miraiclip.json` in an editor. Rendering needs an exporter that includes the continuous-shot stage kit (`@miraiclip/server-export` from the latest release): `npx -p @miraiclip/server-export miraiclip-export video.miraiclip.json --out hop-gather.mp4`.
