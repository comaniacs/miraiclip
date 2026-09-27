---
"@miraiclip/core": minor
---

Typography for text and caption clips. Text clips take optional `fontWeight` (100–900, steps of 100), `fontStyle` (`"normal"` | `"italic"`), `lineHeight` (multiple of font size), `letterSpacing` (em, so it scales with font size), and `textAlign` (`"left"` | `"center"` | `"right"`, lines within the block — independent of the anchor); caption `style` takes the same minus `textAlign` (caption lines stay centered). Font assets take `weight` and `style` descriptors — add one asset per face. `clip/add` and `clip/set-property` accept every field; in `set-property`, `null` clears a field back to its default. All fields are optional with no schema defaults, so existing documents load, render, and serialize unchanged; `TYPOGRAPHY_DEFAULTS` exports what an absent field means. `describeProject` lists typography only where it was set.
