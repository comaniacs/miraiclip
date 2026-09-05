---
title: Rendering
weight: 4
---

{{< callout type="warning" >}}
`@miraiclip/renderer` is in development (v2) and not yet published to npm — this documents the package as it exists in the repo. Audio playback is the next milestone.
{{< /callout >}}

`@miraiclip/renderer` turns a project document into pixels: a WebCodecs media pipeline decodes video, a PixiJS compositor mirrors `state.doc` onto a canvas, and a clock drives what moment is shown. The core stays headless and environment-agnostic; the renderer is framework-agnostic but **browser-only** (WebCodecs, WebGL, Web Audio).

## Quick start

```ts
import { createProject } from "@miraiclip/core";
import {
  Compositor,
  createPixiBackend,
  createVideoSupport,
  createWebCodecsDecoder,
  isWebCodecsSupported,
  MediaManager,
  openMediabunnyDemuxer,
  RealtimeClock,
} from "@miraiclip/renderer";

if (!isWebCodecsSupported()) throw new Error("WebCodecs required");

const project = createProject({ width: 1280, height: 720, fps: 30 });
// …dispatch asset/track/clip commands…

// 1 — media pipeline: one decode pipeline per asset, shared across clips.
const manager = new MediaManager({
  openDemuxer: openMediabunnyDemuxer, // mediabunny: MP4/MOV/WebM/MKV…
  createDecoder: createWebCodecsDecoder,
});
const videos = createVideoSupport(project, manager);

// 2 — compositor: mirrors the document onto a canvas, updated by patches.
const backend = await createPixiBackend({ canvas, width: 1280, height: 720 });
const compositor = new Compositor(project, backend, {
  factories: { video: videos.factory },
});

// 3 — drive it with a clock.
const clock = new RealtimeClock();
clock.play();
function frame() {
  compositor.renderAt(clock.timeUs);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

`compositor.renderAt(timeUs)` is a pure function of the document and time — any dispatched command (including undo/redo or a collaborator's patches) updates the scene granularly via the core's patch events, with no rebuilds.

## The three layers

**Media pipeline** — `MediaManager` owns one `VideoPipeline` per *asset* (clips sharing a source share it), capped at a decoder budget with least-recently-used release. Each pipeline streams continuously: one live decoder is fed forward with a decode-ahead window as backpressure, re-seeking only on a real jump. Seeks are frame-accurate via the WebCodecs settle pattern — decode lead-in from the keyframe is closed, never presented, so the display holds the last frame and snaps straight to the target.

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
```
