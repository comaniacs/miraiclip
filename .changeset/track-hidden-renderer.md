---
"@miraiclip/renderer": patch
---

Hidden tracks aren't drawn: the compositor skips their clips in preview, exports and stills, and `getClipBounds` / `hitTest` ignore them. Sound still follows `muted`.
