---
title: Changelog
weight: 8
---

All notable changes to Miraiclip. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/). The canonical file lives at [`CHANGELOG.md`](https://github.com/comaniacs/miraiclip/blob/main/CHANGELOG.md) in the repo.

## renderer-0.2.0 — 2026-09-06

### Added

- `@miraiclip/renderer` offline export (v3): `exportProject` → MP4 (H.264+AAC) or WebM (VP9+Opus), full-resolution, faster than realtime (backpressure-paced, zero re-seeks, midpoint frame sampling, per-frame wait-for-arrival (fixes duplicated-frame judder), decode capped at 2× output size (fixes 4K-source export speed)), offline audio mix sharing live playback's clip math, quality presets, up-front codec probing, AbortSignal cancellation (including mid-audio-mix), progress events for both phases (audio reports seconds mixed — long timelines decode their full audio). Playground Export button with In/Out range marks; closed-loop e2e verifies the file with an independent decoder (frame colors, duration, audio RMS). See the [Export](../export) guide.
- `@miraiclip/renderer` pipelined export encoding: a bounded in-flight window of encoder submissions (`encodeAheadFrames`, default 4) plus an unclamped macrotask yield in the frame-arrival poll (nested `setTimeout` is clamped to ~4ms) — decode, compositing, and encoding now overlap instead of running in lockstep, which had measured ~realtime with an idle CPU. Sinks capture the canvas synchronously inside `addVideoFrame` (explicit contract); memory stays bounded and error/abort paths still cancel the sink exactly once. Playground export gains an output-fps select (Source/30/24) — a lower rate cuts export time proportionally.

## renderer-0.1.0 — 2026-09-06

First release of `@miraiclip/renderer` — WebCodecs media pipeline, PixiJS compositor, audio-master playback (`createPlayer`), frame-accurate seeking, proxy preview decode. Everything below shipped in it.

### Added

- Golden-frame e2e suite (Playwright): a deterministic fixture whose every frame encodes its own index as a color — frame-exact mid-GOP seek tests and a displayed-frames-track-the-clock playback invariant, GPU-independent (`pnpm --filter miraiclip-playground e2e`; CI job included). `createPixiBackend` gains `preserveDrawingBuffer`.
- `@miraiclip/renderer` proxy preview decode: `createWebCodecsDecoderFactory({ maxOutputDimensionPx: 1920 })` decodes large sources down to preview resolution on the GPU — fixes dropped frames on 4K60 playback (full-res was ~4 GB/s of frame copies + uploads). Scene nodes normalize scale against the source's native size (`setSourceSize`), so clips render at the same size at any decode resolution; `createWebCodecsDecoder` stays full-res for export.
- `@miraiclip/renderer` audio playback + `createPlayer` facade: streaming-windowed audio decode scheduled on WebAudio (clip volume × track mute/solo, trim-aware, video clips' embedded tracks included), audio-master clock, full transport, playhead pushed to the core as ephemeral state. Playground plays sound.
- [Rendering](../rendering) guide documenting the in-development `@miraiclip/renderer`: the three layers, quick start, frame-accurate seek behavior, exact-frame API, and browser support.
- `@miraiclip/renderer` video playback: `createVideoSupport` wires cached WebCodecs frames into compositor nodes (timeline→media time mapping incl. trim, throttled decode-ahead), `renderFrameAt` for exact single frames, Pixi video textures, and a Vite playground app playing real MP4s end to end.
- `@miraiclip/renderer` compositor: patch-driven scene graph as a pure function of time behind a `SceneBackend` abstraction, clip-kind node factory registry, and the PixiJS backend for image/text clips.
- `@miraiclip/renderer` package started with the v2 media layer: frame cache with eviction budgets and strict frame ownership, keyframe-aware abortable video pipeline, a MediaManager capping decoder use with LRU release, Step/Realtime clocks behind the `Clock` interface, and mediabunny + WebCodecs browser adapters with per-asset capability errors.

### Changed

- `@miraiclip/renderer` frame-accurate seeking via the WebCodecs settle pattern: post-seek lead-in frames are decoded but never presented, so a seek holds the last frame and snaps straight to the target — verified in-browser against a worst-case 5s-GOP file, paused and mid-playback. Playground DOM writes throttled (were ~120 layouts/sec).
- `@miraiclip/renderer` seek performance audit: removed `verifyKeyPackets` (a hidden per-seek decode pass), cached the decoder config/capability check per asset, and merged the keyframe lookup into one `chunksFrom(target)` seek. Simplified the display back to "nearest decoded frame" and dropped the extra hold/tolerance/buffering machinery.
- `@miraiclip/renderer` smoother seeks: decoder reuse via `reset()` (no per-seek hardware re-init), WebCodecs `optimizeForLatency`, cache-clear on hard seek, and deduped GPU uploads. A seek now holds the last frame through the decode gap and cuts cleanly to the target — no backward-jump/fast-forward shake — and the playground pauses the clock while seeking, resuming from the exact point.
- `@miraiclip/renderer` video pipeline reworked to continuous streaming decode — one long-lived decoder fed forward with a backpressure window, re-seeking only on real jumps. Removes the periodic playback stutter from per-second decoder teardown. Playground duration cap removed; preview is video-only (audio is step 4).
- Package homepage now points at this documentation site; docs linked from the package and repo READMEs; "not yet published" notes removed after the 0.1.0 npm release.

### Fixed

- `@miraiclip/renderer` hidden-tab playback: a timer now keeps decode/audio windows rolling while rAF is frozen, so audio no longer stalls ~3s after the tab is hidden (`createPlayer` accepts injectable `schedule`/`cancelSchedule`). Playground: paused-seek UI staleness fixed (trailing-edge throttle).
- `@miraiclip/renderer` re-seek decisions now use a contiguity watermark (highest timestamp below which every frame has arrived): an out-of-order/straggling frame conversion can no longer be mistaken for an eviction and trigger a stream re-seek — profiling on 4K60 showed those spurious re-seeks (~1/sec, each redecoding 100–300 lead-in frames) were the remaining playback stutter. The watermark anchors at the seek target (not the first arrival), so a slow first conversion after a seek cannot re-trigger the seek. Frame-cache eviction is past-before-future (drop behind frames first): symmetric distance eviction was discarding fresh decode-ahead output whenever the behind-tail was short, causing a re-seek every cache-capacity of playback (~1.07s at 4K60).
- `@miraiclip/renderer` 4K playback decode storm fixed: the decode-ahead window is sized by measured frame spacing (not reported durations, which some streams omit), and the frame under the playhead can never be evicted — dropped-frame playback measured at 3–6× decode overwork is gone. Clips also render fit-to-composition (scale 1 = contain) instead of native-pixel cropping.
- `@miraiclip/renderer` re-seeks are decided from stream state, not decode timing: async frame arrival (long at 4K) no longer reads as a cache miss, ending the re-seek loop behind the black-video + pegged-CPU reports. Decode-ahead adapts to the frame-cache byte budget (4K decodes less ahead instead of decoding into eviction), and the Pixi backend skips rendering when nothing changed (a paused frame no longer burns GPU at 60fps). Regression tests cover the async-arrival storm and the budget churn.
- `@miraiclip/renderer` black video + pegged CPU on streams reporting zero frame durations (e.g. 4K60 H.264): duration fallback in the WebCodecs adapter, a strictly-before settle check (the frame at the seek target is always presentable), and a duration-defensive covering check in the pipeline (no more infinite reseek loop). Regression-tested.
- `@miraiclip/renderer` media errors now surface: `createPlayer`/`createVideoSupport` take `onError(error, clipId)` (default: loud `console.error`) instead of silently swallowing decode and pipeline failures.
- CI on fresh checkouts: packages now expose source `exports` in development with `publishConfig` restoring dist exports at publish — no pre-build needed for typecheck/tests/playground; published tarballs unchanged.
- Periodic playback stalls: decoded frames starved the hardware decoder's small output pool. Frames are now copied to ImageBitmaps and released immediately, and upload straight to the GPU (no 2D-canvas hop).


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
