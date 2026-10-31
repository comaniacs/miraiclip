# THE MENTALIST: "Every detail matters" (fan-made promo)

An **unofficial, fan-made** 30-second promo for *The Mentalist* (CBS, 2008–2015, seven seasons). It isn't affiliated with or endorsed by CBS or Warner Bros. Television, and the end card says so.

It uses no official logo, artwork, footage, music or actor likeness. The title is set in a generic Didot, and the only factual claim is "seven seasons". The CTA ("Stream the complete series") deliberately names no platform, because availability varies.

## The film

A teacup in a spotlight. "Look closer." The camera dives through the tea into a dark mind-space of hanging clue cards. Three deductions follow, each with a leader line to its conclusion. A red string threads the clues while the camera tracks it.

Then the camera swings to one exact viewpoint, and the scattered clues line up: two eyes and a smile. The string and a painted ring complete a red smiley face, the series' signature warning. "Some patterns are a warning." THE MENTALIST · "All seven seasons. Every detail matters."

It is HTML and CSS 3D only, with no WebGL, filmed in one camera take. The treatment and script are in [PRODUCTION.md](./PRODUCTION.md).

## How the reveal works

**It's an anamorphic arrangement.** Each card's pin is placed at a random depth `z`, scaled by `(PERSP − z) / PERSP` toward its point of the pattern. So from the true viewpoint (yaw 0, elev 0, dist = PERSP, aimed at the field's centre), every pin projects onto the smiley, while from anywhere else the clues look scattered. The red string is drawn through the smile's pins in 3D, so it zig-zags through space and becomes a clean arc at that one angle.

## Run

```sh
node build.mjs && node ../../../scripts/mc.mjs check video.miraiclip.json
node render.mjs            # high quality, no motion blur: ≈ 22 s total on 4 workers
```

## Validated output

These are measured from `out/mentalist.mp4` by the app-film kit's `render.mjs`: 1920 × 1080, 30 fps, 900 frames, 30.000 s; AAC audio, 30.000 s, true peak below 0 dBFS; no hard cuts; no black frames. `mc check` is clean (carry score 0.95).

## Known limitations

- **During the deductions (10–13 s)** nearby cards crowd the frame around the card being read.
- **The clue icons are Apple Color Emoji**, so the cards depend on macOS fonts.
- **It's for personal or portfolio use.** It is a fan tribute: don't use it as official marketing.
