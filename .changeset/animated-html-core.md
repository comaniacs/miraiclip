---
"@miraiclip/core": patch
---

Html clips take `animated: true` (on `clip/add` and `clip/set-property`) to re-rasterize every frame so CSS animations inside the template play and export frame-exactly; `clip/split` sets `animationOffsetUs` on the right half so the animation continues across the cut.
