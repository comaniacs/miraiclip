---
title: Roadmap
weight: 7
---

## v1 — Core engine (`@miraiclip/core`) ✅ shipped

Commands, state, tracks, clips, undo/redo, patches, events, serialization. Headless, browser + Node, fully unit-testable. No rendering — proves the architecture first. Shipped as [`@miraiclip/core@0.1.0`](https://www.npmjs.com/package/@miraiclip/core) (September 2026).

## v2 — Rendering & playback (`@miraiclip/renderer`) ✅ shipped

WebCodecs-based decode pipeline with frame caching, a WebGL (PixiJS) compositor rendering project state to a canvas, and frame-accurate playback with the audio clock as the playback master. Proxy preview decode for 4K sources, golden-frame e2e coverage. Shipped as [`@miraiclip/renderer@0.1.0`](https://www.npmjs.com/package/@miraiclip/renderer) (September 2026).

## v3 — Export ✅ shipped

WebCodecs encode pipeline to MP4 (H.264 + AAC) and WebM (VP9 + Opus), offline (faster-than-realtime) rendering from project state via `exportProject` with pipelined encoding, progress events, cancellation, quality presets, and an output-fps option — verified end to end by a closed-loop e2e. Shipping as `@miraiclip/renderer@0.2.0`. See [Export](export/client-side).

## v3.x — Server-side export ✅ shipped

`@miraiclip/server-export`: the same `exportProject` running in headless Chrome on a server — `exportProjectFile(docJson, options)` and a `miraiclip-export` CLI hydrate the project in a browser harness and run the identical browser export path, so server output is pixel-identical to preview by construction. Built, integration-tested (real headless Chromium in CI), and verified end to end; Shipped as [`@miraiclip/server-export@0.1.0`](https://www.npmjs.com/package/@miraiclip/server-export) (September 2026). See [Server export](export/server-side). Also under v3.x: chunked offline audio rendering for long timelines.

## v4 — Creative features ✅ complete

Keyframe animations on clip properties (pure evaluator in core — preview, export, and server export all inherit it), shader-based effects with built-ins (color adjust, blur, **chroma key**), transitions (cross-dissolve, dips, wipe, slide) with equal-power audio crossfades, and **reels-style karaoke captions** (word-level timing, four highlight presets, SRT/VTT + ASR word-timestamp import, real font-asset loading in preview and export). See [Rendering](rendering). Shipping as core 0.2.0 + renderer 0.3.0.

## Beyond v4 — explored

Production-readiness stress suite (many-clip timelines, hour-scale exports, memory bounds, throughput regression benchmarks), a template library (`@miraiclip/templates` — parameterized document generators over v4 primitives), a programmatic clip kind for code-driven graphics (charts, generative visuals) with export parity, and locked brand templates. See PLAN.md for the full exploration.

## Parallel track — Adapters & ecosystem

`@miraiclip/react` hooks and selectors (Vue and Svelte adapters later), AI helpers exporting the command catalog as LLM tool definitions, and a collaboration reference implementation syncing commands/patches over WebSocket.
