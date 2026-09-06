---
"@miraiclip/renderer": minor
---

Offline export (v3): `exportProject` renders a composition to MP4 (H.264 + AAC) or WebM (VP9 + Opus) — faster than realtime, pipelined encoding (bounded in-flight window), midpoint frame sampling, per-frame wait-for-arrival, decode capped at 2× output size, offline audio mix sharing live playback's clip math, quality presets, up-front codec probing, AbortSignal cancellation, and progress events for both phases. Verified end-to-end by a closed-loop e2e (independent decoder checks frame colors, duration, and audio RMS).
