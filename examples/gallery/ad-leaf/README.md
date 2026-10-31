# LEAF: "One page thin"

A 30-second ad for an invented e-reader, **LEAF**.

A page reading "Chapter One" falls through the dark. Forty pages of other books swirl in around it and compress into a thin graphite slab, which is the device. A macro on the paper-like screen shows the reading light sliding from cool to warm amber. A page turns off the screen, and the pages orbit the device as your library. Then they dive back into the screen, which flashes to the LEAF cover. It closes on **LEAF · Your whole library, one page thin. · Pre-order now.**

It is HTML and CSS 3D only, with no WebGL, filmed in one camera take. The treatment and script are in [PRODUCTION.md](./PRODUCTION.md).

## Run

```sh
node build.mjs && node ../../../scripts/mc.mjs check video.miraiclip.json
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 1.5,4.5,8.2,11,13.5,18.5,23.7,29.5 --sheet
node render.mjs            # high quality, no motion blur: ≈ 22 s total on 4 workers
```

## Validated output

These are measured from `out/leaf.mp4` by the app-film kit's `render.mjs`: 1920 × 1080, 30 fps, 900 frames, 30.000 s; AAC audio, 30.000 s, true peak below 0 dBFS; no hard cuts (max scene score under 0.3); no black frames. `mc check` is clean.

## Notes

- **Each page's pose is a blend of four states**: falling, swirl, docked in the device, and the orbiting ring. Every hand-over between scenes is therefore continuous by construction.
- **The page turn hinges on the screen's left edge** in the device's own space, then blends into world space.
- **Two Chrome behaviours, both fixed:**
  - `opacity < 1` or `mix-blend-mode` flattens a `preserve-3d` group, so its back face painted over its front. The fade now only applies while the device is being born, and the warm light uses plain opacity.
  - Face content escapes `backface-visibility`, so the front and back faces are switched explicitly by which way the device faces.
- **Known limitation:** at 3–4 s the swirl passes pages close to the lens, and they cross the hook line.
- **The brand is invented.** LEAF and its book text are original and fictional, and no specifications are claimed.
