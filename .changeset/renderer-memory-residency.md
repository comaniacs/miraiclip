---
"@miraiclip/renderer": minor
---

Preview memory now follows what is near the playhead, not timeline length (mobile tab crashes on the launch film).

- Compositor residency (default on): scene nodes mount only for clips within 2s ahead / 1s behind the render time; `residency: false` restores mount-everything.
- Decoder lanes: overlapping clips of one asset share a few interval-coloured lanes instead of one dedicated pipeline per transition clip (`assignVideoLanes`).
- MediaManager: holders + idle release (`idleReleaseMs`), one shared `frameBudgetBytes` (default 256 MiB) split across pipelines, `reportMemoryPressure()`, `stats()`.
- Frame cache keeps at most `maxBehindFrames` (8) played frames; live VideoFrames are capped by `maxPoolFrames` (6).
- `frameStorage: "auto"` (default): CPU-decoded frames (I4xx) are kept as VideoFrames and uploaded straight to WebGL; GPU/hardware frames are still copied to preview-sized ImageBitmaps and released (decoder pools stay free). `"videoframe"`/`"bitmap"` force one path; `maxOutputDimensionPx` may be a function.
- Html clips reuse one canvas, texture and image element per clip; `htmlRaster: { minDensity, maxAnimatedFps }` for live preview.
- Image textures are reference-counted and unloaded when no mounted clip uses them.
- Audio lanes open near the playhead and close behind it; mediabunny read caches capped (16 MiB video, 8 MiB audio).
- Player: `memory` options, `stats()`, `reportMemoryPressure()`.
