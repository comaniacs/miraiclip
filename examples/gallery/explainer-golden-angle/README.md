# The flower doing math

A 30-second, 1920×1080 explainer on the **golden angle**: why sunflower seeds turn by 137.5°. About 1,000 seeds are drawn on a canvas every frame with Vogel's model (r = c·√n, angle = n·θ). As θ sweeps, the whole head reorganises live. The look is a dark scientific poster: gold seeds, serif italics, an angle dial and an original score. One continuous take, no cuts.

| Time | Beat | On screen |
|---|---|---|
| 0–3.2 | Hook | Seeds burst into a sunflower head: "This flower is **doing math.**" "Every new seed turns by the same angle, again and again." |
| 3.2–6.8 | The rule | Zoom into the centre; seeds 1–6 land one by one, each turn drawn as an arc. "One rule. Turn by θ. Nudge outward. Repeat a thousand times." |
| 6.8–14.2 | Wrong angles | "But which angle?" The dial swings and the head collapses: ¼ turn → 4 spokes, ⅓ → 3, ⅖ → 5, and even 137.0° leaves spiral gaps |
| 14.2–19 | The answer | A flash as it locks: "The **golden angle.** 360° × (1 − 1/φ) ≈ 137.5°. φ ≈ 1.618 is the number fractions approximate worst, so no two seeds ever line up." |
| 19–25 | Hidden pattern | "Now count the spirals." Arms light up one at a time while a counter climbs to **34**, then the other family to **55**, highlighted on a Fibonacci row |
| 25–30 | Payoff | Petals unfurl around the head: "No math class. Just the best way to pack seeds." **137.5°**. Held from 28.6 s |

## Facts

- **Golden angle** = 360° × (1 − 1/φ) = 137.5077…°, where φ = (1 + √5)/2.
- **Vogel's model** (H. Vogel, 1979) places seed n at radius c·√n and angle n·θ. With θ at the golden angle it reproduces a sunflower's packing.
- **Why φ:** its continued fraction is all 1s, which makes it the irrational number rational approximations converge to most slowly. Any rational fraction of a turn p/q gives q straight spokes, as the film shows for ¼, ⅓ and ⅖.
- **The spiral counts are real in the drawing:** colouring seeds by n mod 34 and n mod 55 lights the two families of spirals (parastichies) in this 1,000-seed head. Real sunflowers commonly show consecutive Fibonacci counts such as 34/55 or 55/89. The film doesn't claim every flower does.

## Run

```sh
node build.mjs && node ../../../scripts/mc.mjs check video.miraiclip.json
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 0,2.6,5.6,8,10,11.5,13,15.8,21.6,24.4,29 --sheet
node render.mjs            # about 32 s on 4 workers → out/golden.mp4
```

`mc check` reports carry warnings, because the headlines swap at each beat. The picture itself is one continuous canvas, and the render validator confirms there are no hard cuts.

## Validated output

`out/golden.mp4`: 1920×1080, 30 fps, 900 frames, 30.0 s. AAC audio, true peak below 0 dBFS. No hard cuts. No black frames.
