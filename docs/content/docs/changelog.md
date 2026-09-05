---
title: Changelog
weight: 6
---

All notable changes to Miraiclip. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/). The canonical file lives at [`CHANGELOG.md`](https://github.com/comaniacs/miraiclip/blob/main/CHANGELOG.md) in the repo.

## Unreleased

### Changed

- `@miraiclip/renderer` frame-accurate seeking via the WebCodecs settle pattern: post-seek lead-in frames are decoded but never presented, so a seek holds the last frame and snaps straight to the target — verified in-browser against a worst-case 5s-GOP file, paused and mid-playback. Playground DOM writes throttled (were ~120 layouts/sec).
- `@miraiclip/renderer` seek performance audit: removed `verifyKeyPackets` (a hidden per-seek decode pass), cached the decoder config/capability check per asset, and merged the keyframe lookup into one `chunksFrom(target)` seek. Simplified the display back to "nearest decoded frame" and dropped the extra hold/tolerance/buffering machinery.
- `@miraiclip/renderer` smoother seeks: decoder reuse via `reset()` (no per-seek hardware re-init), WebCodecs `optimizeForLatency`, cache-clear on hard seek, and deduped GPU uploads. A seek now holds the last frame through the decode gap and cuts cleanly to the target — no backward-jump/fast-forward shake — and the playground pauses the clock while seeking, resuming from the exact point.
- `@miraiclip/renderer` video pipeline reworked to continuous streaming decode — one long-lived decoder fed forward with a backpressure window, re-seeking only on real jumps. Removes the periodic playback stutter from per-second decoder teardown. Playground duration cap removed; preview is video-only (audio is step 4).

### Added

- `@miraiclip/renderer` video playback: `createVideoSupport` wires cached WebCodecs frames into compositor nodes (timeline→media time mapping incl. trim, throttled decode-ahead), `renderFrameAt` for exact single frames, Pixi video textures, and a Vite playground app playing real MP4s end to end.
- `@miraiclip/renderer` compositor: patch-driven scene graph as a pure function of time behind a `SceneBackend` abstraction, clip-kind node factory registry, and the PixiJS backend for image/text clips.
- `@miraiclip/renderer` package started with the v2 media layer: frame cache with eviction budgets and strict frame ownership, keyframe-aware abortable video pipeline, a MediaManager capping decoder use with LRU release, Step/Realtime clocks behind the `Clock` interface, and mediabunny + WebCodecs browser adapters with per-asset capability errors.

### Changed

- Package homepage now points at this documentation site; docs linked from the package and repo READMEs; "not yet published" notes removed after the 0.1.0 npm release.

## 0.1.0 — 2026-09-05

First release of `@miraiclip/core`.

### Added

- **Project state** — Zustand (vanilla) store: composition document under `state.doc`, ephemeral `playheadUs`/`selection` beside it, selector subscriptions.
- **Command engine** — `dispatch` with Zod v4 validation and Immer application; typed errors leave state untouched on failure.
- **15 built-in commands** across `project/`, `asset/`, `track/`, and `clip/` namespaces, with semantic validation (entity existence, track-kind constraints, asset-in-use protection, split-range checks).
- **History** — undo/redo from inverse patches; atomic `transaction(fn, label?)` with rollback on failure; configurable history limit.
- **Patches & events** — every document change emitted as RFC-6902 JSON Patch ops with inverses and a `source` tag; `patches`, `history`, `playhead`, `selection` events.
- **AI catalog** — `commandCatalog()` exports one JSON Schema per command type, suitable as LLM tool definitions.
- **Custom commands** — `registerCommand({ type, schema, handler })` with full validation/history/patch semantics.
- **Serialization** — `toJSON()` round-trips through `createProject`, with `schemaVersion` checking.
- **Timeline utilities** — µs ↔ seconds/frames/timecode, frame snapping, range overlap.
- **Sync utilities** — `applyJsonPatches` and `fromJsonPointer`: apply emitted RFC-6902 patches to a plain document copy, the follower side of collaboration.
- **Determinism & collaboration tests** — replayed command scripts converge, leader→follower patch sync, inverse-patch rollback, undo/redo round-trips, history-limit eviction, frame-boundary splits, JSON Pointer escaping (26 tests).
- **Tooling** — pnpm monorepo, tsup build (ESM + CJS + d.ts, verified exports), Vitest, strict TypeScript, CI, Changesets.
- **This docs site** — Hugo + Hextra, including the [Command Catalog](../command-catalog) reference generated from the actual schemas.
