---
title: Roadmap
weight: 7
---

## v1 — Core engine (`@miraiclip/core`) ✅ shipped

Commands, state, tracks, clips, undo/redo, patches, events, serialization. Headless, browser + Node, fully unit-testable. No rendering — proves the architecture first. Shipped as [`@miraiclip/core@0.1.0`](https://www.npmjs.com/package/@miraiclip/core) (September 2026).

## v2 — Rendering & playback (`@miraiclip/renderer`) ✅ shipped

WebCodecs-based decode pipeline with frame caching, a WebGL (PixiJS) compositor rendering project state to a canvas, and frame-accurate playback with the audio clock as the playback master. Proxy preview decode for 4K sources, golden-frame e2e coverage. Shipped as [`@miraiclip/renderer@0.1.0`](https://www.npmjs.com/package/@miraiclip/renderer) (September 2026).

## v3 — Export ✅ shipped

WebCodecs encode pipeline to MP4 (H.264 + AAC) and WebM (VP9 + Opus), offline (faster-than-realtime) rendering from project state via `exportProject` with pipelined encoding, progress events, cancellation, quality presets, and an output-fps option — verified end to end by a closed-loop e2e. Shipping as `@miraiclip/renderer@0.2.0`. See [Export](export).

## v3.x — Server-side export (next)

The same `exportProject` running in headless Chromium on a server: a Node package that accepts the project document as JSON, hydrates it in a browser harness, and runs the identical browser export path — preview/export parity by construction, already validated by the CI e2e suite running headlessly. Also under v3.x: chunked offline audio rendering for long timelines.

## v4 — Creative features

Keyframe animations on clip properties, transitions, shader-based effects and filters, captions, and chroma key.

## Parallel track — Adapters & ecosystem

`@miraiclip/react` hooks and selectors (Vue and Svelte adapters later), AI helpers exporting the command catalog as LLM tool definitions, and a collaboration reference implementation syncing commands/patches over WebSocket.
