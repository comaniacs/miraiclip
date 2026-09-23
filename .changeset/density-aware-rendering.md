---
"@miraiclip/renderer": minor
---

Sharp text and html clips at every output size. Rasterized content (html-clip rasters, text and caption glyphs) now generates at the RENDER density — output size ÷ composition size in exports and stills, or the preview's devicePixelRatio — instead of composition density, so upscaled exports and hi-DPI previews stop looking soft. Layout is unchanged (a scale-transform supersamples html templates; Pixi texture/text `resolution` keeps logical sizes), outputs at composition size are pixel-identical, and worker exports pre-rasterize at the same density. `rasterizeHtml` gains a `density` option (the raster key includes it), `collectHtmlRasters` takes the output size, `EffectContext` exposes `renderScale`, and `createPlayer` gains `outputSize` — pass the canvas's CSS size × devicePixelRatio for a sharp preview (the playground and docs examples now do).
