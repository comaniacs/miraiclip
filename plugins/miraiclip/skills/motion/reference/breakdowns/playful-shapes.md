# Breakdown: playful shapes intro (15 s)

A grammar study of a style, not a description of one particular film: the bright, bouncy intro, where soft 3D-ish shapes are the characters. Orbs, pills and blobs drift, bounce, gather and merge, and the brand is what they become. It suits an introduction to a service, a friendly launch, or a feature for a broad audience.

Use it to learn the grammar. Build your own film's version of each idea; don't copy the beats.

## Look

- **Background:** a light, saturated-but-soft ground (pale lilac, mint, butter) or a deep night blue for a glowing version. Soft colour blooms behind.
- **Shapes:** spheres with a highlight (a radial gradient from a light spot to the colour) and a soft shadow or glow. 4–8 colours from one cheerful palette, plus the brand's colour for the hero shape.
- **Type:** a rounded or geometric sans, bold, short lines. Labels sit on or under the shapes.
- **Depth:** shapes sit at different scales and blur levels (near ones bigger and sharper), and the camera tilts gently, so the field feels 3D.
- **Words on screen:** 2–5.

## Beats

| # | Time | What happens | Technique | Carried into the next beat |
|---|---|---|---|---|
| 1 | 0.0–1.2 | Orbs pop in one by one at scattered positions, each with an overshoot and a focus-in. Each carries a label: the jobs a small business juggles | pop-in, overshoot, staggered-entrance | The orbs |
| 2 | 1.2–3.0 | The orbs drift, each at its own speed and scale (depth). The camera floats and tilts a few degrees. A line above: "Seven apps. Seven logins." | parallax, depth-stack, kinetic-type | The orbs' drift |
| 3 | 3.0–3.6 | Anticipation: every orb pulls back slightly outwards | anticipation | The tension |
| 4 | 3.6–4.4 | They rush to the centre and collide. A squash-and-stretch on impact, a flash, one big orb in the brand colour | collide-and-merge, motion-blur | The big orb |
| 5 | 4.4–5.6 | The big orb settles with a wobble (elastic). The brand name pops onto it. A soft hit in the music | overshoot, pop-in | The big orb |
| 6 | 5.6–8.5 | The old orbs come back as small satellites orbiting the big one. Each satellite now shows a feature, connected | orbit | The orbit |
| 7 | 8.5–10.5 | The camera follows one satellite and pushes into it. It opens into a rounded card showing the feature (a simple UI drawn in shapes) | zoom-through, morph | The card |
| 8 | 10.5–12.5 | The card's elements bounce in one by one (a toggle flips, a chip pops, a checkmark draws) | pop-in, line-draw | The card |
| 9 | 12.5–15.0 | Pull back: the card shrinks back into a satellite, and the whole system is visible again. The URL rises under it; the satellites keep orbiting | zoom-out-reveal, mask-reveal, holds | — |

## The grammar, in short

- **Shapes are characters.** They have weight: they anticipate before a big move, overshoot when they land, and squash on impact. That gives the film its personality.
- **The story is a transformation.** Many things become one (collide-and-merge), and the one gives back the many as connected parts (orbit). That is the whole argument of an all-in-one product, told without a sentence.
- **Depth makes it rich.** Scale and blur by distance, plus a slowly tilting camera. Flat shapes on a flat field look like clip art.
- **Bouncy but controlled.** Use `back.out` and `elastic.out` on landings, and `sine.inOut` on drift. Elastic goes only on the hero moment; elastic everywhere is seasick.
- **Always something floating.** Between beats the shapes keep drifting, so a hold never freezes.

## Timing targets

- 9–12 beats in 15 s.
- Landings take 0.4–0.7 s, drifts are continuous, and the collide is fast (0.5–0.8 s, `expo.in`).
- Motion density at least 0.9. No hold over 0.8 s except the final 1.5 s, which still orbits.
