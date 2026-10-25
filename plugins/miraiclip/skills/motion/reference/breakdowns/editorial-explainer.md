# Breakdown: editorial explainer (20 s)

A grammar study of a style, not a description of one particular film: the magazine-style explainer. Cut-out pictures and labels sit on a clean editorial grid, a rail draws the argument across the frame, and the camera tracks along it. It explains one idea in a few steps, and every step is attached to the line that runs through the film.

Use it to learn the grammar. Build your own film's version of each idea; don't copy the beats.

## Look

- **Background:** off-white paper, with a faint 12-column grid or dot grid. Hairline rules in a warm grey.
- **Type:** a serif for headlines (big, tight, sentence case) and a small sans in caps for labels and numbers ("01", "STEP", "SOURCE").
- **Colour:** one strong accent (a red, cobalt or green) for the rail, key words and markers. Everything else is ink on paper.
- **Pictures:** cut-outs (subjects with their background removed) or tightly cropped photos in hard-edged frames, often duotoned into the ink and accent. Small captions next to them.
- **Words on screen:** a headline (5–8 words) plus labels. Never paragraphs.

## Beats

| # | Time | What happens | Technique | Carried into the next beat |
|---|---|---|---|---|
| 1 | 0.0–1.8 | The question is set as a headline. It rises line by line from a mask, and the key word is underlined in the accent as it lands | mask-reveal, highlight-sweep | The underline |
| 2 | 1.8–3.0 | The underline stretches past the headline and becomes the rail: a line that draws to the right edge. The camera starts to track along it | morph, line-draw | The rail and the camera's track |
| 3 | 3.0–5.5 | The first node on the rail pops. A cut-out picture slides up behind it with a label ("01 · Collect") and a one-line caption. Slight parallax: the picture moves slower than the label | pop-in, staggered-entrance, parallax | The rail |
| 4 | 5.5–8.0 | The rail keeps drawing. Node 2 pops, and a second cut-out and label arrive from the opposite side, so the frame stays balanced while tracking | line-draw, staggered-entrance | The rail |
| 5 | 8.0–10.5 | Node 3. The picture is a diagram instead: three small boxes joined by lines that draw | line-draw, grid-assemble | The diagram's middle box |
| 6 | 10.5–12.0 | The camera pushes into the middle box. It fills the frame and becomes the next scene's background panel | zoom-through | The panel |
| 7 | 12.0–15.0 | Inside the panel, a real figure counts up, with its unit and source label. The key word of its caption gets the marker sweep | count-up, highlight-sweep | The figure |
| 8 | 15.0–17.0 | The camera pulls back out through the panel. The whole rail is visible at once, all nodes lit: the argument at a glance | zoom-out-reveal | The full rail |
| 9 | 17.0–20.0 | The rail curls into an underline under the answer (the headline's own words, now resolved). It holds and drifts | morph, holds | — |

## The grammar, in short

- **One line runs through the film.** The rail is the protagonist: it starts as an underline, carries the steps and ends as an underline. Every step hangs off it.
- **Track, don't cut.** The camera follows the line sideways (a long, slow `x` move on `.world`), so new material enters from the frame edge as if it was always there.
- **Balance alternates.** Content arrives above, then below the rail, or left then right, so the frame never tips.
- **Labels make it editorial.** Small caps, numbers and sources next to every picture. They are what make a frame read as "explained" rather than "decorated".
- **One push in, one pull out.** A single zoom-through into a detail and back is the film's big move. More than one gets dizzying.
- **Markers instead of colour floods.** The accent appears as lines, dots and sweeps behind words.

## Timing targets

- 8–10 beats in 20 s; steps take 2–3 s each, because labels need reading time.
- The rail draws at a steady rate (`linear`); everything else eases `expo.out`.
- Motion density at least 0.85, from the constant tracking. No hold over 0.8 s apart from the final 1.5 s.
