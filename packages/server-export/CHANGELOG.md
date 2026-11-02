# @miraiclip/server-export

## 0.7.2

### Patch Changes

- 9ac0cee: Crop for video and image clips. `VideoClip` and `ImageClip` take an optional `crop` (`{ x, y, width, height }`, fractions of the source from its top-left, staying inside the picture), set with `clip/add` or `clip/set-property` (`null` clears it; `crop` on any other clip kind is rejected with `not-media`). A whole-picture crop is not stored, so documents that never crop are unchanged. The preview and the worker/server exports draw only the cropped part, and for video it is the cropped part that is fitted to the frame. Everything else (transform, effects, animation) applies to the cropped clip.
- Updated dependencies [9ac0cee]
  - @miraiclip/core@0.10.0

## 0.7.1

### Patch Changes

- 5fa8674: Stretch and flip. A clip's `transform` takes optional `scaleX` and `scaleY` (default 1, multiplied with `scale`; negative mirrors the content, 0 is rejected; not animatable). They are set with `clip/add` / `clip/set-property` like the other transform fields, and documents that never use them are unchanged: a value of 1 is not stored. The preview, worker export and server export draw them the same way, `getClipBounds` / `hitTest` follow them (`ClipBounds` and `Placement` gain optional `scaleX` / `scaleY`), and `EvaluatedClip` carries them. `@miraiclip/editor` adds the `stretch-x` and `stretch-y` modes to `beginTransformDrag` for side handles: the pointer's distance along the clip's own axis scales only that axis (pivoting at the origin like `scale`), never flips through the origin, keeps a mirrored clip mirrored, and is one undo step.
- Updated dependencies [5fa8674]
  - @miraiclip/core@0.9.0

## 0.7.0

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

## 0.6.0

### Minor Changes

