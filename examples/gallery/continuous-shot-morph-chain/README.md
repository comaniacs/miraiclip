# Gallery: Continuous shot: morph chain

A 14 s, 1920×1080 single shot made with the stage kit's continuous-shot verbs. An invented music app, "Lumen": one pill is the only thing that moves. It becomes a now-playing card, the card becomes a playlist panel, the panel becomes a round play button, and an iris opens from the button on the closing title.

| File | What it is |
| --- | --- |
| `build.mjs` | Generates `sequence.html` and `video.miraiclip.json` |
| `sequence.html` | The sequence on its own: paste it into an html clip with `scripted: true` |
| `video.miraiclip.json` | The finished project: one scripted html clip |

What it uses: a chain of `tl.morph` hand-overs (pill to card to panel to button), `tl.iris` for the close, `tl.press`, and `tl.hit`.

Checked with the shot check (no findings) and by eye on stills. Build it with `node build.mjs` (needs `@miraiclip/core` built), then open `video.miraiclip.json` in an editor. Rendering needs an exporter that includes the continuous-shot stage kit (`@miraiclip/server-export` from the latest release): `npx -p @miraiclip/server-export miraiclip-export video.miraiclip.json --out morph-chain.mp4`.
