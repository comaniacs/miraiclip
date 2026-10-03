---
"@miraiclip/core": patch
---

`clip/set-property` edits an html clip's code: `template` replaces the markup, `unsetParams` drops params the new markup no longer uses, and `widthPx` / `heightPx` change the raster size (`null` clears back to the composition size). The clip keeps its id, keyframes, effects and transitions.
