---
title: Rendering
weight: 4
---

{{< callout type="warning" >}}
`@miraiclip/renderer` is in development (v2) and not yet published to npm — this documents the package as it exists in the repo.
{{< /callout >}}

`@miraiclip/renderer` turns a project document into pixels and sound: a WebCodecs media pipeline decodes video, a PixiJS compositor mirrors `state.doc` onto a canvas, a Web Audio engine schedules the mix, and the **audio clock is the playback master**. The core stays headless and environment-agnostic; the renderer is framework-agnostic but **browser-only** (WebCodecs, WebGL, Web Audio).

## Quick start

`createPlayer` wires everything — media pipeline, compositor, audio engine, master clock, transport:

```ts
import { createProject } from "@miraiclip/core";
import {
  createPixiBackend,
  createPlayer,
  createWebAudioOutput,
  createWebCodecsDecoderFactory,
  isWebCodecsSupported,
  openMediabunnyAudio,
  openMediabunnyDemuxer,
} from "@miraiclip/renderer";

if (!isWebCodecsSupported()) throw new Error("WebCodecs required");

const project = createProject({ width: 1280, height: 720, fps: 30 });
// …dispatch asset/track/clip commands…

const backend = await createPixiBackend({ canvas, width: 1280, height: 720 });
const player = createPlayer(project, {
  backend,
  openDemuxer: openMediabunnyDemuxer, // mediabunny: MP4/MOV/WebM/MKV…
  // Proxy preview: cap decoded frames at preview resolution. Full-res 4K60 is
  // ~4 GB/s of frame copies + GPU uploads and drops frames on most machines;
  // the downscale happens on the GPU and layout is unaffected. Use
  // `createWebCodecsDecoder` (no cap) for full-resolution output.
  createDecoder: createWebCodecsDecoderFactory({ maxOutputDimensionPx: 1920 }),
  audioOutput: createWebAudioOutput(),
  openAudio: openMediabunnyAudio,
  // Per-clip media failures (unsupported codec, decode error). Defaults to a
  // loud console.error — never silent.
  onError: (error, clipId) => showToast(`clip ${clipId}: ${error.message}`),
});

player.play(); // pause() · seek(us) · setRate(r) · timeUs · durationUs · destroy()
```

The player renders every animation frame, keeps decode and audio windows rolling, and pushes the playhead into the core via `setPlayhead` — ephemeral state, so scrubbing never pollutes undo history. Any dispatched command (including undo/redo or a collaborator's patches) updates the scene granularly via the core's patch events, with no rebuilds. The pieces below remain individually usable when you need custom wiring.

## Layout

A clip's `transform.scale` of **1 means "fit the composition"** (contain, aspect preserved) — a 4K source on a 720p canvas fills the frame, never a native-pixel center crop. `x`/`y` are normalized composition coordinates. Because fitting is computed from the decoded frame against the composition, rendered size is independent of decode resolution: proxy playback and full-resolution decode produce the same layout.

## Audio

Audio clips — and the embedded tracks of video clips — are decoded in **streaming windows** (an hour of PCM is gigabytes; nothing is decoded whole) via mediabunny's `AudioBufferSink` and scheduled on a WebAudio graph: one gain lane per clip, mixing clip `volume` with track `muted`/`solo` live, mapped through clip start + source trim. Because the master clock *is* the audio output's clock, scheduled sound and the video frames chasing the clock cannot drift apart. Assets without an audio track simply play silent.

## The three layers

**Media pipeline** — `MediaManager` owns one `VideoPipeline` per *asset* (clips sharing a source share it), capped at a decoder budget with least-recently-used release. Each pipeline streams continuously: one live decoder is fed forward with a decode-ahead window as backpressure, re-seeking only on a real jump. Seeks are frame-accurate via the WebCodecs settle pattern — decode lead-in from the keyframe is closed, never presented, so the display holds the last frame and snaps straight to the target. Playback robustness is deterministic by design: re-seek decisions come from stream state (a contiguity watermark of verified arrivals — never decode timing, which lies under load), the frame cache evicts the past before the future so decode-ahead output is never sacrificed, and the ahead window sizes itself from measured frame spacing and the cache's byte budget (4K decodes less ahead instead of decoding into eviction).

**Compositor** — a scene graph behind the `SceneBackend` interface (PixiJS in production, a fake in tests). Clip kinds map to nodes through a **factory registry**; registering a custom kind's factory is the extension seam that video itself uses, and that v4 effects will use.

**Clocks** — the compositor doesn't know what drives it. `RealtimeClock` (wall time, rate control) powers preview; `StepClock` advances frame by frame, which is how v3 export will reuse the same compositor for byte-identical output.

## Exact frames

`videos.renderFrameAt(compositor, timeUs)` awaits decode and draws one exact frame — the primitive for thumbnails, posters, and export. `videos.prepare(timeUs)` pre-decodes around a position without drawing.

## Browser support

WebCodecs is required: Chrome/Edge 94+, Safari 16.4+, Firefox 130+. `isWebCodecsSupported()` gates the whole pipeline; per-asset codec problems surface as `UnsupportedMediaError` (e.g. HEVC on a machine without a decoder) so one bad asset never takes down the renderer.

## Try it

The repo's playground exercises everything above against real files:

```bash
pnpm install
pnpm --filter miraiclip-playground dev
# open the URL, pick an MP4 — or load one by URL: /?src=/your.mp4 (from apps/playground/public)

# golden-frame e2e suite (frame-exact seeks, clock-tracking playback):
pnpm --filter miraiclip-playground e2e
```
