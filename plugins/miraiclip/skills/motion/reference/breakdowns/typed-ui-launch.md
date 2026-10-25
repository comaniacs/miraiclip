# Breakdown: typed-UI launch film (13.4 s)

A light, minimal product launch film for an AI video tool, 13.4 s at 16:9. It reads as one continuous move: every idea grows out of the one before it, the camera never stops, and the cuts are hidden inside blurs and zooms.

This file describes the film's grammar: timing, techniques, what carries over at each change, and how it measures. It is not code to copy. Use it to understand how a film like this is built, then build your own film's version of each idea.

## Look

- Background: warm off-white paper (#f7f6f2-ish), with very soft colour blooms (pale blue and pink) drifting in the corners.
- Type: one geometric sans, regular weight, dark grey-black. The key word of each line is set in one blue accent (#3b6cf6-ish), sometimes as a gradient.
- Accent objects: small blue squares, and one blue dot at the very end.
- Imagery: soft product UI panels (editor screenshots, almost unreadable, used as texture) and, late in the film, a set of vivid photographic thumbnails. The photos are the only saturated thing in the film.
- Words on screen: never more than 6 at once.

## Beats

| # | Time | What happens | Technique | Carried into the next beat |
|---|---|---|---|---|
| 1 | 0.0–2.1 | "Still hand-animating" types in, about 10 characters/s, with a caret. The second half is in the blue accent. The line fades and sharpens in over 0.3 s. From 1.0 s, blurred UI panels drift in around the edges. The camera eases back (the type shrinks from about 1.35× to 1×). | Typewriter; blur-in; slow pull-back; depth blur on background texture | The line's position and the caret |
| 2 | 2.2–4.4 | The line is replaced in place: "your launch video?" types in, with "video?" in blue. The caret blinks at the end for about 1 s. The panels keep drifting. | In-place retype (same baseline, same caret) | The whole frame |
| 3 | 4.3–4.8 | The whole frame blurs out over 0.3 s into the paper and its colour bloom. The brand name blurs in, small, in a soft gradient. | Blur-through transition (the cut is hidden inside the blur) | The brand name |
| 4 | 4.8–5.2 | The brand name becomes the label of the app's window: the window appears around it, tilted in perspective (about 8–10°), and the camera is already rotating. | **Carry-over**: the name becomes part of the next object; 3D tilt | The window, the tilt |
| 5 | 5.2–5.9 | Very close on the tilted window, "Hello, Sri." types in blue italic, then "What are we shipping today?" types in grey. The camera pans right with the typing, so the text slides across the frame at an angle. | Camera follows the typing; extreme close-up; perspective | The question and the camera move |
| 6 | 5.9–7.0 | Option cards slide in under the question one after another ("Ship the demo", "Cut a launch video", "Render the changelog", "Draft the release post"). The camera keeps panning across them. | Staggered entrance during a camera move | The window |
| 7 | 7.0–7.9 | The camera pulls back and un-tilts: the window flattens and shrinks to a small card in the centre, then blurs out. | Pull-back reveal; perspective resolves to flat | The centre of the frame |
| 8 | 8.1–8.9 | A grid of small tiles (template thumbnails) blurs in at the centre, with four dark labelled cards around it. The tiles flicker between blue and grey as if being browsed. | Blur-in; living texture (tiles keep changing) | The tiles |
| 9 | 8.9–9.5 | The grid collapses: tiles fly out and a few become small blue squares that move with the text. "Turn your product into video" types word by word, with "video" in blue, while the squares jump alongside like punctuation. The dark cards drift outwards. | Elements **transform** into the next beat's accents; kinetic words | The centre column |
| 10 | 9.6–10.8 | Five photos fly in with motion blur and lock into a staggered column. A chip, "5 components", pops in over them (blur to sharp). | Motion-blurred fly-in; pop | The photo grid |
| 11 | 10.9–11.1 | A hard zoom out: the five photos are revealed as part of a wall of many more, and the chip now says "500 components". | **Zoom-out reveal** with the counter changing (the same object, bigger idea) | The whole frame |
| 12 | 11.2–12.3 | The wall blurs out. The brand wordmark is set huge, bleeding past both edges. Its colour sweeps from pale grey-blue to navy to near-black, left to right. | Scale-to-fill; colour sweep | The wordmark |
| 13 | 12.4–13.1 | A match cut to an extreme crop of the wordmark's last letter and the blue dot. It holds with a slight drift. | **Match cut on the same element** (wide → detail) | — |
| 14 | 13.2–13.4 | Blur and fade out. | Blur-out | — |

## The grammar, in short

- **Beats are short.** 14 beats in 13.4 s: most last 0.3–1.2 s. The longest holds are about 1 s, on the two questions.
- **Every change has a carry-over.** It might be the same line retyped, the brand name becoming the window label, tiles becoming squares, five photos becoming five hundred, or the wordmark becoming its own crop. Nothing just appears from nowhere.
- **Hidden cuts.** Where a hard change is needed, it happens inside a 0.2–0.3 s blur (beats 3, 7, 11–12), or as a match cut on the same element (beat 13). No dissolves between unrelated layouts.
- **The camera is always moving:** pull-back, rotation, pan with the type, untilt, zoom-out. It moves in depth (tilt and perspective), not just in 2D.
- **Type is the main actor.** Lines type in with a caret, the key word is in the accent colour, and lines are replaced in place.
- **Texture, not information.** The UI panels are atmosphere; nobody is meant to read them.
- **One accent colour,** used on the key word, the small squares and the final dot.
- **Motion blur on every fast move,** and a blur-in on every new element.

## How it measures

Measured on 192×108 greyscale frames at 10 fps (`plan/sequences.md` → motion metrics):

| Metric | Value |
|---|---|
| Motion density (share of steps with visible change) | 0.99 |
| Median change per step (0–255 scale) | 3.5 |
| Holds over 0.8 s with no visible change | none |
| Jumps (a big single-step change with calm frames either side) | none |

For comparison, a recent slide-like film made by the assistant (centred cards, about 4 s each, dissolves) measured density 0.63, median change 0.76, and 5 holds over 0.8 s. A 90 s documentary-style film measured 0.32, 0.45 and 17 holds.
