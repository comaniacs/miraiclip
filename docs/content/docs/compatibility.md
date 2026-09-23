---
title: Compatibility
weight: 11
---

What Miraiclip runs on, and what media it handles.

## Environments

| Package | Environment | Requirement |
|---|---|---|
| `@miraiclip/core` | anywhere | Any JS runtime (browser, Node ≥ 18, workers, edge) — zero DOM/media dependencies |
| `@miraiclip/renderer` | browser | WebCodecs + WebGL: Chrome/Edge 94+, Safari 16.4+, Firefox 130+. `isWebCodecsSupported()` gates at runtime |
| `@miraiclip/server-export` | Node ≥ 18 | A Chrome/Chromium binary on the machine (real Chrome recommended — it carries the H.264/AAC encoders; free Chromium exports WebM only) |

The renderer requires WebCodecs by design — there is no `<video>`-element fallback pipeline. Per-asset capability failures surface as `UnsupportedMediaError` naming the codec, not as silent black frames.

## Containers (input)

Demuxing is mediabunny, so the renderer reads: MP4/M4V/M4A (ISOBMFF), QuickTime MOV, segmented MP4/CMAF, Matroska MKV, WebM, Ogg, MP3, WAV, ADTS AAC, FLAC, MPEG-TS, and HLS playlists.

## Codecs

**Decode** is the intersection of the container's contents and the browser's WebCodecs support — in practice: H.264/AVC, H.265/HEVC (where the platform licenses it), VP8, VP9, AV1 for video; AAC, Opus, MP3, Vorbis, FLAC and PCM variants for audio. Support is probed per asset up front.

**Encode (export)** ships two targets: **MP4 = H.264 + AAC** (needs a browser with the proprietary encoders — real Chrome/Edge, not free Chromium) and **WebM = VP9 + Opus** (works on any Chromium). `exportProject` probes the encoder before starting and rejects with a clear error rather than failing mid-export.

## Verified in CI

Every commit runs the full pipeline headlessly: golden-frame playback e2e (frame-exact seeks, clock-tracking playback), closed-loop export e2e (the exported file re-verified by an independent decoder — frame colors, duration, resolution, audio RMS), and a server-export integration driving real headless Chromium from Node.
