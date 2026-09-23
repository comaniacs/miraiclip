---
"@miraiclip/core": minor
---

New built-in `html` clip kind: `clip/add { kind: "html", template, params?, widthPx?, heightPx? }` — HTML/CSS overlays with `{{param}}` substitution (values HTML-escaped), sized in composition pixels, first-class in the schema/catalog so they serialize and cross process boundaries. `clip/set-property { params }` merges params.
