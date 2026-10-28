# Beat sheet

Write the sheet before any HTML. It is the plan the shot is built and checked against. Show it to the user before building.

## Template

| time | beat | what moves | what is still | what carries into the next beat |
|---|---|---|---|---|

- **time**: start, in seconds; the last row is the end. Vary beat lengths: a film of equal beats reads as a metronome (the check warns under 0.25 variation).
- **beat**: a name, which becomes the `tl.label`.
- **what moves**: the subject and the camera.
- **what is still**: only elements in a declared `tl.rest`, or the persistent ground. Everything else moves, or says why not.
- **what carries**: which carry type (see `carry-types.md`) and which element survives.

Rules for the sheet:
- Row 1 is the hook: the first second shows something moving that makes a viewer ask what it is.
- Include at least one rest before the payoff, written as `rest 7.4–8.5` with what is allowed to move inside it.
- The last row is the lockup: the cast folds into the logo or name. Nothing new arrives.
- No row may say "cut" unless it is a deliberate `tl.cut`; give it a reason.
- Words: at most about 7 on screen at any time.

## Worked example: a 14 s film for "Kiln", an invented app that schedules pottery studio time

| time | beat | what moves | what is still | carries |
|---|---|---|---|---|
| 0.0 | spark | a glowing dot drifts across a dark dot-grid, camera follows | the grid | persistent ground; the dot is the subject |
| 1.6 | pot | the dot grows and morphs into a rounded vase silhouette; grid parallax shifts | none | same element, new job (morph) |
| 3.4 | slot | the vase hops to the first slot of a weekly calendar that unrolls from its base | the calendar frame | same element hops onto the calendar |
| 5.4 | fill | six more vases gather into the week; camera pulls back to show it | none | container (gather) |
| 7.4 | rest | nothing moves except the cursor's idle blink | everything but the cursor | rest 7.4–8.5, allow `.cursor` |
| 8.6 | press | the cursor presses "Book"; button squashes, screen shakes once | none | cause (press, shake, hit) |
| 9.2 | confirm | an iris opens from the button into a confirmation card | none | material state (iris) |
| 11.0 | lockup | the card folds into the wordmark "Kiln" on the grid | the grid | same element (morph) into the logo |
| 13.0 | end | a slow handheld float, URL fades in | the wordmark | none; end hold under 1.2 s counts as exempt |

Sheet checks: beat lengths 1.6, 1.8, 2.0, 2.0, 1.2, 0.6, 1.8, 2.0, 1.0 (varied); one rest, declared; every boundary names a carry; hook at 0; lockup at 11.
