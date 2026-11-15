---
"@miraiclip/renderer": minor
"@miraiclip/server-export": patch
---

`describeStillText` now also returns `clips`: every visible clip at that moment, bottom to top, each with its kind, z, matrix (local to output pixels), opacity, box and raster reasons (`covered`, `effects`, `transition`). With it, a caller can draw more than text itself (shapes as SVG in a vector PDF) and decide what's really covered when it draws some of the covering clips too. server-export's harness carries it.
