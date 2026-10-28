# Gallery: Continuous shot: prompt

A 14 s film for an invented site builder, "Paper", where a prompt bar becomes the product. Made by following the `continuous-shot` skill: three concepts, a beat sheet, a build at stage version 2, then `check_sequence` and a contact sheet of the boundaries.

**Concept chosen:** "A prompt bar that becomes the product" (the other two offered: a cursor that opens each screen; one dot that becomes everything).

| time | beat | what moves | what is still | what carries into the next beat |
| --- | --- | --- | --- | --- |
| 0.0 | type | a prompt types itself, the camera pushes in | | |
| 3.4 | send | the cursor presses send, the screen shakes | | cause |
| 3.9 | build | the bar morphs into the browser window the prompt asked for; its page builds in | | same element, new job |
| 7.2 | pub | three tiles gather into a Publish button | | container |
| 8.6 | rest | nothing moves except the cursor settling on the button | everything | declared `tl.rest` |
| 9.4 | press | the cursor presses Publish | | cause |
| 9.9 | live | an iris opens from the button into a Live card | | material state |
| 11.6 | lockup | the card morphs into the wordmark | | same element |

**Checked:** no bare boundaries, a carry score of 1, one declared rest. The shot check does not see everything: its first pass scored an earlier draft of this sample 1.0 while the picture was broken (a missing bar, pips piled up), which a contact sheet caught. Look at the frames as well as the numbers.

**Sound:** the sequence declares its hits (a press, a shake, the iris and the landings) as `data-stage-events`. Add CC0 sounds of one material as audio assets, then run `place_sfx_from_events` to put one at each hit and duck the music. No sounds are bundled with this sample.

| File | What it is |
| --- | --- |
| `build.mjs` | Generates `sequence.html` and `video.miraiclip.json` |
| `sequence.html` | The sequence on its own: paste it into an html clip with `scripted: true` |
| `video.miraiclip.json` | The finished project: one scripted html clip |

Build it with `node build.mjs` (needs `@miraiclip/core` built). Rendering needs an exporter that includes the continuous-shot stage kit: build `@miraiclip/server-export` from this branch until it is released.
