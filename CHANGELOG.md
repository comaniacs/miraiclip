# Changelog

All notable changes to Miraiclip are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Changed

- `@miraiclip/renderer` **frame-accurate seeking** (the canonical WebCodecs settle pattern): after a hard seek, decode lead-in frames are closed instead of cached, so the display can never rewind to the keyframe or fast-forward through the GOP — it holds the last frame and snaps straight to the target. Verified in-browser against a worst-case 5-second-GOP file: mid-GOP seeks (120+ lead-in frames) resolve frame-accurately within a screenshot's latency, paused and during playback.
- Playground: DOM writes (status text, slider position) throttled to 5/s and change-gated — they were forcing ~120 layouts and style recalcs per second on the thread shared with decode callbacks and GPU uploads, plus detached-node churn. Also: load a video by URL via `/?src=`.
- `@miraiclip/renderer` **seek performance audit** — removed real per-seek overhead that had nothing to do with decoding: dropped `verifyKeyPackets` (it decoded packets just to confirm keyframes, on every seek, twice), **cached the decoder config + capability check** so they run once per asset instead of per seek, and folded the keyframe lookup into a single `chunksFrom(target)` seek (was two). Also simplified the over-built display path back to "show the nearest decoded frame" (removed `keepBehindUs`/`displayToleranceUs` hold logic and the playground buffering gate) and removed the now-unused `keyframeAtOrBefore`/`anchorUs`. Net: fewer moving parts and materially faster timeline navigation.
- `@miraiclip/renderer` seek latency reduced: the decoder is now **reused across seeks** via `reset()` (no hardware re-init per seek), lead-in frames are **kept as a progressive-refinement placeholder** (a cold seek paints the keyframe immediately, then refines to the exact frame), and WebCodecs runs with `optimizeForLatency`. `FrameDecoder` gains a `reset()` method.
- `@miraiclip/renderer` seek smoothness: a hard seek now **clears the frame cache** so the display holds the last correct frame instead of flashing stale content from the previous position; the Pixi video node **dedupes GPU uploads** (uploads a decoded frame once instead of every animation tick); decode-ahead trimmed to 1s so seeks waste less decode work.
- `@miraiclip/renderer` seek no longer shows a backward-jump/fast-forward shake: the pipeline drops lead-in frames far behind the target (`keepBehindUs`) and the video node only swaps to a frame within `displayToleranceUs` of the playhead, **holding the last frame through the decode gap** and then cutting cleanly to the target. Playground adds a buffering gate that pauses the clock while seeking and resumes from the exact point.
- `@miraiclip/renderer` `VideoPipeline` reworked to **continuous streaming decode**: one decoder is kept alive and fed forward with an ahead-window as backpressure, re-seeking only on a backward jump to an evicted frame or a large forward jump. This removes the per-second decoder teardown/keyframe re-seek that caused periodic playback stutter. Decode-ahead defaults widened (2s ahead, 120-frame cache). Playground no longer caps duration at 2 minutes and states video-only preview (audio is step 4).

### Added

- `@miraiclip/renderer` video playback (v2 step 3): `createVideoSupport` bridges the MediaManager into the compositor — video scene nodes pull cached frames on every tick via the new time-aware `tick` hook, keep decode-ahead primed with throttled re-priming, and map timeline time through clip start + source trim; `renderFrameAt` draws one exact frame (thumbnails/posters/export); Pixi video node renders `VideoFrame`s through a canvas-backed texture. MediaManager now memoizes in-flight acquisitions so concurrent clips of one asset share a single pipeline (race fixed). Playground app (`apps/playground`, Vite) plays a real MP4 through the full command → patch → compositor → WebCodecs pipeline with play/pause/seek/loop and a text overlay.
- `@miraiclip/renderer` compositor (v2 step 2): `Compositor` renders the document as a pure function of time behind a `SceneBackend` abstraction, subscribing to the core's patch events for granular scene updates (undo/redo and remote patches included); pixel placement from normalized transforms; per-track stacking; clip-kind **node factory registry** (the custom-kind/v4 seam); `createPixiBackend` — the PixiJS implementation for image and text clips with manual render ticks. Compositor fully tested headless with a fake backend (9 tests).
- `@miraiclip/renderer` package started (private until its first release) with the v2 media layer: `FrameCache` (distance-based eviction, byte budget, strict `close()` ownership), `VideoPipeline` (keyframe-aware seeking, decode-ahead, abortable priming via generations), `MediaManager` (one pipeline per asset, decoder cap with LRU release), `StepClock`/`RealtimeClock` behind the `Clock` interface, and browser adapters for mediabunny demuxing + WebCodecs decoding with per-asset capability errors (`UnsupportedMediaError`). Fully unit-tested headless (14 tests) behind demuxer/decoder interfaces.

