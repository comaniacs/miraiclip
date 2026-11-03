# @miraiclip/renderer

## 0.17.1

### Patch Changes

- 938757a: Fix: a text clip with a Typewriter animation reported a wrong box. While it was typing, `getClipBounds` / `hitTest` covered only the typed part, and before the first character it stretched to about 100,000 px, so the editor's selection box ran off the screen. The box is now always the whole text, and the Typewriter mask sits beside the text in the stage (like the wipe's mask) instead of inside it, which also removes a Pixi deprecation warning. New real-browser test (`pnpm test:browser`) measures the box at several moments.

## 0.17.0

### Minor Changes

- 7e7673b: Blur and Typewriter animations. Keyframes can now animate two more properties: `blur` (a blur over the whole clip, as a fraction of the frame height, 0–0.25, resting at 0) and `reveal` (the share of a text clip's characters that show, 0–1, text clips only, resting at 1). Two animation presets use them: **Blur** (In and Out, on any visual clip: it sharpens as it comes in and softens as it leaves, fading with it) and **Typewriter** (In, text clips only: the characters appear one after another at a steady pace, and the text keeps its final layout while it types). Presets stay plain keyframes, so `readAnimation` recognizes them and the preview and the worker and server exports play them with no extra support; `AnimationPreset` gains `linearOnly` and `kinds`, with `presetAppliesTo(preset, clip)` and `BLUR_ANIMATION_PEAK` exported. The renderer's `Placement` gains optional `blurPx` and `reveal`. Documents that never use them are unchanged. The assistant's animate tool offers both and says plainly when Typewriter is asked of a clip that is not text.

### Patch Changes

- Updated dependencies [7e7673b]
  - @miraiclip/core@0.12.0

## 0.16.1

### Patch Changes

- 80c47bf: A `#rrggbbaa` or `#rgba` outline or shadow / glow color on text clips and captions now draws with its alpha (it was drawn opaque: Pixi takes the alpha separately). Opaque colors draw as before, so existing documents only change where a translucent color was already written, such as the `#000000cc` caption shadows in the registry presets, which now look as written.

## 0.16.0

### Minor Changes

- 8399f44: Outline and shadow / glow on text clips. `TextClip` takes the optional `strokeColor`, `strokeWidthFrac`, `shadowColor`, `shadowBlurFrac` and `shadowOffsetFrac` that caption styles already had (new shared `TextDecoration` type): set with `clip/add` or `clip/set-property`, where `null` removes a field; sizes are fractions of the font size and an offset of 0 is a glow. Documents that never use them are unchanged. The preview and the worker and server exports draw them through the same code as captions. `addTextClip` and the `setClipProperty` patch type in `@miraiclip/editor` accept the fields, and the assistant's command reference lists them.

### Patch Changes

- Updated dependencies [8399f44]
  - @miraiclip/core@0.11.0

## 0.15.0

### Minor Changes

- 9ac0cee: Crop for video and image clips. `VideoClip` and `ImageClip` take an optional `crop` (`{ x, y, width, height }`, fractions of the source from its top-left, staying inside the picture), set with `clip/add` or `clip/set-property` (`null` clears it; `crop` on any other clip kind is rejected with `not-media`). A whole-picture crop is not stored, so documents that never crop are unchanged. The preview and the worker/server exports draw only the cropped part, and for video it is the cropped part that is fitted to the frame. Everything else (transform, effects, animation) applies to the cropped clip.

### Patch Changes

- Updated dependencies [9ac0cee]
  - @miraiclip/core@0.10.0

## 0.14.0

### Minor Changes

- e856c77: Refresh media links in a long session. `player.refreshMedia()` reopens every media source on next use (video pipelines are released and re-acquired, audio sources are closed and reopened, playback carries on from the current position) without rebuilding the player, touching the document or adding an undo entry. A host whose media links expire (signed URLs) gives the player an `openDemuxer` / `openAudio` that answers with the current link for an asset, then calls `refreshMedia()` when the links change. `createPreviewController({ media: { openDemuxer, openAudio } })` replaces the built-in readers (the controller used to ignore them), and `onPlayerReady` hands over the player. Images already on screen keep their loaded textures.

## 0.13.0

### Minor Changes

- 5fa8674: Stretch and flip. A clip's `transform` takes optional `scaleX` and `scaleY` (default 1, multiplied with `scale`; negative mirrors the content, 0 is rejected; not animatable). They are set with `clip/add` / `clip/set-property` like the other transform fields, and documents that never use them are unchanged: a value of 1 is not stored. The preview, worker export and server export draw them the same way, `getClipBounds` / `hitTest` follow them (`ClipBounds` and `Placement` gain optional `scaleX` / `scaleY`), and `EvaluatedClip` carries them. `@miraiclip/editor` adds the `stretch-x` and `stretch-y` modes to `beginTransformDrag` for side handles: the pointer's distance along the clip's own axis scales only that axis (pivoting at the origin like `scale`), never flips through the origin, keeps a mirrored clip mirrored, and is one undo step.

### Patch Changes

- Updated dependencies [5fa8674]
  - @miraiclip/core@0.9.0

## 0.12.0

### Minor Changes

- dedf3d8: Faster, checkable 3D films.
  
  - **ThreeKit**: a new scripted library, `three-kit` (`data-libs="stage three three-kit"`), defines a global `ThreeKit`. It includes constant-pixel-width lines that can be drawn to a moving head, glow sprites, GLSL simplex noise, `ThreeKit.shots` (one camera blended from several shots, on position and look-at point), `ThreeKit.place`, overlay helpers, and `ThreeKit.motionOf` / `ThreeKit.subjectOf` for the checks below. `THREE_KIT_SOURCE` is exported from `@miraiclip/renderer/stage`.
  - **`tl.subject(name, fn, { from, to, minPx })`**: declares a painted subject the shot check keeps in frame. It reports when the subject leaves the frame or shrinks below `minPx`.
  - **`tl.frame(fn, { hold: true })`**: the painter is called with the time at the start of the output frame (`data-fps`, default 30), so motion-blur samples of one frame agree, and type and counters no longer ghost.
  - **`tl.rest`**: also fails when a `tl.frame` motion function reports movement inside the rest (`allow: ["frame"]` exempts it). The shot check warns (`rest-unverified`) when a painter has no motion function.
  - **`miraiclip-export stills <project> --at 1,9.5,15 [--sheet]`**: frames from one warm browser.
  - **`miraiclip-export check <project>`**: the continuous-shot check without the MCP server.
  - **`miraiclip-export doctor`**: browser, ffmpeg and, inside the monorepo, stale generated bundles.
  - **Export flags**: `--workers N` renders parallel chunks; `--motion-blur` turns on the default shutter.
  - **`renderDistributed` takes `motionBlur`**: it applies to every video chunk.
- 9207399: 3D in scripted sequences. `three` is now a registered scripted library: `data-libs="stage three"` gives a sequence a global `THREE` (three.js 0.170 with `RoundedBoxGeometry`, `RoomEnvironment` and `mergeGeometries`), bundled so it renders with no network. Draw the scene inside `tl.frame((t) => …)`; `tl.frame(fn, { motion })` reports how far the picture moves between two times so motion blur can size its samples. A template can ask for slower frames with `data-frame-timeout="<seconds>"` on its root (raises the 10 s per-frame limit, up to 10 minutes; `frameTimeoutMs` is exported). `lintSequence` adds `three-clock` (no `setAnimationLoop`, `THREE.Clock` or `getDelta`). The renderer exports `THREE_SOURCE` and `THREE_VERSION` from `@miraiclip/renderer/stage`.

## 0.11.0

### Minor Changes

- e82dd58: Three stage-kit additions for continuous shots. `tl.hop` can now be chained: hopping the same element again starts from where it landed (a hop that would begin before the previous one ends throws, naming the time). `tl.shadow(target, opts)` and `hop({ shadow })` add a contact shadow that follows hops along the ground, thins and widens as the element lifts, and fades with the element's opacity. `tl.focus(target | depth | null, opts)` adds depth of field: elements marked `data-dof` blur by their distance from the focus depth, and a second call racks the focus. `tl.frame(fn)` calls `fn(t)` on every seek so a canvas can be painted as a pure function of time. `lintSequence` knows the new verbs, and the sequence-core skill documents them.

## 0.10.0

### Minor Changes

- 1240743: Check a sequence as one continuous shot. The stage kit now reports, for every label, whether something survives into the next beat (carried, anchored or bare), subjects that leave the frame (`data-keep-in-frame="t0,t1[,whole]"`), uneven beat spacing and stray hard cuts. `@miraiclip/server-export` exports `checkShot(doc, options)`, the MCP server gains a `check_sequence` tool, and `editorTools({ checkSequence })` in `@miraiclip/assistant` offers the same tool to a host that can run the check. `MOTION_TARGETS.shot` is a stricter target for a continuous shot, and `motionFindings` takes `{ rests }` so declared rests are not flagged. The skills now allow stillness only inside a declared `tl.rest`. Warnings never block an export. `probeScriptedHtml` in `@miraiclip/renderer` runs the check in the editor's own sandboxed frame, and `@miraiclip/editor` adds `shotWarnings`, `staleShotChecks` and `shotCheckKey` for a badge, timeline markers and re-checking after edits. `check_sequence` can return before/after frames for bare boundaries (`frames: true`).
- 888c1eb: Continuous shot for the stage kit. Add `data-stage-version="2"` to a sequence's stage root and it can be built as one unbroken camera move: carry verbs that turn one element into the next (`tl.morph`, `tl.iris`, `tl.zoomThrough`, `tl.hop`, `tl.gather`, `tl.impact`, `tl.press`, `tl.pointer`, and a `spring` ease), an operated camera on its own track (log-space zoom, a screen-space `anchor` for deep zooms, `tl.follow`, `tl.whip`, `tl.handheld`, `tl.shake`, `data-depth` parallax, `data-lod`, and `S.grid`), declared rests (`tl.rest`), hard cuts (`tl.cut`) and sound hits (`tl.hit`), reported on the stage root as `data-stage-carries`, `-events`, `-rests` and `-cuts`. `S.rect`, `S.center` and `S.pointerPath` measure elements and import a recorded click log. `lintSequence` gains `version`, `carry-target`, `zoom-target`, `zoom-anchor` and `verb-transform`. Sequences without the attribute render exactly as before. The package also exports `ANIME_SOURCE` and `STAGE_KIT_HASH` from `@miraiclip/renderer/stage`.
- 02fa701: Shutter motion blur on export. Pass `motionBlur` (`{}` for the defaults, or `{ shutterAngle, minSamples, maxSamples, gapPx }`) to `exportProject`, `exportProjectInWorker`/`exportViaWorker`, `exportProjectFile` and the MCP `export` tool. Each frame is rendered at several instants inside the open shutter and averaged in linear light on the GPU, in a floating-point texture. The sample count follows how far things travel on screen (keyframes, transitions, the camera, and the elements of a stage sequence), a frame where nothing moves renders once, and a hard cut (a clip edge without a transition, a `tl.cut`) is never blended. Sub-frame times are whole microseconds and mirror around the frame centre. Video footage uses the nearest decoded frame. The kit gains `window.__miraiclipMotion(from, to)`. Where the browser can't render to float textures the export finishes without blur and warns. The continuous-shot skill suggests blur for the final export only.
- ba096e4: Sound and music for a continuous shot. `planSoundFromEvents` (core) plans one sound effect clip at each hit a sequence declared, with one sound per hit kind, and volume keyframes that duck a music clip under the hits. `applyBeatGrid` (core) writes a music beat grid onto a sequence's stage root. The stage kit reads `data-downbeats` (`S.downbeats`, `S.downbeat(n)`) next to `data-beats`, and the shot report lists the sequence's `events`. The MCP server and the assistant gain `place_sfx_from_events` (the assistant's only when the host supplies `checkSequence`) and `set_beat_grid`. The Claude Code plugin's `mc.mjs beats <file>` analyses a music file into beats and downbeats.
- cdd6cf6: A new built-in transition, `zoomThrough`: the camera dives into a region of the outgoing clip (`rect`, as fractions of the frame; `ease`) and arrives in the incoming clip, so a cut reads as one continuous move. It holds the outgoing clip's last frame and the incoming clip's first frame through the window, so it needs no spare footage; `transition/add` and `transition/update` reject it only when it is longer than the shorter clip (`transition-too-long`). `findCuts` reports `maxHoldTransitionUs`, and core exports `transitionHoldsFrames(kind)`. Renderer transitions gain `affine` (scale and translate) in `TransitionFrameEffects` and a `holdsFrames` flag. `add_transition` in `@miraiclip/assistant` accepts `zoomThrough` with `rect` and `ease`, and `checkShot` treats a `zoomThrough` between two sequence clips as the hand-over, so no `act-join` warning.
- 63276db: Sequences: motion graphics as one timeline.
  
  - `registerScriptedLibraries` makes libraries available to scripted html clips through `data-libs`. They're inlined in dependency order, with no network.
  - `registerStageKit()` adds the stage kit (on anime.js v4, MIT). It provides:
    - `stage.build((tl, S) => …)` with `tl.to/from/fromTo/set/label/camera`;
    - stage-relative sizes (`S.w/h/min`), `S.split`, `S.rand(seed)` and music beats (`S.beat(n)`);
    - frame-exact seeking, and building after fonts load.
  - `lintSequence(template)` checks a sequence before it renders: randomness, the clock, timers, network, infinite loops, viewport units, `position: fixed`, its shape, raw pixels and large blurred layers.
  - Motion metrics measure how much rendered frames move: `lumaFrame`, `frameChange`, `changeSeries`, `motionMetrics` (density, median change, holds, jumps), `motionFindings` and `MOTION_TARGETS`.
  - `rasterizeHtml({ software: true })` rasterizes on the CPU. It's exact for analysis and small previews, where some GPU rasterizers add tile artifacts to large blurred layers under 3D transforms.
  - Scripted frames inject the template's `@font-face` before building, and wait for `__miraiclipReady`.

### Patch Changes

- 63276db: An html clip whose font asset can't be fetched now renders with the CSS's fallback font (and warns once) instead of failing to render at all.
- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
  - @miraiclip/core@0.8.0

## 0.9.1

### Patch Changes

- Updated dependencies [7477fe6]
  - @miraiclip/core@0.7.0

## 0.9.0

### Minor Changes

- fd07ee1: Clip speed and freeze frames, timeline markers, effect regions, gestures, custom-kind props editing and idempotent kind registration.
- fd07ee1: Self-describing plugins (`doc.plugins`): custom kinds load and render in the browser, worker export, server export and MCP.
- fd07ee1: Scripted html clips (`scripted: true`): GSAP, Lottie, anime.js and Web Animations templates seeked frame-exactly in every renderer.

### Patch Changes

- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
  - @miraiclip/core@0.6.0

## 0.8.1

### Patch Changes

- dccd95f: Player transport events and a framework-free preview controller.
  
  - `player.on(type, listener)` with `play`, `pause` (`reason: "pause" | "ended"`), `ended`, `seek`, `ratechange` and `error`. UIs no longer need to poll `player.playing`. New `player.rate`.
  - `createPreviewController(project, options)`: the preview half of an editor without a UI framework. It owns the canvas's renderer and player, a fallback clock when WebCodecs or WebGL is unavailable, StrictMode-safe attach/detach, devicePixelRatio output sizing with a per-preview decode cap, monitoring volume and mute, and GPU context loss → `reportMemoryPressure()`. State via `getState()` / `subscribe()`.
  - Fix: a seek while paused no longer leaves an unhandled promise rejection when a clip's media fails to open (the failure still reaches `onError`).

## 0.8.0

### Minor Changes

- 3c9863e: Preview memory now follows what is near the playhead, not timeline length (mobile tab crashes on the launch film).
  
  - Compositor residency (default on): scene nodes mount only for clips within 2s ahead / 1s behind the render time; `residency: false` restores mount-everything.
  - Decoder lanes: overlapping clips of one asset share a few interval-coloured lanes instead of one dedicated pipeline per transition clip (`assignVideoLanes`).
  - MediaManager: holders + idle release (`idleReleaseMs`), one shared `frameBudgetBytes` (default 256 MiB) split across pipelines, `reportMemoryPressure()`, `stats()`.
  - Frame cache keeps at most `maxBehindFrames` (8) played frames; live VideoFrames are capped by `maxPoolFrames` (6).
  - `frameStorage: "auto"` (default): CPU-decoded frames (I4xx) are kept as VideoFrames and uploaded straight to WebGL; GPU/hardware frames are still copied to preview-sized ImageBitmaps and released (decoder pools stay free). `"videoframe"`/`"bitmap"` force one path; `maxOutputDimensionPx` may be a function.
  - Html clips reuse one canvas, texture and image element per clip; `htmlRaster: { minDensity, maxAnimatedFps }` for live preview.
  - Html preview pacing (opt-in, preview only — exports still raster every frame): `htmlRaster.reuseStaticFrames` analyses a template's CSS animations once (`analyzeHtmlAnimations`) and keeps the current raster while nothing animates (holds, `steps()` counters); `htmlRaster.budget` (0..1) caps the main-thread share animated html rasters may use, split across animating clips. Animated rasters no longer chain back to back past `maxAnimatedFps`.
  - Image textures are reference-counted and unloaded when no mounted clip uses them.
  - Audio lanes open near the playhead and close behind it; mediabunny read caches capped (16 MiB video, 8 MiB audio).
  - Player: `memory` options, `stats()`, `reportMemoryPressure()`.

## 0.7.13

### Patch Changes

- c08e370: Video recovers when the platform closes a decoder (iOS Safari reclaiming a hardware decoder, or a decode error): the pipeline replaces the dead `VideoDecoder` and re-seeks from the nearest keyframe instead of feeding it forever ("VideoDecoder is not configured" on every frame). Reclaims recover quietly; other decode errors reach `onError` once per failure, with retries backing off from 250 ms to 5 s. New export: `isRecoverableDecoderError`.

## 0.7.12

### Patch Changes

- 199bf10: Export frames follow the core frame rule. `exportComposition` / `exportProject` take `fps` as a number or an exact `{ num, den }` (default: the project's exact rate via `projectFrameRate`), and compute every frame's start, duration and count with core's `frameToUs` / `frameCount` — the same mapping in the main-thread, worker and headless (server-export) paths. Frame starts move by at most 1 µs (frame 1 at 30 fps is 33,334 µs). `StepClock.step` now derives the next frame start from the frame index instead of adding a rounded frame length (which drifted ~1 frame per hour at 30 fps). New: `exportFrameWindow(n, startUs, endUs, fps)`. Requires @miraiclip/core 0.5.8.

## 0.7.11

### Patch Changes

- 1ff5fe5: Html clips no longer render blank at some output sizes: the texture was built with a fractional resolution, Pixi's float round-trip (1388 / 1.4167 × 1.4167 = 1387.99…) made it resize the raster canvas, and resizing a canvas clears it — e.g. a 2720px-wide preview or export. Html clips also recover from a failed raster (a font fetch during a dev-server restart, say): the node retries on a backoff instead of keeping a stale or empty frame.

## 0.7.10

### Patch Changes

- af16150: Animated html clips: CSS animations are paused and seeked to the clip's time (`--t`/`--T` on the root, `--d` for per-element delays) and re-rasterized per frame — coalesced in preview, awaited per frame in exports and stills (`compositor.renderExactAt`), and requested on demand from the main thread in worker exports. New exports: `htmlAnimationTiming`, `htmlRasterKey`, `setHtmlRasterSource`.
- Updated dependencies [af16150]
  - @miraiclip/core@0.5.6

## 0.7.9

### Patch Changes

- 2ca45f2: Volume keyframes anchored to the clip's end (`anchor: "end"`) play and export at the right time; gain automation uses core's `resolveKeyframes`.
- 2ca45f2: Hidden tracks aren't drawn: the compositor skips their clips in preview, exports and stills, and `getClipBounds` / `hitTest` ignore them. Sound still follows `muted`.
- Updated dependencies [2ca45f2]
- Updated dependencies [2ca45f2]
  - @miraiclip/core@0.5.4

## 0.7.8

### Patch Changes

- f72deb3: Clip fades (`fadeInUs` / `fadeOutUs`) are applied in live playback and in the export mix through the shared gain math, as exact linear ramps. New `computeWaveformPeaks` (streamed max-abs peaks per asset), `peaksForRange` and `accumulatePeaks` for drawing waveforms, plus `clipFades` / `fadeGainAt` for fade handles.
- Updated dependencies [f72deb3]
  - @miraiclip/core@0.5.3

## 0.7.7

### Patch Changes

- 16901eb: Render the new caption decorations: outline, drop shadow / glow, case transform, word-by-word display, active-word boxes and the `reveal` preset. Font assets with `weightRange` load as variable faces (`font-weight: 100 900`), so every weight comes from the font's axis — in captions, text clips and html clips alike.
- Updated dependencies [16901eb]
  - @miraiclip/core@0.5.2

## 0.7.6

### Patch Changes

- 0b6bf4d: Add `getClipBounds` and `hitTest` to the Compositor and the Player: where a clip is drawn (rotated content box in composition pixels, keyframes evaluated) and which clip is topmost under a point. This is the geometry an editor's on-canvas interaction layer needs — selection boxes, move/scale/rotate handles, click-to-select. Html clips report their painted content, not the transparent raster box. New optional `SceneNode.getLocalBounds` for custom backends.

## 0.7.5

### Patch Changes

- 49a2d22: Fix exports stalling (and drawing stale frames) at cuts between two clips of the same video. In the last second before the cut, the lookahead warmed the upcoming clip on the pipeline the on-screen clip was reading, so the two fought over one decoder's seek position: about 2s per frame with the CPU pegged. Upcoming clips no longer warm up on a shared pipeline that is in use; the cut now costs a single re-seek.

## 0.7.4

### Patch Changes

- 6e75056: Renders the whole effect library as built-ins: data-driven GLSL shaders (uniforms generated from core's catalog params; GLSL ES 1.00-compatible), Pixi color-matrix looks, and seeded film grain. Built-in means registered in every bundle, so all 79 kinds render in preview, browser and worker export, server export and stills. New `renderEffectThumbnails(options)` renders each kind's real filter over a sample image on its own offscreen renderer, for effect pickers.
- Updated dependencies [6e75056]
  - @miraiclip/core@0.5.1

## 0.7.3

### Patch Changes

- 116f3b2: Renders core 0.5.0's typography fields. Text clips map `fontWeight`, `fontStyle`, `lineHeight` (× font size), `letterSpacing` (em × font size), and `textAlign` onto their Pixi text style; caption words get weight, style, and spacing, and caption layout stacks lines at `lineHeight` (default 1.3) with word gaps widened by the letter spacing — so bold, italic, and spaced captions wrap and highlight correctly. `loadFontAssets` passes font assets' `weight`/`style` to `FontFace` as descriptors and loads each face of a family separately (`FontEnv.createFace` gains an optional `descriptors` argument); html-clip font inlining carries the same descriptors. Clips without typography render exactly as before. Applies to preview, browser and worker export, stills, and server export.

## 0.7.2

### Patch Changes

- Updated dependencies [880ad42]
  - @miraiclip/core@0.5.0

## 0.8.0

### Minor Changes

- 399ef67: Sharp text and html clips at every output size. Rasterized content (html-clip rasters, text and caption glyphs) now generates at the RENDER density — output size ÷ composition size in exports and stills, or the preview's devicePixelRatio — instead of composition density, so upscaled exports and hi-DPI previews stop looking soft. Layout is unchanged (a scale-transform supersamples html templates; Pixi texture/text `resolution` keeps logical sizes), outputs at composition size are pixel-identical, and worker exports pre-rasterize at the same density. `rasterizeHtml` gains a `density` option (the raster key includes it), `collectHtmlRasters` takes the output size, `EffectContext` exposes `renderScale`, and `createPlayer` gains `outputSize` — pass the canvas's CSS size × devicePixelRatio for a sharp preview (the playground and docs examples now do).

## 0.7.0

### Minor Changes

- a27c4ef: html clip rendering: `rasterizeHtml`/`substituteParams` (SVG foreignObject via data: URL — blob: URLs taint the canvas in Chromium — with a 2D-canvas launder for WebGL-safe textures; rasters cached per template/params/size; font assets inline as @font-face data URIs, `asset:<id>` inlines image assets), a Pixi html node, and a new readiness gate: `SceneNode.whenReady`/`Compositor.whenReady` — `exportProject` and `renderProjectStill` now await async node content (image textures, html rasters) before the frame walk, fixing a latent race where exports started immediately after building a document could bake empty image sprites into early frames. Worker export renders html clips: `exportProjectInWorker`/`exportViaWorker` pre-rasterize them on the main thread (deduplicated per template/params/size) and transfer the bitmaps to the worker, which serves them by raster key — no API change. Custom worker pipelines get the same via the exported `collectHtmlRasters(doc)`/`provideHtmlRasters(rasters)`.

### Patch Changes

- Updated dependencies [a27c4ef]
  - @miraiclip/core@0.4.0

## 0.6.0

### Minor Changes

- 201239c: Public effect and transition registration: `registerEffectRenderer(kind, factory)` (custom effect kind → Pixi filter factory, params updated in place) and `registerTransitionRenderer(kind, renderer)` (custom transition kind → pure per-frame math over progress, composing opacity, directional reveal, pixel offset, and a full-composition overlay). Built-ins are expressed through the same contracts; custom kinds render identically in preview, browser export, and stills. Server and worker export remain built-in-kinds-only (renderers are functions and cannot cross a process/thread boundary).

## 0.5.0

### Minor Changes

- fc2827e: Still-frame rendering: `renderProjectStill(project, { timeUs, width?, height? })` in the renderer renders one composition frame to an image through the exact export pipeline, and `createRenderSession()` in server-export keeps one warm headless Chrome across calls so a frame costs a frame, not a browser launch. Also fixes `exportProject`'s `width`/`height` output-size option, which was silently ignored (the compositor resized the canvas back to the composition size): the compositor gained `outputSize` (backends: optional `setOutputSize`), so exports and stills now honor a requested output size while composition coordinates stay unchanged.

## 0.4.2

### Patch Changes

- Updated dependencies [34a0d60]
  - @miraiclip/core@0.3.0

## 0.4.1

### Patch Changes

- 3efb2bf: Fix for export functionality of clip

## 0.4.0

### Minor Changes

- e9f8d0a: Streaming export output and chunked offline audio — export memory is now independent of timeline length. `exportProject` (and `createMediabunnySink`) accept `target`: a `WritableStream` receiving `{ type: "write", data, position }` chunks as the file is encoded (a `showSaveFilePicker()` writable works directly); with a target set the promise resolves with an empty array. Export audio mixes in bounded sequential chunks (`audioChunkSeconds`, default 60) interleaved with the frame walk instead of one whole-timeline `OfflineAudioContext` render; `exportComposition` gained `mixAudioChunk` (the existing whole-range `mixAudio` is unchanged), and whether a composition has audio is decided up front by probing the contributing assets. Demonstrated: a one-hour export (86,400 frames, an hour of audio, 984 MB streamed) peaked at 165 MB of JS heap at 1.6× realtime.
  
  Fixes: concurrent clips of the same asset (picture-in-picture of one source) each get a dedicated decode pipeline instead of fighting over the shared per-asset pipeline's seek target (which wedged playback); the pipeline LRU tracks per-frame use and never evicts an actively used pipeline (new `evictionIdleMs` option, default 500ms); lazy pipeline acquisition + self-healing re-acquire after eviction (long multi-asset timelines no longer go black); software-GL exports route frame capture through a CPU mirror automatically (`cpuCapture`, `isSoftwareWebGL`), avoiding unbounded GPU shared-image growth in headless environments.

## 0.3.0

### Minor Changes

- 260cf57: v4 creative features rendered, with preview/export parity by shared math: keyframe animation applied per render (volume rides linear gain ramps in the live engine and the offline export mixer alike); GPU effects (colorAdjust, blur, chroma key with spill suppression) with in-place param updates; transitions (crossDissolve, dipToBlack, dipToWhite, wipe, slide) with equal-power audio crossfades, dedicated decode pipelines for same-asset overlaps, and source-headroom rendering through the window; karaoke captions (plain/highlight/karaoke/pop presets, word wrap, background box) with font assets loaded as real FontFaces in both the player and `exportProject` — server exports never rasterize fallback glyphs. Also: transport hold on play/seek (no black/stale frames while decode catches up), new optional backend seams (`setReveal`, `createSolid`, `createCaption`), and exported `loadFontAssets`.

### Patch Changes

- Updated dependencies [260cf57]
  - @miraiclip/core@0.2.0

## 0.2.0

### Minor Changes

- 0c24857: Offline export (v3): `exportProject` renders a composition to MP4 (H.264 + AAC) or WebM (VP9 + Opus) — faster than realtime, pipelined encoding (bounded in-flight window), midpoint frame sampling, per-frame wait-for-arrival, decode capped at 2× output size, offline audio mix sharing live playback's clip math, quality presets, up-front codec probing, AbortSignal cancellation, and progress events for both phases. Verified end-to-end by a closed-loop e2e (independent decoder checks frame colors, duration, and audio RMS).
