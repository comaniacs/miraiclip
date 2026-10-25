---
name: motion
description: The motion-graphics grammar for compose_sequence acts — continuity, hidden cuts, a moving camera, kinetic type — plus about 30 atomic techniques with working stage-kit code. Load it before composing any act.
---

# Motion

A film made from a brief should read as **one continuous move**, not slides. This skill is the grammar for that, and a library of techniques you combine inside compose_sequence acts. Each technique is a file with what it is, when to use it, its timing, the usual mistake, and a working snippet (markup, CSS, and the body of `stage.build((tl, S) => { … })`). Read one with `read_skill_file` (skill `motion`, path `reference/rules/<name>.md`), adapt it to your act, never paste it unchanged.

## The grammar in short

1. **Every beat grows out of the last one.** A title becomes a window's label. Tiles become accents. Five photos become five hundred. Nothing appears from nowhere inside an act. See `reference/continuity.md`.
2. **Hidden cuts only.** When something must change completely, hide the cut:
   - inside a 0.2–0.3 s blur (blur-through);
   - in a push into an element (zoom-through);
   - in a whip (whip-pan);
   - or on the same element at two framings (match-cut).

   Never dissolve one full layout into another.
3. **The camera never stops.** Push, pull, pan with the type, tilt in depth, untilt to resolve. A beat with a still camera needs something else moving. See `reference/camera.md`.
4. **Type is the main actor.** Lines type, retype in place, rise from masks and swap words. The key word is in the accent colour. Never more than about 7 words on screen.
5. **One accent colour.** Use it on the key word, the small accent shapes and the end dot, and nowhere else.
6. **Blur on every fast move** and a soft focus-in on every new element (motion-blur).
7. **Short beats.** Most beats last 0.3–1.2 s. Holds are for reading, and they stay alive. See `reference/timing.md` for beat lengths, the reading budget and the motion targets.
8. **The easing set.** expo.out in, expo.in out, power3.inOut / expo.inOut to move between places, back.out for pops, sine.inOut for drift (easing-tokens).

## How to build an act with these

1. Write the act's beats first: each beat is one idea, one move, and what it hands to the next beat.
2. For each beat, pick **one** main technique from the index, plus a carry-over into the next beat. Two or three techniques at once is noise.
3. Name every beat with `tl.label(…)`, and put each beat's moves at its label. compose_sequence shows the beats on the timeline and checks the layout just after each one.
4. Keep the camera moving across the whole act: one long `tl.camera(…)` per beat, overlapping the next.
5. Look at the filmstrip compose_sequence returns. Check that every frame has something moving, that the hand-offs are visible, and that nothing is off-frame. Fix with `replace`.

## Things the stage kit does for you, and things to remember

- Sizes in the script come from `S.w(%)`, `S.h(%)` and `S.min(%)`, so the act fits 16:9, 9:16 and 1:1. In CSS, use container units (cqw, cqh, cqmin).
- The timeline owns `transform` on everything it animates. Centre elements with a grid wrapper, or with margins, never with a CSS `transform: translate(-50%, -50%)` on an animated element.
- `S.split(sel, "words" | "chars")` wraps each word or character in a span (`.word` / `.char`) and returns them in reading order. Styled children such as `<em>` stay, with their own words split inside them.
- For randomness, use `S.rand(seed)`: the same frames on every render. Measuring the DOM (`offsetLeft`, `getBoundingClientRect`) is fine: fonts have loaded when the script runs.
- Tween colours to real colour values (hex or rgb), not `var(--…)`.
- Elements outside `.world` (a `.hud` layer) don't move with the camera.

## Techniques

| Technique | What it is / when |
|---|---|
| `accent-punctuation` | An accent square or dot jumps to the end of each word as it lands |
| `anticipation` | A small counter-move before a big fast move |
| `blur-through` | A hidden cut: the beat blurs out as the next blurs in |
| `carry-over` | The last beat's element becomes part of the next (title → window label) |
| `collide-and-merge` | Many elements converge and become one (tools → platform) |
| `count-up` | A number rolls up on digit reels; for real stats only |
| `depth-stack` | Cards fan out in depth while the camera tilts |
| `easing-tokens` | The five eases and what each one is for |
| `grid-assemble` | Tiles fly in to a grid, then a highlight wave keeps it alive |
| `highlight-sweep` | A marker bar sweeps behind the key word |
| `holds` | Reading time that stays alive: push, drift, a breathing accent |
| `kinetic-type` | Words punch in one at a time; the key word lands in the accent |
| `line-draw` | A line draws at a steady rate; nodes pop as it reaches them |
| `mask-reveal` | Lines rise from behind an invisible edge |
| `match-cut` | A hard cut between two framings of the same element |
| `morph` | One shape grows into the next container (dot → card → window) |
| `motion-blur` | Blur that peaks with speed on every fast move |
| `orbit` | Satellites circle a hub, with labels kept upright |
| `overshoot` | Landing past the mark and settling (back.out / elastic.out) |
| `parallax` | Layers drift at different speeds to show depth |
| `path-follow` | An arc from A to B with separate x and y eases |
| `pop-in` | Chips and badges appear with an overshoot and focus-in |
| `retype-in-place` | A typed line deletes and a new one types on the same baseline |
| `scale-to-fill` | A word grows until it bleeds past both edges |
| `split-and-scatter` | Letters fly apart, or assemble from scattered positions |
| `staggered-entrance` | A list enters item by item with one shared move |
| `swap-in-place` | One word in a fixed sentence slides out and the next slides in |
| `typewriter` | Characters type with a caret that follows |
| `whip-pan` | A very fast blurred camera move to the next panel |
| `wipe` | A clip-path wipe with an accent bar riding the edge |
| `zoom-out-reveal` | The camera pulls back to show the few are part of many |
| `zoom-through` | The camera pushes into an element and the next beat is inside it |

## More reading

- `reference/continuity.md`: carry-overs, catalogued, and how one act hands off to the next.
- `reference/timing.md`: beat lengths, the reading budget, holds, and the motion targets the film is checked against.
- `reference/camera.md`: the `.world` layer, camera moves and their sizes.
- `reference/breakdowns/`: grammar studies of finished films, beat by beat (what happens, the technique, what carries over). Read one with `read_skill_file` when you want to see how a whole film is put together; borrow its grammar, not its content or look.
