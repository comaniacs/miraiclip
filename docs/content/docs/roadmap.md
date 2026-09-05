---
title: Roadmap
weight: 4
---

## v1 — Core engine (`@miraiclip/core`) ✅ shipped

Commands, state, tracks, clips, undo/redo, patches, events, serialization. Headless, browser + Node, fully unit-testable. No rendering — proves the architecture first. Shipped as [`@miraiclip/core@0.1.0`](https://www.npmjs.com/package/@miraiclip/core) (September 2026).

## v2 — Rendering & playback (`@miraiclip/renderer`)

WebCodecs-based decode pipeline with frame caching, a WebGL compositor rendering project state to a canvas, and frame-accurate playback with audio sync via Web Audio.

## v3 — Export

WebCodecs encode pipeline to MP4/WebM, offline (faster-than-realtime) rendering from project state, progress events, cancellation, and quality presets.

## v4 — Creative features

Keyframe animations on clip properties, transitions, shader-based effects and filters, captions, and chroma key.

## Parallel track — Adapters & ecosystem

`@miraiclip/react` hooks and selectors (Vue and Svelte adapters later), AI helpers exporting the command catalog as LLM tool definitions, and a collaboration reference implementation syncing commands/patches over WebSocket.
