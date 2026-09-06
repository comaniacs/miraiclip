# Miraiclip — Plan & Feature List

An open source, framework-agnostic library for building video editors in the browser. Command-driven, AI-native, collaboration-ready. Reference point: [OpenVideo](https://docs.openvideo.dev/).

## Vision

Miraiclip is not a video editor app — it is the engine you build one with. The core is headless: it manages project state, a microsecond-precision timeline, and a full command history, with rendering delivered as a separate layer. Every mutation flows through a descriptive command, which makes the engine equally usable by a human clicking a UI, an LLM generating an edit sequence, or a sync layer replaying a collaborator's changes.

## Architectural pillars

1. **Command-Driven Architecture** — No imperative mutation of state. You dispatch descriptive commands (`ADD_CLIP`, `SPLIT_CLIP`, `MOVE_CLIP`, `SET_CLIP_PROPERTY`…). Each command is deterministic, validatable, serializable, and invertible. Commands can be batched into transactions that undo/redo as a unit.
2. **AI-Native** — Because commands are plain descriptive data with a published catalog and JSON schemas, LLMs can reason about the project state and emit valid command sequences. The command catalog doubles as the AI tool definition.
3. **Time Travel** — Built-in undo/redo backed by full history. Since every command is invertible (or paired with inverse patches), history is exact, replayable, and inspectable.
4. **Framework Agnostic** — The core has zero UI dependencies. Thin adapter packages expose idiomatic bindings for React, Vue, Svelte, or vanilla JS; the core also runs in Node for testing and server-side workflows.
5. **Collaboration-Ready** — State changes are emitted as granular patches (Immer-style JSON patches). Command + patch streams are the substrate for real-time multiplayer: broadcast commands, reconcile with patches, resolve conflicts at the command level.

## Core concepts

### Project State
The single source of truth for the composition — a Zustand (vanilla) store holding the timeline position, tracks, clips, assets, and playback state. Consumers subscribe to slices; the store is never mutated directly, only through the command dispatcher. State is fully serializable to JSON (save/load a project file).

### Commands
The only write path into the engine.
- Descriptive intents: `{ type: "clip/move", payload: { clipId, trackId, startUs } }`
- Validated against schemas before execution; invalid commands are rejected with typed errors.
- Deterministic: same state + same command = same result (a requirement for collaboration and AI replay).
- Batchable: transactions group commands into one history entry.
- Custom commands: consumers can register their own command types alongside the built-in catalog.

### Clips
The fundamental building blocks — video, audio, image, and text elements positioned on the timeline. Each clip has timeline placement (`startUs`, `durationUs`), source trimming (`trimStartUs`, `trimEndUs`), transform (position, scale, rotation, opacity), and type-specific properties. All clip operations (add, remove, move, trim, split, duplicate, property updates) go through commands.

### Tracks
Ordered containers that define layering (z-index) and group related clips. Track operations — create, remove, reorder, mute/solo, lock — are commands too. Track types (video/overlay vs audio) constrain what clips they accept.

### Timeline
Microsecond-based (1 s = 1,000,000 µs) for frame-accurate positioning at any frame rate. Utilities for µs ↔ frame ↔ timecode conversion, snapping, and overlap resolution.

### Events & Patches
A reactive event system for playback changes and state mutations. Because the engine is command-driven, changes are emitted as granular patches rather than "something changed" — subscribers (UIs, sync layers, loggers) get exactly what changed and can apply/invert it elsewhere.

### History
Undo/redo stacks built from command + inverse-patch pairs. Supports transaction grouping, history capping, and jumping to an arbitrary point (time travel).

## Feature list

### v1 — Core engine (`@miraiclip/core`) ✅ shipped 0.1.0 (2026-09-05)
- Project state store (Zustand vanilla) with JSON serialization/deserialization and schema versioning/migration
- Command dispatcher: validation, execution, typed errors, transactions/batching
- Command catalog: project, track, clip, playback-position, and asset commands
- Clips: video, audio, image, text; add/remove/move/trim/split/duplicate/property-set
- Tracks: create/remove/reorder/rename, mute/solo/lock, type constraints
- Asset registry: register media sources with metadata (duration, dimensions, fps) — no decoding in core
- Undo/redo with full history and transaction grouping
- Patch emission (JSON patches) + event system (state change, selection, playhead, history events)
- Timeline math utilities (µs/frames/timecode, snapping, gap/overlap helpers)
- Custom command registration API
- Runs in browser and Node (headless, fully unit-testable)
- TypeScript-first: exported types, command schemas (Zod or JSON Schema)

### v2 — Rendering & playback (`@miraiclip/renderer`) — current

Decisions (settled 2026-09): **PixiJS** compositor, **mediabunny** for demuxing (multi-container, µs-accurate seeking, WebCodecs-native; also covers v3 muxing), **WebCodecs-required** browser policy (capability check, no `<video>` fallback pipeline), v2.0 scope = **preview player with audio** (effects/transitions stay in v4). The renderer is framework-agnostic but browser-targeted; the core remains environment-agnostic.

Design review hardening (2026-09): the three layers below are **strict internal boundaries**, so later extraction is mechanical. (a) The compositor is a pure function of (document, timeUs) driven through a `Clock` interface — `AudioClock` for realtime playback, `StepClock` reused by v3 export, guaranteeing preview/export visual parity. (b) The media pipeline (demux/decode/cache) is renderer-independent — v3 export and thumbnail/waveform generation consume it directly; a central **MediaManager** owns one pipeline per *asset* (clips sharing an asset share it), a global frame/VRAM budget, a decoder-count cap with LRU release (Safari allows few hardware decoders), and abortable seeks so scrubbing cancels stale decode work. (c) Clip rendering goes through a **registry** (`clip.kind → renderer factory`, built-ins pre-registered) mirroring the core's custom commands — the v4 seam; this requires a clip-kind extension mechanism in core 0.2, since `Clip` is currently a closed union. Also settled: per-asset codec-capability errors are first-class (not just a global `isSupported()`); preview renders at a scaled resolution independent of project resolution (devicePixelRatio-aware); color is explicitly SDR/sRGB in v2 (HDR out of scope); silent projects fall back to the raw AudioContext clock; core is a peerDependency and a document `schemaVersion` bump requires a coordinated renderer release.

Architecture — three layers behind one `createRenderer(project, canvas, options)` API:

1. **Media pipeline** (per video/audio asset): mediabunny `Input` demuxes → `VideoDecoder`/`AudioDecoder` (WebCodecs) → a **frame cache** of decoded `VideoFrame`s around the playhead. Decoding runs in a Web Worker; frames transfer to the main thread. Cache policy: decode-ahead window (~1s forward, a few frames back), keyframe-aware seeking (seek to preceding keyframe, decode forward, drop until target), eviction by distance from playhead with a hard VRAM budget — `VideoFrame.close()` discipline is the critical correctness concern.
2. **Compositor**: a PixiJS `Application` whose scene graph mirrors `state.doc` — one container per track (z-order from `trackOrder`), one node per visible clip (video texture / image sprite / text). Subscribes to the core's patch events and applies granular updates (a `clip/move` patch touches one node, never a full rebuild). Renders on `requestVideoFrameCallback`-style ticks during playback and on-demand when paused (patch → single re-render).
3. **Playback controller**: the **AudioContext clock is the master**. Audio clips are decoded to `AudioBuffer`s and scheduled via Web Audio (volume, mute/solo from track state); video frames are selected by the audio clock's current time mapped to timeline µs. Play/pause/seek/scrub and a rate control; playhead position pushed back into the core via `setPlayhead` (ephemeral, no history).

v2.0 feature list:
- Asset loading from `src` (URL/File/Blob) with metadata probe (duration, dimensions, fps → validates the core's asset registry)
- Video, image, and text clips rendered with transform (position/scale/rotation/opacity), source trim, and track layering; audio clips mixed with clip volume and track mute/solo
- Frame-accurate play/pause/seek/scrub, loop, playback rate; `renderFrameAt(us)` for thumbnails/posters
- Reactive: any dispatched command updates the canvas via patches, including during playback and time travel (undo/redo just emits patches)
- Capability detection (`isSupported()`), typed error surface, `destroy()` that provably releases decoders, frames, and GL resources
- Testing: unit tests for cache/clock/MediaManager logic in Node (mocked WebCodecs); Playwright browser tests rendering deterministic fixture scenes with tolerance-based pixel compare (GPU output varies across machines)

Build order: (1) ✅ mediabunny demux + frame cache with tests (streaming decoder, frame-accurate settle-pattern seeks; **carry-over: decode still runs on the main thread — the planned Web Worker is not built**) → (2) ✅ Pixi compositor for image/text clips → (3) ✅ video textures from cached frames + `renderFrameAt`, verified in-browser on real long-GOP files (**carry-overs: Playwright golden-frame tests replaced by manual verification so far; VideoFrame→GPU direct upload still goes through a 2D canvas**) → (4) ✅ audio graph + audio-master clock + `createPlayer` transport (streaming-windowed decode, per-clip gain lanes with live mute/solo, ephemeral playhead; verified with sound on real files — occasional 1–2s frame stalls remain, attributed to main-thread decode contention) → (5) performance & hardening — **5a done**: the 1–2s frame stalls were re-diagnosed as **hardware decoder frame-pool exhaustion** (the cache held up to 120 undestroyed VideoFrames; decoders own ~8–16 output slots and stall when starved), fixed by converting every decoded frame to an ImageBitmap and closing the VideoFrame immediately (the canonical WebCodecs pattern); the same change gives **direct ImageBitmap→GPU upload**, deleting the 2D-canvas hop. **Web Worker decode is deferred with rationale**: decode already runs off-main inside WebCodecs, and after 5a the main thread does only cache bookkeeping and one texture upload per frame — re-open only if profiling shows otherwise. **5a addendum (4K60 hardening, user-verified smooth)**: profiling on bbb 4K60 exposed and fixed a chain of re-seek storms — re-seek decisions made deterministic in stream state (never decode timing); eviction detection via a contiguity watermark anchored at the seek target; FrameCache eviction changed to past-before-future (symmetric distance eviction discarded fresh decode-ahead, causing a re-seek every cache-capacity of playback); decode-ahead sized by measured frame spacing and the byte budget; proxy preview decode (`createWebCodecsDecoderFactory({ maxOutputDimensionPx })`) with fit-to-composition layout; dirty-flag rendering (paused scenes cost ~nothing); loud `onError` surfacing. Each fix carries a regression test proven failing against the previous code (53 total). **5b done**: golden-frame Playwright e2e (deterministic frame-index-as-color fixture; frame-exact mid-GOP seeks + displayed-frames-track-the-clock playback invariant; serial, against the built playground; CI job added), background-tab playback fixed (interval pump keeps decode/audio windows rolling while rAF is frozen), playground trailing-throttle UI fix. Scrub/cache tuning evaluated and closed with no further change — the deterministic re-seek redesign (watermark + past-before-future eviction + budget-adaptive ahead window) already removed every measured scrub pathology → (6) ✅ `@miraiclip/renderer@0.1.0` published to npm (2026-09-06; tarball verified: dist-only, core as peer dependency, ESM+CJS). **v2 complete.**

Open questions to settle during v2: worker↔main frame transfer strategy (transfer `VideoFrame` vs render-to-`ImageBitmap`); whether the Pixi dependency is `peerDependency` or bundled; WebGPU backend (Pixi v8 supports it) as an option flag now or later.

### v3 — Export ✅ (complete 2026-09-06, shipped as renderer 0.2.0)

Decisions (settled 2026-09-06, with user): export ships **inside `@miraiclip/renderer`** (shares the compositor/media pipeline seams; releases as renderer 0.2.0); **MP4 (H.264) + WebM (VP9)** both in the first cut, with per-browser codec probing (`canEncodeVideo`) and clear unsupported errors.

Architecture: the preview pipeline on a deterministic clock. A frame loop walks output frames (`renderFrameAt` awaits full-resolution decode — proxy decode off — and composites via the same Pixi backend onto an OffscreenCanvas at project resolution); each frame is handed to mediabunny's `Output` (`CanvasSource.add(t, dur)` — its promise IS the encoder/writer backpressure, which is what makes export faster-than-realtime without unbounded memory). Sequential monotonic time = zero re-seeks. Audio is mixed offline via `OfflineAudioContext` reusing AudioEngine's scheduling math (gains, trims, mute/solo), then added via `AudioBufferSource`. Progress events (phase + framesDone/totalFrames), cancellation via `AbortSignal`, quality presets mapped to mediabunny `QUALITY_*` with bitrate override.

Known risks (grilled): offline audio memory ~230MB/10min stereo (chunked rendering is the v3.x escape hatch); many-asset timelines can thrash the decoder LRU cap (acceptable at v3 scope); H.264 encode unavailable in some browsers → probe + error, e2e uses VP9/WebM (Playwright Chromium has no H.264).

Build order (1–4 ✅ complete 2026-09-06; 71 headless + 5 e2e tests green): (1) export orchestrator + `ExportSink` interface, headless-tested with fakes (frame walk, rounding to exact composition end, progress, abort mid-run, sink error propagation) → (2) offline audio mix (scheduling plan headless-tested; OfflineAudioContext adapter) → (3) mediabunny sink adapter + presets + codec probing → (4) playground Export button + closed-loop golden e2e (export the frame-index fixture, re-import with our own demuxer, assert frame colors) → (5) docs + changelogs ✅; (5) docs + changelogs ✅ → user-verified in real Chrome (MP4 High, 4K60 source: no judder, ~1.5× realtime after pipelining) → changeset added for 0.2.0 (publish via the changesets flow). Post-ship perf round: pipelined encoding (bounded encoder in-flight window, `encodeAheadFrames` default 4; sinks capture synchronously — an explicit `ExportSink` contract), unclamped MessageChannel macrotask in `waitForFrame` (nested setTimeout's ~4ms clamp capped exports at ~60fps), playground output-fps select (Source/30/24).

### v3.x — Server-side export ✅ (complete 2026-09-06, shipped as @miraiclip/server-export 0.1.0)

Decision (2026-09-06, with user): build after 0.2.0 ships. Approach: **the same `exportProject` in headless Chromium** (Playwright), NOT a native Node pipeline — rebuilding decode/composite/encode on ffmpeg + a software canvas forfeits preview/export parity, which is the product guarantee. A new package (working name `@miraiclip/server-export`) exposes `exportProjectFile(docJson, options)` + a CLI: launch Chromium, load a minimal harness page, hydrate the project from JSON, run `exportProject`, write the bytes to disk. The CI e2e suite already proves this exact shape works headlessly (SwiftShader software GL included). Knowns to solve: (a) a clean hydrate-from-doc-JSON entry point in core; (b) asset `src` resolution on the server (URLs, or the harness serves local files); (c) MP4 needs codecs-enabled Chrome — stock Playwright Chromium is WebM-only; (d) throughput measurement on software GL. Built 2026-09-06 (14 tests green, incl. real-Chromium integration + CLI smoke): `packages/server-export` — `exportProjectFile` + `miraiclip-export` CLI; harness bundle self-contained (core+renderer baked in via tsup iife, version-locked); loopback static server with Range support (media decode seeks by byte range); asset resolution (explicit map → http(s)/data pass-through → assetsDir); browser resolution executablePath → MIRAICLIP_BROWSER → system Chrome via playwright-core (no install-time download; real Chrome carries H.264 — free Chromium is WebM-only); SwiftShader default on Linux; progress/abort forwarded across the process boundary (ServerExportAbortedError); hydration was free — `createProject` already accepts a ProjectDocument. CI runs the integration in the e2e job (Playwright's Chromium via MIRAICLIP_BROWSER). Explored & rejected: Obscura (Rust engine, no WebCodecs/WebGL/WebAudio); native Node/ffmpeg (parity loss); note Remotion's path validates ours (Chromium → Thorium → Chrome Headless Shell for codecs). User-verified 2026-09-06 (CLI + API, incl. MP4 via real Chrome). Release prepped: private flag dropped, changeset added (minor → 0.1.0), docs banner removed; publishes via the changesets flow. Also in v3.x: chunked offline audio rendering (memory).

### v4 — Creative features
- Animations (keyframes on clip properties), transitions, effects/filters (shader-based), captions, chroma key

### Adapters & ecosystem (parallel track)
- `@miraiclip/react` (hooks/selectors), later Vue and Svelte adapters
- AI helpers: command catalog export for LLM tool-use, prompt-to-commands examples
- Collaboration reference: patch/command sync example (e.g. over WebSocket; CRDT exploration later)
- Docs site with core-concepts pages mirroring this plan; example editor app

## Repository structure (pnpm monorepo)

```
miraiclip/
├── packages/
│   ├── core/          # @miraiclip/core — v1 focus
│   ├── renderer/      # @miraiclip/renderer (v2)
│   ├── react/         # @miraiclip/react
│   └── ...            # vue, svelte, export utils
├── apps/
│   ├── docs/          # documentation site
│   └── playground/    # example editor
├── package.json       # pnpm workspace
└── PLAN.md
```

Tooling: TypeScript, pnpm workspaces, Vitest, tsup (or Vite lib mode) for builds, Changesets for versioning/publishing, ESLint + Prettier, CI on GitHub Actions.

## v1 build order

1. Scaffold monorepo + `@miraiclip/core` package with types for ProjectState, Track, Clip, Asset
2. Zustand vanilla store + JSON (de)serialization
3. Command dispatcher with validation and typed errors
4. Track and clip commands with unit tests (the bulk of v1)
5. Patch emission via Immer patches; event emitter
6. History (undo/redo) from inverse patches; transactions
7. Timeline utilities; custom command API
8. Docs for core concepts + command catalog reference; publish 0.1.0

## Open questions (decide during v1)

- Command schema library: Zod (great DX) vs plain JSON Schema (portable to LLM tool definitions) — or Zod with JSON Schema export
- Patch format: Immer patches vs RFC-6902 JSON Patch (RFC-6902 is more interoperable for collaboration)
- ID strategy: nanoid vs ULID (ULIDs sort by creation time, handy for sync)
- Whether playback *position* lives in core state (undoable? probably excluded from history) — OpenVideo keeps it in the store but outside history
