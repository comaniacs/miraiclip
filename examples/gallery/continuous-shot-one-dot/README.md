# Gallery: Continuous shot: one dot

A 14 s film for an invented habit app, "Tally", where one element transforms through the whole film. Made by following the `continuous-shot` skill: three concepts, a beat sheet, a build at stage version 2, then `check_sequence` and a contact sheet of the boundaries.

**Concept chosen:** "One element that transforms through the whole film" (the other two offered: a cursor that opens each screen; a camera that falls into each detail).

| time | beat | what moves | what is still | what carries into the next beat |
| --- | --- | --- | --- | --- |
| 0.0 | spark | a dot drifts to the centre, the camera follows | persistent ground | the dot |
| 1.9 | ring | the dot morphs into a ring | | same element, new job |
| 3.8 | week | the ring morphs into Monday's cell, six more cells arrive | | same element |
| 5.6 | fill | six pips pop into the week, then gather into a streak bar | | container |
| 7.8 | rest | nothing moves except the cursor settling on the button | everything | declared `tl.rest` |
| 8.6 | press | the cursor presses Log it, the screen shakes | | cause |
| 9.2 | confirm | an iris opens from the button into a Done card | | material state |
| 11.0 | lockup | the card morphs into the wordmark | | same element |

**Checked:** no bare boundaries, a carry score of 1, one declared rest. The shot check does not see everything: its first pass scored an earlier draft of this sample 1.0 while the picture was broken (a missing bar, pips piled up), which a contact sheet caught. Look at the frames as well as the numbers.

**Sound:** the sequence declares its hits (a press, a shake, the iris and the landings) as `data-stage-events`. Add CC0 sounds of one material as audio assets, then run `place_sfx_from_events` to put one at each hit and duck the music. No sounds are bundled with this sample.

| File | What it is |
| --- | --- |
| `build.mjs` | Generates `sequence.html` and `video.miraiclip.json` |
| `sequence.html` | The sequence on its own: paste it into an html clip with `scripted: true` |
| `video.miraiclip.json` | The finished project: one scripted html clip |

Build it with `node build.mjs` (needs `@miraiclip/core` built). Rendering needs an exporter that includes the continuous-shot stage kit: build `@miraiclip/server-export` from this branch until it is released.
