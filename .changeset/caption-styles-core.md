---
"@miraiclip/core": patch
---

Caption styles grow optional decorations: `display: "word"` (word-by-word), `textTransform`, outline (`strokeColor`, `strokeWidthFrac`), drop shadow / glow (`shadowColor`, `shadowBlurFrac`, `shadowOffsetFrac`) and `activeBackgroundColor` (a box behind each emphasized word), plus a `reveal` preset (words appear as spoken). All optional, so existing documents are unchanged; `clip/set-property` clears any of them (and `backgroundColor`) with `null`. Caption `words` can now be replaced with `clip/set-property`. New pure helpers `captionsToSrt`, `captionsToVtt`, `captionsToText` and `retimeWords`. Font assets accept `weightRange` for variable fonts.
