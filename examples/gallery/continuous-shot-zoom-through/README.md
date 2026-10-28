# Gallery: Continuous shot: zoom through

A 14 s, 1920×1080 single shot made with the stage kit's continuous-shot verbs. An invented analytics tool, "Tidepool": the camera pushes into a laptop screen until the dashboard inside takes over the frame, the cards fill in, a click ships the report, and an iris opens on the confirmation.

| File | What it is |
| --- | --- |
| `build.mjs` | Generates `sequence.html` and `video.miraiclip.json` |
| `sequence.html` | The sequence on its own: paste it into an html clip with `scripted: true` |
| `video.miraiclip.json` | The finished project: one scripted html clip |

What it uses: `tl.zoomThrough` with `into` (the dashboard sits outside `.world` and takes over on the last frame), `tl.pointer` and `tl.press`, `tl.iris` for the close, and `tl.hit`.

Checked with the shot check (no findings) and by eye on stills. Build it with `node build.mjs` (needs `@miraiclip/core` built), then open `video.miraiclip.json` in an editor. Rendering needs an exporter that includes the continuous-shot stage kit (`@miraiclip/server-export` from the latest release): `npx -p @miraiclip/server-export miraiclip-export video.miraiclip.json --out zoom-through.mp4`.
