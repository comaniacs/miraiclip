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

### v1 — Core engine (`@miraiclip/core`)
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

### v2 — Rendering & playback (`@miraiclip/renderer`)
- WebCodecs-based demux/decode pipeline with frame caching
- WebGL compositor (PixiJS or custom) rendering the project state to a canvas
- Frame-accurate playback: play/pause/seek/scrub, audio sync via Web Audio
- Real-time preview of transforms, opacity, layering

### v3 — Export
- WebCodecs encode pipeline → MP4/WebM (mp4-muxer / webm-muxer)
- Offline (faster-than-realtime) render from project state
- Progress events, cancellation, quality presets

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
