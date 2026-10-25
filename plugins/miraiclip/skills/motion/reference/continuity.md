# Continuity

The difference between a motion-graphics film and a slideshow is continuity: **every beat begins from something already on screen in the beat before.** If you can cover the previous frame with your hand and the new beat still makes sense on its own, it's a slide.

## The test, beat by beat

For every change of beat, write one line: *"<what> from beat N becomes / moves into <what> in beat N+1"*. If you can't fill it in, design a carry-over before writing code.

## Carry-overs, catalogued

| Carry-over | Example | Technique |
|---|---|---|
| Same object, new role | The brand name becomes the label of the app window that grows around it | carry-over, morph |
| Same line, new words | "Still hand-animating" deletes back and "your launch video?" types on the same baseline | retype-in-place, swap-in-place |
| Shape grows into container | A dot becomes a card, the card becomes a window | morph |
| Parts become accents | Grid tiles fly out, and a few become the small squares that punctuate the next line | grid-assemble → accent-punctuation |
| Many become one | Ten orbs collide and merge into the logo | collide-and-merge |
| One becomes many | Five photos are revealed as part of a wall of five hundred | zoom-out-reveal |
| Same element, new framing | The wordmark cuts to an extreme close-up of its last letter | match-cut |
| Into the element | The camera pushes into a card, and the next beat is inside it | zoom-through |
| A path between | A dot travels from "Lead" to "Booked" and the target lights up | path-follow, line-draw |
| The camera itself | A continuous pan that keeps going across a whip into the next panel | whip-pan, parallax |

When nothing can carry over (a genuinely new subject), hide the cut: blur-through (0.25–0.3 s) or whip-pan. Use this once or twice per act at most.

## Keep the anchor still while things change around it

The eye follows one thing at a time. During a hand-off, keep **one** element as the anchor: the caret, the key word, the logo. Move it smoothly while the new beat arrives around it. Changing everything at once reads as a cut, even without one.

## Between acts

A film is a few acts, each one compose_sequence clip. The join between acts follows the same rule:

- **The next act starts where the last one ended.** If act 1 ends on the logo centred at 60% height, act 2's first frame has the logo centred at 60% height (same size, same colour), and act 2 moves on from there.
- Write the end state of each act down (what's on screen, where, what size) before composing the next act, and reproduce it as act 2's starting state with `tl.set(…, 0)`.
- The default join is a 0.3 s dissolve. When the two frames match, the dissolve is invisible and the film reads as one move. Use `join: "cut"` when they match exactly. Use `join: "dip"` only at a real chapter break.
- Keep the camera's motion going across the join: if act 1 ends drifting left, start act 2 drifting left.

## Things that break continuity

- A dissolve between two unrelated layouts.
- An element that pops in from nothing in the middle of an act, with no cause (no line reaching it, no word landing).
- Re-animating a whole sentence to change one word.
- An act that starts on an empty frame and builds from zero (only the very first act may).
- Resetting the camera to a neutral position between beats.
