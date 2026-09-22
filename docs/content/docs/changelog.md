---
title: Changelog
weight: 12
---

All notable changes to Miraiclip. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/). The canonical file lives at [`CHANGELOG.md`](https://github.com/comaniacs/miraiclip/blob/main/CHANGELOG.md) in the repo.

## Unreleased

### Added

- **`@miraiclip/mcp`** (new package) — an MCP server so Claude, Codex, or any MCP client can edit a project: validating `dispatch` with self-correctable failures, transactional `apply_commands` (one undo step), undo/redo, `preview_frame` (a PNG the agent sees, rendered through the export pipeline by one warm headless Chrome), and `export` to file. Edits autosave the project JSON atomically. See [MCP Server](/miraiclip/docs/mcp-server/).
- `@miraiclip/renderer` **`renderProjectStill`** — render one composition frame to an image through the exact export pipeline (thumbnails, poster frames, agent previews).
- `@miraiclip/server-export` **`createRenderSession`** — a warm headless-Chrome still renderer: launch once, render frames in ~100ms each across edits.

### Fixed

- `@miraiclip/renderer` **`exportProject`'s `width`/`height` output size was silently ignored** (the compositor resized the canvas back to the composition size — the output was always composition-sized). The compositor gained `outputSize`; exports and stills now honor the requested size while composition coordinates stay unchanged.

## core-0.3.0 — 2026-09-22

### Added

- `@miraiclip/core` **AI command interface** — turn the command catalog into a working LLM integration, in core with zero new dependencies: `toToolDefinitions` (Anthropic/OpenAI tool shapes; per-command or single-dispatch mode), `tryDispatch`/`applyCommands` (machine-readable failures an agent can self-correct from; batches apply as one all-or-nothing transaction = one undo step), and `describeProject` (a compact, deterministic state summary for prompts). See [AI Integration](/miraiclip/docs/ai-integration/).

## renderer-0.4.1 — 2026-09-22

### Fixed

- `@miraiclip/renderer` **unbounded memory growth across long timelines**: finished clips retained their demuxer's fetched-range cache (mediabunny `Input`s cache up to 64MiB of source ranges each; the adapters never disposed them, and clip nodes keep their disposed pipeline reachable after a clip ends). On large sources this grew without bound — a field-reported 257s 4K export exhausted the machine. Video and audio adapters now dispose the underlying `Input` when released, freeing each cache immediately. Measured on a 91MB 4K fixture: export heap growth cut from 51→262MB to 79→147MB, stair-step gone.

- `@miraiclip/renderer` **unbounded GPU memory with software encoders on real GPUs**: long WebM exports (no hardware VP9 encoder on macOS) retained one GPU capture image per frame behind the slow software encode and could exhaust the machine. Capture now routes through the CPU mirror whenever the chosen codec has no hardware encoder at the output size; MP4/H.264 on hardware keeps the zero-copy path. New probe: `hasHardwareVideoEncoder(format, width, height)`.

- `@miraiclip/renderer` **listener churn during exports**: the frame-wait loop created a MessageChannel per yield, piling up tens of thousands of dead 'message' listeners awaiting GC over a long export. One shared channel now serves every yield (measured: peak listeners 2,776 → 61 on the same export).

### Added

- `@miraiclip/renderer` **worker export** — run the whole export off the main thread: `exportProjectInWorker(project, options)` (auto-spawns the bundled entry) or `exportViaWorker(worker, project, options)` with your own Worker (`@miraiclip/renderer/export-worker` subpath). Streaming `target` (chunks relay via main — file writables aren't transferable), progress, abort, fonts, captions, effects and transitions all work in the worker; audio mixes on main and crosses as PCM; custom clip-kind factories are main-thread-only. See [Export · Exporting in a worker](/miraiclip/docs/export/client-side/#exporting-in-a-worker).

## renderer-0.4.0 · server-export-0.2.0 — 2026-09-13

### Added

- `@miraiclip/renderer` **streaming export output** — `exportProject({ target })` writes encoded chunks to a `WritableStream` (a `showSaveFilePicker()` writable works directly) as the file is produced; nothing accumulates in memory. See [Export · Streaming to disk](/miraiclip/docs/export/client-side/#streaming-to-disk).
- `@miraiclip/renderer` **chunked offline audio mixing** — export audio mixes in bounded sequential chunks (`audioChunkSeconds`, default 60) interleaved with the frame walk instead of one whole-timeline buffer (~1.4GB/hour before). Together with streaming, **export memory no longer scales with timeline length** (stress run: ~2MB settled heap spread; a demonstrated one-hour export — 86,400 frames, an hour of audio, 984MB streamed — peaked at 165MB heap at 1.6× realtime on a dev laptop). Not breaking: `exportComposition`'s whole-range `mixAudio` is unchanged; the chunked contract is the new `mixAudioChunk`.
- `@miraiclip/server-export` **streams exports to disk** — with `out`, chunks stream from the browser into the file (flat memory; result is `{ filePath, bytesWritten }`, no `bytes` — breaking for callers that used both); without `out`, `{ bytes }` is unchanged.
- **Export validation corpus** (`pnpm corpus`, nightly) — real exports verified by ffmpeg/ffprobe (an independent decoder): whole-file PTS + per-frame pixel checks through cuts/dissolves/resampling, audio cases, A/V sync (measured 0ms offset), and streamed-vs-buffered byte-identity.

### Fixed

- `@miraiclip/renderer` **same-asset concurrency wedged playback** (caught by the device benchmark tier): two clips of the SAME asset visible at once — picture-in-picture of one source, echo overlays — shared one decode pipeline and fought over its seek target every frame, wedging playback. Concurrent clips of one asset now each get a **dedicated pipeline** (as transition overlaps already did); sequential clips (splits, cuts) keep sharing. The pipeline LRU also now tracks per-frame use and never evicts an actively used pipeline — the cap is temporarily exceeded instead (new `evictionIdleMs` option, default 500ms).
- `@miraiclip/renderer` **pipeline-eviction blackout** (caught by the new stress suite): the pipeline cap (engine default 4, configurable) evicts least-recently-used pipelines, but clips cached theirs forever and every clip acquired one at mount — long multi-asset timelines, or timelines whose transition participants outnumbered the cap, went **permanently black**. Acquisition is now lazy and self-healing (`VideoPipeline.isDisposed` + re-acquire on tick/prepare); eviction costs one frame of catch-up.
- `@miraiclip/renderer` **unbounded GPU memory in software-GL exports**: under SwiftShader/llvmpipe (headless CI, some VMs — real GPUs unaffected), Chromium retains one GPU shared-image per captured frame while decode and encode run together, growing a 5-minute export to ~4GB. `exportProject` now detects software WebGL and routes capture through a CPU mirror automatically (flat ~300MB); real GPUs keep the zero-copy path.

### Added

- **Production-readiness stress tier** (`pnpm stress`): many-clip playback tracking, bounded-heap long exports, decoder churn with a scrub storm, export throughput benchmarks (incl. optional 4K→1080p), and parallel server exports — nightly in CI with a metrics artifact. See [Production Readiness](/miraiclip/docs/production-readiness/).
- `@miraiclip/renderer` `createMediabunnySink({ cpuCapture })` and `isSoftwareWebGL(canvas)` exported for custom export sinks in headless environments.

## core-0.2.0 · renderer-0.3.0 · server-export-0.1.1 — 2026-09-12

The coordinated v4 creative-features release (server-export 0.1.1 = rebuilt harness bundling renderer 0.3.0).

### Fixed

- `@miraiclip/renderer` replay flicker under animated opacity: play and seek-while-playing now hold the transport (≤400ms) until the target frame has decoded and arrived, so the clock never runs over an empty or stale frame cache — the black/stale pops an opacity ramp made visible at playback starts and replays are gone, and audio restarts in sync with the ready frame.

### Added

- `@miraiclip/renderer` custom clip-kind factories: `createPlayer` and `exportProject` accept `factories` (clip kind → scene-node factory) — register a kind with core's `registerClipKind`, pass the same factories to both, and it renders identically in preview and export. See [Rendering](../rendering).
- Docs: a live [Examples](../../examples) showcase — full-width sections with variant carousels (every transition kind, effect preset, and caption style) running in your browser against the real engine; the code shown is the code executed.
- `@miraiclip/renderer` karaoke captions rendered (v4 step 5): caption clips draw with word wrap, per-line centering, and all four presets (plain, highlight, karaoke, pop); font assets load as real FontFaces in both the live player and exports — a server export never falls back to default glyphs; SRT/VTT and ASR imports render end to end; playground Captions tab added. Color-census e2e: passed words stay lit across a word boundary, the highlight flips sides exactly at it. See [Rendering](../rendering).
- `@miraiclip/renderer` transitions rendered (v4 step 4): crossDissolve, dipToBlack, dipToWhite, wipe, and slide now draw — blend kinds render both clips through the window from source headroom (each participating clip gets a dedicated decode pipeline), dips cover the cut with an overlay that is fully opaque exactly at the cut, and every kind applies an equal-power audio crossfade through the same automation math as keyframed volume (identical in preview and export). Pixel-asserted e2e incl. re-decoding a dissolve out of an exported file. See [Rendering](../rendering).
- Playground quick-test side panel: Effects / Text / Animate / Transitions tabs of one-click preset cards + undo/redo, all driving the ordinary command surface. Transition cards split the video at the playhead, jump the incoming side 1s ahead (so the cut is visible), and bridge it.
- `@miraiclip/renderer` effects rendered (v4 step 3): colorAdjust, blur (composition-relative strength — identical look in preview and export), and a GLSL chroma key (chroma-distance keying, soft edges, spill suppression) applied per clip through the compositor; filters update in place on param changes. Pixel-asserted e2e incl. re-decoding a keyed export. See [Rendering](../rendering).
- `@miraiclip/renderer` animations applied (v4 step 2): the compositor evaluates keyframes every render (animated transform/opacity live on canvas; exports inherit it — same compositor), and animated volume rides linear gain ramps through shared automation math (`volumeAutomation`) used identically by live playback and the offline export mixer. Closed-loop e2e: an opacity ramp lands on exact pixel values; an exported volume fade shows the right RMS decay.
- `@miraiclip/core` v4 creative-features model (step 1): per-property keyframes with bézier-backed easings + a pure alloc-free evaluator (`evaluateClipAt`); per-clip effect stacks with built-in schemas (colorAdjust, blur, chromaKey — params in composition units); transitions on the adjacent-clips + trim-handles model with adjacency/headroom validation; karaoke `caption` clip kind with font assets, SRT/VTT parsing, and ASR word-timestamp import; `registerClipKind`/`registerEffectKind`/`registerTransitionKind` extension seams. All new commands are in the [command catalog](../command-catalog). Renderer application lands in step 2.

## server-export-0.1.0 — 2026-09-06

### Added

- `@miraiclip/server-export` (v3.x): server-side export from Node — `exportProjectFile(doc, options)` + a `miraiclip-export` CLI run the browser's own `exportProject` in headless Chrome (pixel-identical output by construction). Self-contained harness bundle, loopback media server with Range support, asset path mapping, progress + abort across the process boundary, system-Chrome resolution via playwright-core (real Chrome recommended — free Chromium is WebM-only). Integration-tested against real headless Chromium in CI; runnable example in `examples/server-export`. See the [Server export](../export/server-side) guide. Docs: the Export guide is now a section with Client side and Server side pages.

## renderer-0.2.0 — 2026-09-06

### Added

- `@miraiclip/renderer` offline export (v3): `exportProject` → MP4 (H.264+AAC) or WebM (VP9+Opus), full-resolution, faster than realtime (backpressure-paced, zero re-seeks, midpoint frame sampling, per-frame wait-for-arrival (fixes duplicated-frame judder), decode capped at 2× output size (fixes 4K-source export speed)), offline audio mix sharing live playback's clip math, quality presets, up-front codec probing, AbortSignal cancellation (including mid-audio-mix), progress events for both phases (audio reports seconds mixed — long timelines decode their full audio). Playground Export button with In/Out range marks; closed-loop e2e verifies the file with an independent decoder (frame colors, duration, audio RMS). See the [Export](../export/client-side) guide.
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
