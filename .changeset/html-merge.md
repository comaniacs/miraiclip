---
"@miraiclip/html-composition": minor
---

`mergeHtml(base, ours, theirs)`: a three-way, element-by-element merge of two edits of one html clip (attributes, each inline style property, own text, place, existence), so concurrent edits to different elements both survive. Same-thing conflicts keep `ours` and are counted.
