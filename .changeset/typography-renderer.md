---
"@miraiclip/renderer": patch
---

Renders core 0.5.0's typography fields. Text clips map `fontWeight`, `fontStyle`, `lineHeight` (× font size), `letterSpacing` (em × font size), and `textAlign` onto their Pixi text style; caption words get weight, style, and spacing, and caption layout stacks lines at `lineHeight` (default 1.3) with word gaps widened by the letter spacing — so bold, italic, and spaced captions wrap and highlight correctly. `loadFontAssets` passes font assets' `weight`/`style` to `FontFace` as descriptors and loads each face of a family separately (`FontEnv.createFace` gains an optional `descriptors` argument); html-clip font inlining carries the same descriptors. Clips without typography render exactly as before. Applies to preview, browser and worker export, stills, and server export.
