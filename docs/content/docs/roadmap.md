---
title: Roadmap
weight: 12
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
- **HTML clips** ✅ — the `html` clip kind: template-driven overlays (lower thirds, cards, badges) authored in HTML/CSS with `{{param}}` substitution, rasterized into the compositor and composited like any clip — in preview, exports (worker exports included: rasters pre-render on main and transfer), stills, server export, and MCP previews. Shipped as [`@miraiclip/core@0.4.0`](https://www.npmjs.com/package/@miraiclip/core) + [`@miraiclip/renderer@0.7.0`](https://www.npmjs.com/package/@miraiclip/renderer) (September 2026). See [HTML Clips](rendering/html-clips).
- **Parameterized videos** ✅ — `@miraiclip/templates`: a template project + declared fields + a data payload → a hydrated document → export. Placeholders bind into text, captions, and html-clip params; asset slots swap media; hydration is pure with machine-readable failures; field schemas double as LLM tools. Batch rendering runs rows through warm export sessions (`createExportSession` in server-export) with a `miraiclip-templates` CLI for JSON/NDJSON/CSV. Shipped as [`@miraiclip/templates@0.1.0`](https://www.npmjs.com/package/@miraiclip/templates) + `@miraiclip/server-export@0.4.0` (September 2026). See [Templates](templates).

- **Audio sources & generation** ✅ — asset provenance (`source`, `license`, `attribution`), clip fades and waveform peaks in core + renderer, and `@miraiclip/audio-sources`: stock search (Openverse, Freesound, your catalog or backend), one-step licensed imports, and AI generation of sound effects, music and voiceover behind one vendor-neutral `AudioGenerator` contract (ElevenLabs first; keys stay server-side), all exposed as LLM tools. Shipped as [`@miraiclip/core@0.5.3`](https://www.npmjs.com/package/@miraiclip/core) + [`@miraiclip/renderer@0.7.8`](https://www.npmjs.com/package/@miraiclip/renderer) + [`@miraiclip/audio-sources@0.1.0`](https://www.npmjs.com/package/@miraiclip/audio-sources) (October 2026); generation lands in 0.2.0. Next: assistant and MCP wiring. See [Audio Sources](audio-sources).
- **AI editing assistant** ✅ — `@miraiclip/assistant`: a vendor-neutral `ChatModel` contract (OpenAI first, any OpenAI-compatible server via `baseUrl`), an agent loop that edits a working copy and lands each request as one undo step (or waits for review), editing tools (`apply_commands`, `add_transition`, `animate_clip`) on top of core's new animation presets and `findCuts`, and a server handler + browser proxy that keep keys server-side. Shipped as [`@miraiclip/assistant@0.1.0`](https://www.npmjs.com/package/@miraiclip/assistant) with [`@miraiclip/core@0.5.5`](https://www.npmjs.com/package/@miraiclip/core); 0.1.1 adds effect, trim, keyframe and background tools, rate-limit handling and fixes from live evals. Next: more vendor adapters, the same tools in the MCP server. See [Assistant](assistant).

Also explored: a programmatic clip kind for code-driven graphics with export parity, and locked brand templates. See PLAN.md for the full exploration.

## v6 — Product videos, agents & cloud (in progress)

Turning one screen recording into a finished product video, a written guide and every language, plus a stronger agent surface and render infrastructure. Every feature is a pure planner, a contract with bring-your-own-key adapters, or both, so it works without a Miraiclip server. ✅ = built and tested, waiting for the next release · 🔜 = pending · ⏸ = waiting on a decision. **Progress: 21 of 26 items built** (Phases 1, 2 and 4 complete; Phase 3 5 of 6; Phase 5 2 of 6).

**Phase 1 — Foundations (core)**

| Item | Status | Where |
| --- | --- | --- |
| Clip speed and freeze frames (`speed`, `clip/set-speed`, `clip/freeze`), with audio, export and server parity | ✅ | core, renderer, editor |
| Timeline markers (`marker/add`/`update`/`remove`): chapters, steps, guide sections | ✅ | core, editor — [Markers](core-concepts/markers) |
| Effect regions: any effect limited to a keyframable box or ellipse (redaction, spotlight) | ✅ | core, renderer — [Effects](rendering/effects) |
| Self-describing plugins (`doc.plugins`): custom kinds render in the browser, workers, server export and MCP | ✅ | core, renderer, server-export, mcp — [Extensibility](rendering/extensibility) |
| Idempotent kind registration (hot reload, warm multi-tenant workers) | ✅ | core, renderer |
| Engine fixes: custom `props` via `clip/set-property`, gestures as one undo step, transitions surviving no-op moves | ✅ | core |

**Phase 2 — Agent surface**

| Item | Status | Where |
| --- | --- | --- |
| Agent skills pack and Claude Code plugin (router + workflows, incl. screen tutorials) | ✅ | `plugins/miraiclip` |
| Block registry: 21 ready-made blocks, static JSON registry, `miraiclip add`/`catalog`/`build` | ✅ | `@miraiclip/registry` — [Blocks](blocks) |
| `<miraiclip-player>` web component (file or live project, chapters from markers) | ✅ | `@miraiclip/player` — [Player](player) |
| HTML composition import and export (data-attribute timing ↔ documents) | ✅ | `@miraiclip/html-composition` — [HTML Compositions](html-compositions) |
| Scripted html clips: GSAP, Lottie, anime.js and Web Animations, seeked frame-exactly in every renderer | ✅ | renderer — [HTML Clips](rendering/html-clips#scripted-templates-gsap-lottie-animejs) |

**Phase 3 — Screen recordings to product videos**

| Item | Status | Where |
| --- | --- | --- |
| Browser recorder (screen + mic + camera, streaming) with a private interaction log; reference Chrome extension | ✅ | `@miraiclip/capture`, `apps/capture-extension` |
| Planners: auto-zoom, clean cursor, click ripples, redaction of sensitive fields, step callouts | ✅ | `@miraiclip/screencast` |
| Transcripts: speech-to-text contract (OpenAI, Deepgram), filler/stutter/silence removal, text-based editing, captions after cuts | ✅ | `@miraiclip/transcript` |
| Narration: scripts per step, rewrite by any chat model, speech (ElevenLabs, OpenAI), `alignNarration` | ✅ | `@miraiclip/narration`, `@miraiclip/audio-sources` |
| Written guides with annotated screenshots (Markdown, HTML, JSON) | ✅ | `@miraiclip/guides` |
| Demo: "Record → product video + guide" in the React template | 🔜 | miraiclip-react-template |

See [Screen recordings to product videos](screencasts).

**Phase 4 — Multipliers**

| Item | Status | Where |
| --- | --- | --- |
| Localization: translator contract (chat model, DeepL) and one variant per language, re-voiced with narration | ✅ | `@miraiclip/localize` |
| Brand kits: colours, fonts, logo, caption style, intro and outro | ✅ | `@miraiclip/brand` |
| Avatar presenter contract (`AvatarProvider`, `avatarCommands`); vendor adapters later | ✅ | `@miraiclip/narration` |

**Phase 5 — Miraiclip Cloud (paid, optional)**

| Item | Status | Where |
| --- | --- | --- |
| Render cost measured: CPU-seconds per output minute at 1080p30 and 4K30 (`bench:cost`) | ✅ | server-export |
| Distributed rendering: frame-aligned chunks + one audio pass, local and HTTP runners, deployable worker | ✅ | server-export — [Distributed rendering](export/server-side#distributed-rendering) |
| Hosted render API (stateless containers, scale to zero, signed asset URLs) | ⏸ | waiting on the cloud stack decision |
| AI gateway: speech-to-text, voice, translation and chat behind one key, metered | ⏸ | waiting on the cloud stack decision |
| Share pages, player CDN and view analytics | ⏸ | waiting on the cloud stack decision |
| Cloud client package implementing the contracts above | 🔜 | after the hosted API exists |

## Parallel track — Adapters & ecosystem

`@miraiclip/react` hooks and selectors (Vue and Svelte adapters later), and a collaboration reference implementation syncing commands/patches over WebSocket.
