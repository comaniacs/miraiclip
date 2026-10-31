# TILDE: "Nothing to hide"

A 30-second ad for an invented sparkling water, **TILDE**.

A single bubble rises through dark water and pops at the can's lid, and the pop turns the light on. The camera pulls back to reveal the can. Its label peels off strip by strip into a flat card, showing three ingredients and 0 g sugar, then wraps back on. Lemon and lime slices orbit the can, a coral tilde wave draws round it, and the ad closes on **TILDE · Nothing to hide. Everything to taste. · Find it chilled.**

It is HTML and CSS 3D only, with no WebGL, filmed in one camera take. The treatment and script are in [PRODUCTION.md](./PRODUCTION.md).

## Run

```sh
node build.mjs && node ../../../scripts/mc.mjs check video.miraiclip.json
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 1.5,4,6.5,12.5,18,23.5,29.5 --sheet
node render.mjs            # high quality, no motion blur: ≈ 25 s total on 4 workers
node render.mjs --blur     # with motion blur (much slower)
```

## Validated output

These are measured from `out/tilde.mp4` by the app-film kit's `render.mjs`: 1920 × 1080, 30 fps, 900 frames, 30.000 s; AAC audio, 30.000 s, true peak below 0 dBFS; max scene score under 0.3 (no hard cuts); no black frames. `mc check` is clean.

## Notes

- **The label is 48 strips, each showing one slice of one HTML design**, so the print wraps seamlessly, peels flat and wraps back.
- **Chrome lets a strip's printed design escape both `backface-visibility` and `overflow: hidden` at grazing angles.** The film hides back-facing strips explicitly and clips each one with `clip-path: inset(0)`. The render validator caught the escape as a hard cut at 4.0–4.2 s, where an unclipped design swept across the lens.
- **The key light travels with the camera**, like a product-shoot key on the camera rig, so the hero is lit from any angle.
- **The final is rendered without motion blur.** It took 19 s, against minutes with blur.
- **Known limitation:** on the off-axis hero framing, the wordmark sits slightly left of the can's visual centre.
- **The brand is invented.** TILDE and its ingredients are fictional.
