---
name: direction
description: Direct a film from a brief before building it — the world or metaphor, the protagonist element and how it evolves, acts and a timed beat sheet with the technique and carry-over for each beat, the words per beat, the look and the music direction. Load it first for any film made from a brief.
---

# Direction

A film that feels made, not assembled, was directed first. Before any tool that builds, write a **treatment**: one page that decides what the film is, and what happens on screen second by second. Then the look (`look` skill), the media and music (`media-sound`), and the acts (`sequence-core` + `motion`) follow from it.

## 1. The idea

- **The world.** One sentence: what world the film lives in, a metaphor taken from the subject.
  - A CRM's tools are planets that collide into one.
  - A course on agents is a live agent console.
  - A recipe book is a kitchen notebook.
  - A city break is a route drawn on a map.

  Not "a modern, clean video".
- **The protagonist element.** One thing on screen that the film follows and transforms. This is what makes a film continuous instead of a slideshow. Examples:
  - ten orbs drift, collide and become one logo, which becomes a window, which opens into the product;
  - a cursor types a question, the question becomes a search bar, the results become the film's chapters;
  - a line draws a route, stops become chapters, and the route closes into the logo.

  Write the chain: element → what it becomes → what that becomes.
- **The promise.** What the viewer should know or feel at the end, in one line. Every beat serves it.

## 2. Acts and beats

- **Length:** what the user asked for, within 10%. Otherwise:
  - 15–30 s for a launch, promo or intro;
  - 30–45 s for a trailer;
  - 45–90 s for a documentary.
- **Acts:** 2–4 acts of 8–25 s, each one `compose_sequence`. An act is one movement of the idea. A 15 s film is one or two acts.
- **Beats:**
  - 0.5–2 s each in motion graphics; 3–6 s in a documentary.
  - Each beat is **one idea and one move**, and says something new.
  - Each beat begins from something the last beat left on screen.

Write the beat sheet as a table, one row per beat:

| Time | Beat (what it says) | On screen (what moves) | Technique | Carries into the next |
|---|---|---|---|---|
| 0.0–1.4 | Ten tools. Ten bills. | Six orbs drift in, labels on; the line types above | staggered-entrance, typewriter | The orbs |
| 1.4–2.6 | One place. | The orbs accelerate inwards, collide, one big orb | collide-and-merge | The big orb |
| … | | | | |

- **Techniques** come from the `motion` skill's index. Pick one main technique per beat.
- **Carry-over** is the element that bridges to the next beat: a word, a shape, a picture, a colour, the camera's move. If a row has no carry-over, the cut must be hidden (blur-through, zoom-through, whip-pan, match-cut), or the beat must change.
- **Words:** at most about 7 words on screen per beat, and a reading budget of about 3–4 words a second plus half a second. Real material only: no invented people, numbers, reviews or quotes. Every word on screen is in the beat sheet.

## 3. The arc by format

Use these as guides. Reorder, merge or add the beats the brief needs.

- **Launch / promo / intro:** the viewer's problem (concrete, visual) → the turn (the product appears, out of the problem) → 2–4 things it does, shown in action → proof (a real number or name) → the call to action.
- **Course:** the learner's goal → the course (level, length, format) → what you learn → a lesson moment → what you build → who teaches (only a real, named instructor) → what you leave with → how to join.
- **Explainer:** the question → the idea, drawn → the steps, each growing from the last → the result.
- **Trailer:** a quiet cold open → the title → who → the stakes → a build of short hits → the title reveal.
- **Documentary:** cold open → title → chapters of stills, people, facts and quotes → the reveal. Slower beats, still moving.

## 4. Look and sound direction

In the treatment, name:

- **The look**, in one line: palette, type and finish from the subject (`look` skill), and the grid and picture treatment.
- **The camera's character**: floating and tilting (playful), pushing and whipping (energetic), slow pushes and drifts (reflective).
- **The music**: mood, tempo and where it hits (the collide, the title reveal), and the sound effects for the big moves (`media-sound`).

## 5. Learn from breakdowns

The `motion` skill's `reference/breakdowns/` are grammar studies of whole films. Read the one closest to your brief with `read_skill_file`, and borrow its grammar, never its words or look:

| Breakdown | What to borrow |
|---|---|
| `typed-ui-launch.md` | Typed type (typewriter, retype-in-place); a title becoming a window (carry-over, morph); blur-through cuts; zoom-out-reveal from five to five hundred; scale-to-fill and match-cut on the wordmark |
| `editorial-explainer.md` | A rail or timeline that draws (line-draw); labelled cut-outs that slide on an editorial grid (staggered-entrance, parallax); highlight-sweep on key terms; zoom-through into a detail |
| `kinetic-type-promo.md` | Words as the whole picture (kinetic-type, swap-in-place, scale-to-fill); cuts on the beat; whip-pan between statements; accent-punctuation |
| `documentary-trailer.md` | Slow push and parallax on stills; mask-reveal titles; blur-through between chapters; a count-up for a real figure; holds that stay alive |
| `playful-shapes.md` | Shapes as characters (pop-in, overshoot, orbit); collide-and-merge into the brand; split-and-scatter; depth-stack and a tilting camera |

## 6. Check the treatment

Before building, check that:

- the world and the protagonist element come from *this* subject, not a template;
- the chain of transformations runs from the first beat to the last;
- every beat has one idea, a technique and a carry-over (or a hidden cut);
- the words are real, and at most about 7 per beat;
- the length adds up to what was asked;
- the end lands: the promise, then a held end card (at most 1.5 s, still drifting).

## 7. Record it, show it, then build

1. `plan_film`, with the look and the concept taken from the treatment:
   - idea = the world;
   - motif = the protagonist element;
   - layout = the grid;
   - motion = the camera's character.
2. `direct_film` with the treatment: the world, the promise, the protagonist chain, the camera, the music (mood, and tempo if known), and the acts with their beats. For each beat give its time, the exact words on screen, what moves, the technique and the carry-over.
   - It checks the treatment (lengths, words, reading time, techniques, carry-overs) and refuses it with the fixes when something is off.
   - When it accepts the treatment, it returns a storyboard that the user sees in the chat.
3. **Wait for approval.** Unless the user said to just make it, end your turn there. Summarise the world, the protagonist chain and the acts in two or three lines. The chat offers **Approve & build** and **Change direction**.
   - If the user asks for changes, revise the treatment and call `direct_film` again.
   - The acts can't be built until the treatment is approved.
4. After approval:
   - get the pictures (`media-sound`);
   - add the music and take its beat grid (`get_beat_grid`), which snaps the beats to the music;
   - compose one `compose_sequence` per act, in order, each starting where the last ended, and fix each act from its filmstrip before the next;
   - place the sound effects on the big moves;
   - check the whole film with `preview_film`.

In your reply, give the world and the protagonist chain in one line each, then the acts and their beats in one line each.

`reference/treatment.md` is a blank treatment to fill in, with a worked example.
