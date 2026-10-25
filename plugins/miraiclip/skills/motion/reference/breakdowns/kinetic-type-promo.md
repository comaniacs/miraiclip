# Breakdown: kinetic-type promo (12 s)

A grammar study of a style, not a description of one particular film: the all-type promo. There are no pictures. Words are the picture: they punch in on the beat, swap in place, fill the frame and fly through it. It suits a launch, an event, a sale or a manifesto, anything with a few strong lines and a beat to cut to.

Use it to learn the grammar. Build your own film's version of each idea; don't copy the beats.

## Look

- **Background:** a flat colour that changes at the turns: black → the accent → white. The colour flips are the cuts.
- **Type:** one heavy grotesk, very large (headline 14–30 cqmin, some words bleeding off the frame), tight tracking, all caps or sentence case but not both. A second weight at most.
- **Colour:** two or three flat colours that swap roles (text and background trade places).
- **Shapes:** a few accent shapes (a bar, a dot, a square) that act as punctuation.
- **Words on screen:** 1–4 at a time.

## Beats (at 120 bpm, a beat every 0.5 s)

| # | Time | What happens | Technique | Carried into the next beat |
|---|---|---|---|---|
| 1 | 0.0–1.0 | On black: "YOU" punches in (scale from 1.4, blur to sharp), then "MAKE" beside it on the next beat | kinetic-type, motion-blur | The line's baseline |
| 2 | 1.0–2.0 | The third word swaps in place every beat: "VIDEOS" → "SLIDES" → "TEMPLATES" (each slides up out of a mask) | swap-in-place, mask-reveal | The slot |
| 3 | 2.0–2.5 | The last word "TEMPLATES" is struck through by an accent bar that wipes across | wipe, accent-punctuation | The accent bar |
| 4 | 2.5–3.0 | The bar grows to fill the frame: the background is now the accent colour | scale-to-fill | The accent background |
| 5 | 3.0–4.5 | "WE MAKE" in black on the accent; then "FILMS." scales from tiny to bleeding past both edges | kinetic-type, scale-to-fill | The giant word |
| 6 | 4.5–5.0 | Whip pan left: the giant word streaks out with heavy blur, and the next panel streaks in | whip-pan, motion-blur | The camera's speed |
| 7 | 5.0–7.0 | Three short claims, one per beat pair, each a different size and position on a 3×3 grid ("NO TIMELINE." / "NO KEYFRAMES." / "JUST WORDS.") | kinetic-type, grid-assemble | The last claim |
| 8 | 7.0–8.0 | "JUST WORDS." splits into letters that scatter, then reassemble as the product name | split-and-scatter | The name's letters |
| 9 | 8.0–10.0 | The name holds, centre. Each beat, one letter bounces (a ripple across the name). An accent dot lands after it | overshoot, accent-punctuation | The name |
| 10 | 10.0–12.0 | The colours flip to white. The URL types under the name; the camera eases back slightly | typewriter, holds | — |

## The grammar, in short

- **The beat is the editor.** Every entrance, swap and flip lands on a beat (`S.beat(n)`). Off-beat moves look like mistakes.
- **Type does everything.** Scale, weight, position and colour do the work pictures would. Contrast between neighbours keeps it lively: a tiny word next to a giant one, a left-aligned line after a centred one.
- **Swap, don't replace.** A sentence stays and one word changes, so the eye stays in one place while the meaning moves.
- **Colour flips are cuts.** A whole-frame colour change on a beat is the cleanest hidden cut in this style.
- **Words fly through the camera.** scale-to-fill and whip-pan carry the energy between sections.
- **Never more than 4 words.** If a line needs more, it's two beats.

## Timing targets

- 18–24 moves in 12 s: a change on most beats.
- Arrivals in 0.2–0.35 s (`expo.out`), exits in 0.15–0.25 s (`expo.in`).
- Motion density at least 0.9. Median change is high: the colour flips spike it, and that's intended.
