---
"@miraiclip/renderer": patch
---

Animated html clips: CSS animations are paused and seeked to the clip's time (`--t`/`--T` on the root, `--d` for per-element delays) and re-rasterized per frame — coalesced in preview, awaited per frame in exports and stills (`compositor.renderExactAt`), and requested on demand from the main thread in worker exports. New exports: `htmlAnimationTiming`, `htmlRasterKey`, `setHtmlRasterSource`.
