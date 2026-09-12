---
"@miraiclip/renderer": minor
---

v4 creative features rendered, with preview/export parity by shared math: keyframe animation applied per render (volume rides linear gain ramps in the live engine and the offline export mixer alike); GPU effects (colorAdjust, blur, chroma key with spill suppression) with in-place param updates; transitions (crossDissolve, dipToBlack, dipToWhite, wipe, slide) with equal-power audio crossfades, dedicated decode pipelines for same-asset overlaps, and source-headroom rendering through the window; karaoke captions (plain/highlight/karaoke/pop presets, word wrap, background box) with font assets loaded as real FontFaces in both the player and `exportProject` — server exports never rasterize fallback glyphs. Also: transport hold on play/seek (no black/stale frames while decode catches up), new optional backend seams (`setReveal`, `createSolid`, `createCaption`), and exported `loadFontAssets`.
