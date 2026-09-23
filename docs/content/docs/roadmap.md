---
title: Roadmap
weight: 11
---

## v1 — Core engine (`@miraiclip/core`) ✅ shipped

Commands, state, tracks, clips, undo/redo, patches, events, serialization. Headless, browser + Node, fully unit-testable. No rendering — proves the architecture first. Shipped as [`@miraiclip/core@0.1.0`](https://www.npmjs.com/package/@miraiclip/core) (September 2026).

## v2 — Rendering & playback (`@miraiclip/renderer`) ✅ shipped

WebCodecs-based decode pipeline with frame caching, a WebGL (PixiJS) compositor rendering project state to a canvas, and frame-accurate playback with the audio clock as the playback master. Proxy preview decode for 4K sources, golden-frame e2e coverage. Shipped as [`@miraiclip/renderer@0.1.0`](https://www.npmjs.com/package/@miraiclip/renderer) (September 2026).

## v3 — Export ✅ shipped

WebCodecs encode pipeline to MP4 (H.264 + AAC) and WebM (VP9 + Opus), offline (faster-than-realtime) rendering from project state via `exportProject` with pipelined encoding, progress events, cancellation, quality presets, and an output-fps option — verified end to end by a closed-loop e2e. Shipping as `@miraiclip/renderer@0.2.0`. See [Export](export/client-side).

## v3.x — Server-side export ✅ shipped

`@miraiclip/server-export`: the same `exportProject` running in headless Chrome on a server — `exportProjectFile(docJson, options)` and a `miraiclip-export` CLI hydrate the project in a browser harness and run the identical browser export path, so server output is pixel-identical to preview by construction. Built, integration-tested (real headless Chromium in CI), and verified end to end; Shipped as [`@miraiclip/server-export@0.1.0`](https://www.npmjs.com/package/@miraiclip/server-export) (September 2026). See [Server export](export/server-side). Also under v3.x: chunked offline audio rendering for long timelines.

## v4 — Creative features ✅ shipped

Keyframe animations on clip properties (pure evaluator in core — preview, export, and server export all inherit it), shader-based effects with built-ins (color adjust, blur, **chroma key**), transitions (cross-dissolve, dips, wipe, slide) with equal-power audio crossfades, and **reels-style karaoke captions** (word-level timing, four highlight presets, SRT/VTT + ASR word-timestamp import, real font-asset loading in preview and export). See [Rendering](rendering) and the live [Examples](../examples). Shipped as [`@miraiclip/core@0.2.0`](https://www.npmjs.com/package/@miraiclip/core) + [`@miraiclip/renderer@0.3.0`](https://www.npmjs.com/package/@miraiclip/renderer) (September 2026).

## v4.x — Production readiness (in progress)

The **stress tier is shipped**: `pnpm stress` runs many-clip playback tracking, bounded-heap long exports, decoder churn with a scrub storm, throughput benchmarks (incl. optional 4K→1080p), and parallel server exports — nightly in CI with a metrics artifact. Measured numbers and known ceilings live on [Production Readiness](production-readiness). **Streaming export output and chunked offline audio shipped** as [`@miraiclip/renderer@0.4.0`](https://www.npmjs.com/package/@miraiclip/renderer) + [`@miraiclip/server-export@0.2.0`](https://www.npmjs.com/package/@miraiclip/server-export) (September 2026) — export memory no longer scales with timeline length, demonstrated with a one-hour export at 165 MB of heap. An **export validation corpus** (ffmpeg-verified real exports, nightly) and a **device benchmark tier** guard correctness and presentation/seek latency; these tiers have caught and fixed real pipeline bugs before release. **Worker export shipped** as [`@miraiclip/renderer@0.4.1`](https://www.npmjs.com/package/@miraiclip/renderer) (September 2026) — the whole export pipeline runs off the main thread (`exportProjectInWorker` / `exportViaWorker`), keeping the page responsive mid-export, alongside three field-reported memory fixes (demuxer cache disposal, software-encoder capture routing, listener churn). Still in v4.x hardening: reference-device benchmark numbers, long-source coverage, and true overlapped audio crossfades.

## v5 — AI-native editing & extensibility (in progress)

The command-driven core was designed for this from v1; v5 turns it into working integrations.

- **AI command interface** ✅ — the catalog as ready-to-send LLM tool definitions (`toToolDefinitions`, Anthropic/OpenAI shapes), dispatch with machine-readable failures agents self-correct from (`tryDispatch`, transactional `applyCommands`), and a token-efficient state summary for prompts (`describeProject`). Shipping as `@miraiclip/core@0.3.0`. See [AI Integration](ai-integration).
- **MCP server** ✅ — `@miraiclip/mcp`: edit a project from Claude, Codex, or any MCP client — a validating dispatch over the catalog, transactional batches, undo/redo, frame previews so the agent SEES its edit (one warm headless Chrome), and export to file. Shipping as `@miraiclip/mcp@0.1.0`; still rendering lands in `@miraiclip/renderer@0.5.0` (`renderProjectStill`) and `@miraiclip/server-export@0.3.0` (`createRenderSession`). See [MCP Server](mcp-server).
- **Custom effects and transitions** ✅ — public `registerEffectRenderer` and `registerTransitionRenderer`: custom kinds register the same way built-ins are implemented and render identically in preview, browser export, and stills. Standard keyframes already apply to every clip kind; keyframing effect params is the remaining follow-up. See [Custom Effects & Transitions](rendering/extensibility).
- **HTML clips** ✅ — the `html` clip kind: template-driven overlays (lower thirds, cards, badges) authored in HTML/CSS with `{{param}}` substitution, rasterized into the compositor and composited like any clip — in preview, exports (worker exports included: rasters pre-render on main and transfer), stills, server export, and MCP previews. See [HTML Clips](rendering/html-clips).
- **Parameterized videos** (`@miraiclip/templates`) — a template project + a data payload → hydrated doc → export, for batch and personalized video generation; html clips are the primary consumer.

Also explored: a programmatic clip kind for code-driven graphics with export parity, and locked brand templates. See PLAN.md for the full exploration.

## Parallel track — Adapters & ecosystem

`@miraiclip/react` hooks and selectors (Vue and Svelte adapters later), and a collaboration reference implementation syncing commands/patches over WebSocket.
