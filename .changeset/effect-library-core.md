---
"@miraiclip/core": patch
---

Effect library: 76 new built-in effect kinds (79 with colorAdjust, blur, chromaKey) across seven categories — color, film, stylize, glitch & retro, blur & light, distort, frame & key. `EFFECT_CATALOG` is the single source of truth: each entry's param schema is derived from it (so `effect/add` validates and fills defaults), the `effect/add` AI tool description lists every kind, and editors read labels, categories, ranges, steps and display formats from it (`EFFECT_CATEGORIES`, `getEffectInfo`, `defaultEffectParams`). Length params are fractions of composition height. Existing documents are unchanged.