### Changed

- Package homepage now points at the documentation site (https://comaniacs.github.io/miraiclip/); docs linked from the package and repo READMEs; "not yet published" notes removed after the 0.1.0 npm release.

## [0.1.0] — 2026-09-05

First release of `@miraiclip/core`.

### Added

- **Project state**: Zustand (vanilla) store with the composition document under `state.doc` and ephemeral session state (`playheadUs`, `selection`) beside it; selector subscriptions via `project.subscribe`.
- **Command engine**: `dispatch` validates payloads with Zod v4 schemas and applies them via Immer; typed errors (`CommandValidationError`, `CommandRejectedError`, `UnknownCommandError`) guarantee state is untouched on failure.
- **Built-in command catalog** (15 commands): `project/set-settings`; `asset/add`, `asset/remove`; `track/add`, `track/remove`, `track/reorder`, `track/rename`, `track/set-property`; `clip/add`, `clip/remove`, `clip/move`, `clip/trim`, `clip/split`, `clip/duplicate`, `clip/set-property` — with semantic validation (entity existence, track-kind constraints, asset-in-use protection, split-range checks).
- **History**: undo/redo from inverse patches, `canUndo`/`canRedo`/`clearHistory`, configurable history limit; `transaction(fn, label?)` groups dispatches into one atomic history entry with rollback on failure.
- **Patches & events**: every document change emitted as RFC-6902 JSON Patch ops (with inverses and a `source` tag) on a typed emitter — `patches`, `history`, `playhead`, `selection`.
- **AI catalog**: `project.commandCatalog()` exports one JSON Schema per command type (built-in and custom) via Zod's native converter, suitable as LLM tool definitions.
- **Custom commands**: `project.registerCommand({ type, schema, handler })` with full validation/history/patch semantics.
- **Serialization**: `project.toJSON()` round-trips through `createProject`, with `schemaVersion` checking.
- **Timeline utilities**: µs ↔ seconds/frames/timecode conversion, frame snapping, range overlap.
- **Sync utilities**: `applyJsonPatches` and `fromJsonPointer` — apply the engine's emitted RFC-6902 patches to a plain document copy, the follower side of the collaboration story.
- **Determinism & collaboration test suite** (`test/replay.test.ts`): identical documents from replayed command scripts, leader→follower patch sync, inverse-patch rollback, full undo/redo round-trips, history-limit eviction, frame-boundary splits, JSON Pointer escaping in entity ids (26 tests total).
- **Tooling**: pnpm monorepo, tsup build (ESM + CJS + type declarations, split per-condition `exports` verified with publint and arethetypeswrong), Vitest, strict TypeScript, CI workflow (typecheck/test/build on push and PR), Changesets release tooling (`pnpm changeset`, `pnpm release`).
- **Docs site** under `docs/`: Hugo + Hextra with landing page, quickstart, core-concepts pages, Command Catalog reference (generated from the actual Zod schemas), roadmap, and this changelog.

[Unreleased]: https://github.com/comaniacs/miraiclip/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/comaniacs/miraiclip/releases/tag/v0.1.0
