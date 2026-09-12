---
title: Rendering
weight: 4
---

`@miraiclip/renderer` turns a project document into pixels and sound: a WebCodecs media pipeline decodes video, a PixiJS compositor mirrors `state.doc` onto a canvas, a Web Audio engine schedules the mix, and the **audio clock is the playback master**. The core stays headless; the renderer is framework-agnostic but **browser-only** (WebCodecs, WebGL, Web Audio).

## Install

```bash
npm install @miraiclip/core @miraiclip/renderer
# pixi.js and mediabunny are pulled in as dependencies
```

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
  // Proxy preview: cap decoded frames at preview resolution — full-res 4K60
  // drops frames on most machines. Layout is unaffected (fit-to-composition).
  createDecoder: createWebCodecsDecoderFactory({ maxOutputDimensionPx: 1920 }),
  audioOutput: createWebAudioOutput(),
  openAudio: openMediabunnyAudio,
  onError: (error, clipId) => showToast(`clip ${clipId}: ${error.message}`),
});

player.play(); // pause() · seek(us) · setRate(r) · timeUs · durationUs · destroy()
```

The player renders every animation frame and pushes the playhead into the core as ephemeral state — scrubbing never pollutes undo history. Any dispatched command (undo/redo and collaborator patches included) updates the scene granularly.

## Creative features

Everything below is a command away — and because export drives the same compositor, whatever you build here looks and sounds identical in preview, browser export, and server export:

- **[Animation](animation)** — keyframe any clip property with easings.
- **[Effects](effects)** — color adjust, blur, chroma key per clip.
- **[Transitions](transitions)** — dissolve, dips, wipe, slide across a cut.
- **[Captions](captions)** — reels-style karaoke text with word timing.

## Layout

A clip's `transform.scale` of **1 means "fit the composition"** (contain, aspect preserved) — a 4K source on a 720p canvas fills the frame, never a native-pixel center crop. `x`/`y` are normalized composition coordinates. Rendered size is independent of decode resolution, so proxy playback and full-resolution decode produce the same layout.

## Audio

Audio clips — and the embedded tracks of video clips — are decoded in **streaming windows** (never whole-file PCM) and scheduled on a WebAudio graph: one gain lane per clip, mixing clip `volume` with track `muted`/`solo` live. Because the master clock *is* the audio output's clock, sound and the frames chasing the clock cannot drift apart.

## The three layers

**Media pipeline** — `MediaManager` owns one `VideoPipeline` per asset (clips sharing a source share it), capped at a decoder budget with LRU release. Pipelines stream continuously with a decode-ahead window; seeks are frame-accurate via the WebCodecs settle pattern.

**Compositor** — a scene graph behind the `SceneBackend` interface (PixiJS in production, a fake in tests). Clip kinds map to nodes through a factory registry — the extension seam custom clip kinds use.

**Clocks** — `RealtimeClock` (wall time, rate control) powers preview; a step clock drives export frame by frame through the same compositor.

## Exact frames

`videos.renderFrameAt(compositor, timeUs)` awaits decode and draws one exact frame — the primitive for thumbnails, posters, and export. `videos.prepare(timeUs)` pre-decodes around a position without drawing.

## Browser support

WebCodecs is required: Chrome/Edge 94+, Safari 16.4+, Firefox 130+. `isWebCodecsSupported()` gates the whole pipeline; per-asset codec problems surface as `UnsupportedMediaError` so one bad asset never takes down the renderer.

## Try it

The repo's playground exercises everything against real files — including one-click preset cards for effects, text, animation, captions, and transitions:

```bash
pnpm install
pnpm --filter miraiclip-playground dev
# open the URL, pick an MP4 — or load one by URL: /?src=/your.mp4

# golden-frame e2e suite:
pnpm --filter miraiclip-playground e2e
```
