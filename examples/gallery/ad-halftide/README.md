# HALFTIDE: "Colour that moves like water"

A 30-second ad for an invented fountain-pen ink, **HALFTIDE**, made with **fluid motion** as the brief asked.

A drop falls onto wet paper and blooms into one living body of ink. The bloom drains in a vortex to a point, and from that pool a glass bottle rises full of blue ink. The ink flows out of it and writes a looping line across the page, the head of the stroke a wet bead of liquid. It splits into three colours (Tidewater blue, Kelp, Amber) that flow as ribbons round the bottle, merging where they touch. Then everything pours back in, and the ink level, which dropped while it wrote, rises to full. It closes on **HALFTIDE · Colour that moves like water. · Explore the 12 tides.**

It is HTML, SVG and CSS 3D only, with no WebGL, filmed in one camera take. The treatment and script are in [PRODUCTION.md](./PRODUCTION.md).

## Run

```sh
node build.mjs && node ../../../scripts/mc.mjs check video.miraiclip.json
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 1.7,2.6,8.2,12,17.5,22.8,29.5 --sheet
node render.mjs            # high quality, no motion blur: ≈ 21 s total on 4 workers
node render.mjs --blur     # motion blur: smoother still, much slower
```

## How the fluid works

- **The ink is SVG metaball "goo".** Circles are blurred, then a colour matrix applies a hard alpha threshold, so blobs fuse and split like liquid. Each colour has its own group, so the colours keep their own hue where they meet.
- **Every blob's position is one continuous function of `t`** that blends bloom → vortex → stroke head → ribbon → pour. The liquid never teleports, and the camera's monotone cubic keys keep its velocity continuous across every beat.
- **The bottle's ink level is tied to the story.** It drops while the ink writes and flows out, and rises as the colours pour back.

## Validated output

These are measured from `out/halftide.mp4` by the app-film kit's `render.mjs`: 1920 × 1080, 30 fps, 900 frames, 30.000 s; AAC audio, 30.000 s, true peak below 0 dBFS; no hard cuts (max scene score under 0.3); no black frames.

## Known limitations

- **The shot check reports 2 "bare boundaries"** (4.2 s and 6.6 s). Its carry check reads DOM elements, not the SVG circles that carry the ink across those beats, so the continuity is real but invisible to it.
- **Frame 0 is the empty page.** The drop enters frame at about 0.4 s.
- **The brand is invented.** HALFTIDE, its colours and "12 tides" are fictional.