- 1240743: Check a sequence as one continuous shot. The stage kit now reports, for every label, whether something survives into the next beat (carried, anchored or bare), subjects that leave the frame (`data-keep-in-frame="t0,t1[,whole]"`), uneven beat spacing and stray hard cuts. `@miraiclip/server-export` exports `checkShot(doc, options)`, the MCP server gains a `check_sequence` tool, and `editorTools({ checkSequence })` in `@miraiclip/assistant` offers the same tool to a host that can run the check. `MOTION_TARGETS.shot` is a stricter target for a continuous shot, and `motionFindings` takes `{ rests }` so declared rests are not flagged. The skills now allow stillness only inside a declared `tl.rest`. Warnings never block an export. `probeScriptedHtml` in `@miraiclip/renderer` runs the check in the editor's own sandboxed frame, and `@miraiclip/editor` adds `shotWarnings`, `staleShotChecks` and `shotCheckKey` for a badge, timeline markers and re-checking after edits. `check_sequence` can return before/after frames for bare boundaries (`frames: true`).
- 02fa701: Shutter motion blur on export. Pass `motionBlur` (`{}` for the defaults, or `{ shutterAngle, minSamples, maxSamples, gapPx }`) to `exportProject`, `exportProjectInWorker`/`exportViaWorker`, `exportProjectFile` and the MCP `export` tool. Each frame is rendered at several instants inside the open shutter and averaged in linear light on the GPU, in a floating-point texture. The sample count follows how far things travel on screen (keyframes, transitions, the camera, and the elements of a stage sequence), a frame where nothing moves renders once, and a hard cut (a clip edge without a transition, a `tl.cut`) is never blended. Sub-frame times are whole microseconds and mirror around the frame centre. Video footage uses the nearest decoded frame. The kit gains `window.__miraiclipMotion(from, to)`. Where the browser can't render to float textures the export finishes without blur and warns. The continuous-shot skill suggests blur for the final export only.
- ba096e4: Sound and music for a continuous shot. `planSoundFromEvents` (core) plans one sound effect clip at each hit a sequence declared, with one sound per hit kind, and volume keyframes that duck a music clip under the hits. `applyBeatGrid` (core) writes a music beat grid onto a sequence's stage root. The stage kit reads `data-downbeats` (`S.downbeats`, `S.downbeat(n)`) next to `data-beats`, and the shot report lists the sequence's `events`. The MCP server and the assistant gain `place_sfx_from_events` (the assistant's only when the host supplies `checkSequence`) and `set_beat_grid`. The Claude Code plugin's `mc.mjs beats <file>` analyses a music file into beats and downbeats.
- cdd6cf6: A new built-in transition, `zoomThrough`: the camera dives into a region of the outgoing clip (`rect`, as fractions of the frame; `ease`) and arrives in the incoming clip, so a cut reads as one continuous move. It holds the outgoing clip's last frame and the incoming clip's first frame through the window, so it needs no spare footage; `transition/add` and `transition/update` reject it only when it is longer than the shorter clip (`transition-too-long`). `findCuts` reports `maxHoldTransitionUs`, and core exports `transitionHoldsFrames(kind)`. Renderer transitions gain `affine` (scale and translate) in `TransitionFrameEffects` and a `holdsFrames` flag. `add_transition` in `@miraiclip/assistant` accepts `zoomThrough` with `rect` and `ease`, and `checkShot` treats a `zoomThrough` between two sequence clips as the hand-over, so no `act-join` warning.

### Patch Changes

- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
  - @miraiclip/core@0.8.0

## 0.5.1

### Patch Changes

- Updated dependencies [7477fe6]
  - @miraiclip/core@0.7.0

## 0.5.0

### Minor Changes

- fd07ee1: Distributed rendering (`renderDistributed`, `localRunner`, `httpRunner`, `createRenderJobHandler`) and the `bench:cost` render-cost benchmark.
- fd07ee1: Self-describing plugins (`doc.plugins`): custom kinds load and render in the browser, worker export, server export and MCP.

### Patch Changes

- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
  - @miraiclip/core@0.6.0

## 0.4.3

### Patch Changes

- 6e75056: The export/still harness bundles the renderer's effect library, so all 79 built-in effect kinds render server-side.
- Updated dependencies [6e75056]
  - @miraiclip/core@0.5.1

## 0.4.2

### Patch Changes

- 116f3b2: Harness rebuilt with the typography-aware renderer: server exports, render sessions, and export sessions (and so `@miraiclip/templates` batches and MCP previews) render text and caption `fontWeight`, `fontStyle`, `lineHeight`, `letterSpacing`, and `textAlign`, and load font assets per weight/style face.

## 0.4.1

### Patch Changes

- Updated dependencies [880ad42]
  - @miraiclip/core@0.5.0

## 0.4.0

### Minor Changes

- 399ef67: `createExportSession()` — a persistent exporter: one headless Chrome + harness page kept warm across calls, one full export per `exportFile(doc, options)` call (same options and result as `exportProjectFile`, including streamed `out`), so an export costs an export instead of a browser launch. Calls queue on the one page; a failed export never wedges the session. Built for batch rendering (`@miraiclip/templates`) and export-on-demand services.

## 0.3.1

### Patch Changes

- a27c4ef: Harness rebuilt with html clip support: server exports and render sessions rasterize `html` clips (the harness page is a real Chrome document).
- Updated dependencies [a27c4ef]
  - @miraiclip/core@0.4.0

## 0.3.0

### Minor Changes

- fc2827e: Still-frame rendering: `renderProjectStill(project, { timeUs, width?, height? })` in the renderer renders one composition frame to an image through the exact export pipeline, and `createRenderSession()` in server-export keeps one warm headless Chrome across calls so a frame costs a frame, not a browser launch. Also fixes `exportProject`'s `width`/`height` output-size option, which was silently ignored (the compositor resized the canvas back to the composition size): the compositor gained `outputSize` (backends: optional `setOutputSize`), so exports and stills now honor a requested output size while composition coordinates stay unchanged.

## 0.2.1

### Patch Changes

- Updated dependencies [34a0d60]
  - @miraiclip/core@0.3.0

## 0.2.0

### Minor Changes

- e9f8d0a: Streamed output to disk: with `out` set, encoded chunks stream from the browser page to the output file as they are produced, so server memory stays flat for long exports (a failed export removes the partial file). Breaking for `out` callers: the result is now `{ filePath, bytesWritten }` — `bytes` is no longer returned there (read the file back if needed; without `out`, `{ bytes }` is unchanged). Progress events carry a live `bytesWritten`, and `audioChunkSeconds` passes through. The bundled harness inherits renderer 0.4.0 (streaming, chunked audio, pipeline fixes).

## 0.1.1

### Patch Changes

- Updated dependencies [260cf57]
  - @miraiclip/core@0.2.0

## 0.1.0

### Minor Changes

- 8ba7909: First release: server-side export from Node. `exportProjectFile(doc, options)` and the `miraiclip-export` CLI run the browser's own `exportProject` in headless Chrome — pixel-identical to preview by construction. Self-contained harness bundle (core + renderer baked in), loopback media server with Range support, asset path mapping, progress + AbortSignal across the process boundary, system-Chrome resolution via playwright-core (real Chrome recommended; free Chromium is WebM-only).
