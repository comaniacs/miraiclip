# Timing

Motion graphics are fast. Most beats are shorter than you think, and the viewer reads faster than you fear, but only a few words at a time.

## Beat lengths

| What | Length |
|---|---|
| A typical beat (one idea, one move) | 0.3–1.2 s |
| Entrance of an element | 0.4–0.7 s (expo.out) |
| Exit | 0.3–0.4 s (expo.in) |
| Move between places, morph, hand-off | 0.5–0.9 s (power3.inOut / expo.inOut) |
| Pop (chips, badges) | 0.35–0.5 s (back.out) |
| Hidden cut (blur-through, whip) | 0.25–0.4 s |
| Stagger between siblings | 0.06–0.12 s (the whole group lands in under 1 s) |
| Typing | 10–14 characters per second |
| Camera move | as long as the beat, or longer, overlapping the next beat |
| An act | 8–25 s, with a beat every 0.6–2 s |

As a rough guide, a 13–14 s launch film has about 14 beats.

## Reading budget

- **Up to 7 words on screen at once.** Split anything longer across beats, or retype in place.
- A line needs about **0.3 s per word plus 0.5 s** on screen, fully legible, before it changes. A 4-word line: about 1.7 s from landing to leaving.
- Count from when the last word has landed, not from when the first one starts.
- Numbers and names need more time than words: add 0.3 s for each.

## Holds

A hold is reading time, not a frozen frame.

- Nothing on screen may be fully still for more than **0.8 s**. During a hold, keep one small thing moving: a slow camera push (3–6%), a drift, a blinking caret, a breathing accent (holds).
- The end card may hold up to **1.5 s**, with a slow drift.
- If a hold feels long, the beat is too long. Shorten it, don't add decoration.

## Motion targets

The film is checked against these, measured on small greyscale frames at 10 fps (frame-to-frame change on a 0–255 scale):

| Metric | Target for motion-graphics briefs |
|---|---|
| Motion density (share of steps with visible change) | ≥ 0.85 |
| Median change per step | ≥ 1.5 |
| Holds with no visible change | none over 0.8 s (end card: up to 1.5 s) |
| Jumps (one big change with calm frames on both sides) | only where you meant a cut |

For reference, a well-made 13 s launch film measures density 0.99 with a median change of 3.5. Slide-like films with dissolves measure about 0.6 and 0.8, with several dead holds.

Documentary-paced films have lower targets (density ≥ 0.6, median change ≥ 0.6, no hold over 2 s), but the camera still keeps moving, except in rests you declare with `tl.rest`.

## Fixing what the checks find

`compose_sequence` measures each act after placing it (its `motion` line and `problems`), and `preview_film` measures the whole film (`motion`, `motionProblems`, and the `stillest` acts or scenes). Each finding has a fix:

| Finding | What it means | Fix |
|---|---|---|
| "nothing moves 4.2–5.6 s" | A hold: every element has landed and the camera has stopped | Keep a slow camera move running across the beat (a push of 4–8%, a drift, a tilt). Give the landed elements a breathing move (holds). Or start the next beat sooner. Look at the act's script at that time: usually a `tl.camera` ends early, or the next label starts too late |
| "62% of the time something visibly moves" | Too much of the act is still between moves | Overlap the beats: start each move before the last one ends (`"<+=0.3"`, `"label-=0.2"`). Make the camera moves long and overlapping, so one is always running |
| "motion is faint: median change 0.8" | Things move, but too little to see at a glance | Move further (5–20% of the frame, not 1–2%). Scale more (0.8 → 1, not 0.97 → 1). Move several elements at once, or a big one. A slow drift alone reads as still |
| "a hard jump at 3.0 s" | One frame changes a lot with calm on both sides: an unhidden cut or a `tl.set` that swaps a big element | Hide it: blur-through, zoom-through, whip-pan or a match cut. Or animate into the change instead of setting it |
| "9 words on screen at 2.4 s" | Too much to read at once | Split the line across two beats, or clear the last beat's words before the new ones arrive |
| "beat … adds 8 words but lasts 1.0 s" | Not enough time to read them | About 3.5 words a second plus half a second. Lengthen the beat, or cut words |

Fix with `compose_sequence` and `replace: "<act id>"`, then check the new `motion` line.

## Rhythm

- Vary beat lengths: three quick beats (0.4–0.6 s) then a longer one (1.2 s) reads as rhythm. Equal beats read as a metronome.
- Put the strongest move on the beat where the music hits (when there's a beat grid, use `S.beat(n)` for positions).
- Let the act end on motion that hands off (a drift, a push), not on a full stop. The only exception is the film's final frame.
