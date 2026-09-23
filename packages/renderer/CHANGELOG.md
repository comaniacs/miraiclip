# @miraiclip/renderer

## 0.7.0

### Minor Changes

- a27c4ef: html clip rendering: `rasterizeHtml`/`substituteParams` (SVG foreignObject via data: URL — blob: URLs taint the canvas in Chromium — with a 2D-canvas launder for WebGL-safe textures; rasters cached per template/params/size; font assets inline as @font-face data URIs, `asset:<id>` inlines image assets), a Pixi html node, and a new readiness gate: `SceneNode.whenReady`/`Compositor.whenReady` — `exportProject` and `renderProjectStill` now await async node content (image textures, html rasters) before the frame walk, fixing a latent race where exports started immediately after building a document could bake empty image sprites into early frames. Worker export renders html clips: `exportProjectInWorker`/`exportViaWorker` pre-rasterize them on the main thread (deduplicated per template/params/size) and transfer the bitmaps to the worker, which serves them by raster key — no API change. Custom worker pipelines get the same via the exported `collectHtmlRasters(doc)`/`provideHtmlRasters(rasters)`.

### Patch Changes

- Updated dependencies [a27c4ef]
  - @miraiclip/core@0.4.0

## 0.6.0

### Minor Changes

- 201239c: Public effect and transition registration: `registerEffectRenderer(kind, factory)` (custom effect kind → Pixi filter factory, params updated in place) and `registerTransitionRenderer(kind, renderer)` (custom transition kind → pure per-frame math over progress, composing opacity, directional reveal, pixel offset, and a full-composition overlay). Built-ins are expressed through the same contracts; custom kinds render identically in preview, browser export, and stills. Server and worker export remain built-in-kinds-only (renderers are functions and cannot cross a process/thread boundary).

## 0.5.0

### Minor Changes

- fc2827e: Still-frame rendering: `renderProjectStill(project, { timeUs, width?, height? })` in the renderer renders one composition frame to an image through the exact export pipeline, and `createRenderSession()` in server-export keeps one warm headless Chrome across calls so a frame costs a frame, not a browser launch. Also fixes `exportProject`'s `width`/`height` output-size option, which was silently ignored (the compositor resized the canvas back to the composition size): the compositor gained `outputSize` (backends: optional `setOutputSize`), so exports and stills now honor a requested output size while composition coordinates stay unchanged.

## 0.4.2

### Patch Changes

- Updated dependencies [34a0d60]
  - @miraiclip/core@0.3.0

## 0.4.1

### Patch Changes

- 3efb2bf: Fix for export functionality of clip

## 0.4.0

### Minor Changes

- e9f8d0a: Streaming export output and chunked offline audio — export memory is now independent of timeline length. `exportProject` (and `createMediabunnySink`) accept `target`: a `WritableStream` receiving `{ type: "write", data, position }` chunks as the file is encoded (a `showSaveFilePicker()` writable works directly); with a target set the promise resolves with an empty array. Export audio mixes in bounded sequential chunks (`audioChunkSeconds`, default 60) interleaved with the frame walk instead of one whole-timeline `OfflineAudioContext` render; `exportComposition` gained `mixAudioChunk` (the existing whole-range `mixAudio` is unchanged), and whether a composition has audio is decided up front by probing the contributing assets. Demonstrated: a one-hour export (86,400 frames, an hour of audio, 984 MB streamed) peaked at 165 MB of JS heap at 1.6× realtime.
  
  Fixes: concurrent clips of the same asset (picture-in-picture of one source) each get a dedicated decode pipeline instead of fighting over the shared per-asset pipeline's seek target (which wedged playback); the pipeline LRU tracks per-frame use and never evicts an actively used pipeline (new `evictionIdleMs` option, default 500ms); lazy pipeline acquisition + self-healing re-acquire after eviction (long multi-asset timelines no longer go black); software-GL exports route frame capture through a CPU mirror automatically (`cpuCapture`, `isSoftwareWebGL`), avoiding unbounded GPU shared-image growth in headless environments.

## 0.3.0

### Minor Changes

- 260cf57: v4 creative features rendered, with preview/export parity by shared math: keyframe animation applied per render (volume rides linear gain ramps in the live engine and the offline export mixer alike); GPU effects (colorAdjust, blur, chroma key with spill suppression) with in-place param updates; transitions (crossDissolve, dipToBlack, dipToWhite, wipe, slide) with equal-power audio crossfades, dedicated decode pipelines for same-asset overlaps, and source-headroom rendering through the window; karaoke captions (plain/highlight/karaoke/pop presets, word wrap, background box) with font assets loaded as real FontFaces in both the player and `exportProject` — server exports never rasterize fallback glyphs. Also: transport hold on play/seek (no black/stale frames while decode catches up), new optional backend seams (`setReveal`, `createSolid`, `createCaption`), and exported `loadFontAssets`.

### Patch Changes

- Updated dependencies [260cf57]
  - @miraiclip/core@0.2.0

## 0.2.0

### Minor Changes

- 0c24857: Offline export (v3): `exportProject` renders a composition to MP4 (H.264 + AAC) or WebM (VP9 + Opus) — faster than realtime, pipelined encoding (bounded in-flight window), midpoint frame sampling, per-frame wait-for-arrival, decode capped at 2× output size, offline audio mix sharing live playback's clip math, quality presets, up-front codec probing, AbortSignal cancellation, and progress events for both phases. Verified end-to-end by a closed-loop e2e (independent decoder checks frame colors, duration, and audio RMS).
