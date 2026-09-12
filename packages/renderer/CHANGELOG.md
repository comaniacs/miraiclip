# @miraiclip/renderer

## 0.3.0

### Minor Changes

- 260cf57: v4 creative features rendered, with preview/export parity by shared math: keyframe animation applied per render (volume rides linear gain ramps in the live engine and the offline export mixer alike); GPU effects (colorAdjust, blur, chroma key with spill suppression) with in-place param updates; transitions (crossDissolve, dipToBlack, dipToWhite, wipe, slide) with equal-power audio crossfades, dedicated decode pipelines for same-asset overlaps, and source-headroom rendering through the window; karaoke captions (plain/highlight/karaoke/pop presets, word wrap, background box) with font assets loaded as real FontFaces in both the player and `exportProject` — server exports never rasterize fallback glyphs. Also: transport hold on play/seek (no black/stale frames while decode catches up), new optional backend seams (`setReveal`, `createSolid`, `createCaption`), and exported `loadFontAssets`.

### Patch Changes

- Updated dependencies [260cf57]
  - @miraiclip/core@0.2.0

## 0.2.0

### Minor Changes

- 0c24857: Offline export (v3): `exportProject` renders a composition to MP4 (H.264 + AAC) or WebM (VP9 + Opus) — faster than realtime, pipelined encoding (bounded in-flight window), midpoint frame sampling, per-frame wait-for-arrival, decode capped at 2× output size, offline audio mix sharing live playback's clip math, quality presets, up-front codec probing, AbortSignal cancellation, and progress events for both phases. Verified end-to-end by a closed-loop e2e (independent decoder checks frame colors, duration, and audio RMS).
