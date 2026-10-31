# Foldwork

A 30-second launch film for an invented tool, **Foldwork**. A pop-up book: a line of light creases a blank page, and a city folds up from it. The left page keeps the flat plan, and a coral line ties the plan to the real buildings. At dusk the windows light up and paper birds fly through the streets. Then the city folds flat, the book closes, and the cover shows the brand: *Every world starts flat.*

It is made from HTML and CSS 3D only, with no WebGL, and the camera moves in one take. Concept, script, transitions and assets are in [PRODUCTION.md](./PRODUCTION.md).

## Run

```sh
node build.mjs                                               # film/*.js + timeline.mjs → sequence.html, video.miraiclip.json
node ../../../scripts/mc.mjs check video.miraiclip.json      # the city stays in frame; the final rest holds still
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 1.2,6,12,18.5,23.4,27.6,29.5 --sheet
node render.mjs --draft                                      # fast check render
node render.mjs --blur                                       # the final with motion blur (≈ 7.5 min on 4 workers)
```

## How it is built

- **The pop-up mechanism is real.** Each building is one `matrix3d` shear (`y' = y·cos a`, `z' = z + y·sin a`): front and back hinge on their base edges, the roof stays level, and the sides become parallelograms. Faces keep their size, and each face's shade comes from its rotated normal against the key and fill lights.
- **The day/dusk light model** swings the key light low and amber. Windows are cut-outs with a glow layer that switches on in a wave.
- **The camera** uses the app-film kit's `filmCamera` (monotone cubic keys, distance in log space). The coral line, `lineIO` and `fadeIO` come from the kit's overlay module. The score uses the kit's synthesizer, and `render.mjs` is the kit's render-and-validate.

## Validated output

These are measured from `out/foldwork.mp4` by the kit's `render.mjs`:

| Property | Result |
|---|---|
| Video | H.264, 1920 × 1080, 30 fps, 900 frames, 30.000 s, motion blur |
| Audio | AAC 48 kHz stereo, 30.000 s, true peak below 0 dBFS |
| Hard cuts / black frames | None (max scene score under 0.3; `blackdetect` finds none) |
| Shot check | `mc check` is clean |

## Known limitations

- **Chrome doesn't cull the cover's back face reliably.** Its rotated content escapes `backface-visibility`, so the film swaps cover and page visibility explicitly when the half stands on edge.
- **The type depends on the machine.** It uses Avenir Next (macOS), with fallbacks.
- **The brand is invented.** Foldwork and its claims are fictional.
