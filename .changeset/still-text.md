---
"@miraiclip/renderer": minor
---

Vector-PDF support: `describeStillText(project, { timeUs })` returns every visible text clip's lines (text, x, baseline, width) with its font, color, outline, letter spacing and a local → output `matrix`, laid out by the same compositor and text metrics the canvas uses, plus `rasterReasons` when the text should stay in the picture (covered by another clip, effects, a shadow, typing, a transition). `renderProjectStill` takes `omitClipIds` to draw a page without those clips, and `withoutClips(project, ids)` gives the same copy. Text nodes expose `describeText()` and the compositor `getTextLayout(clipId)`.
