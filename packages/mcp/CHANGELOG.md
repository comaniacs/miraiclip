# @miraiclip/mcp

## 0.3.0

### Minor Changes

- 1240743: Check a sequence as one continuous shot. The stage kit now reports, for every label, whether something survives into the next beat (carried, anchored or bare), subjects that leave the frame (`data-keep-in-frame="t0,t1[,whole]"`), uneven beat spacing and stray hard cuts. `@miraiclip/server-export` exports `checkShot(doc, options)`, the MCP server gains a `check_sequence` tool, and `editorTools({ checkSequence })` in `@miraiclip/assistant` offers the same tool to a host that can run the check. `MOTION_TARGETS.shot` is a stricter target for a continuous shot, and `motionFindings` takes `{ rests }` so declared rests are not flagged. The skills now allow stillness only inside a declared `tl.rest`. Warnings never block an export. `probeScriptedHtml` in `@miraiclip/renderer` runs the check in the editor's own sandboxed frame, and `@miraiclip/editor` adds `shotWarnings`, `staleShotChecks` and `shotCheckKey` for a badge, timeline markers and re-checking after edits. `check_sequence` can return before/after frames for bare boundaries (`frames: true`).
- 02fa701: Shutter motion blur on export. Pass `motionBlur` (`{}` for the defaults, or `{ shutterAngle, minSamples, maxSamples, gapPx }`) to `exportProject`, `exportProjectInWorker`/`exportViaWorker`, `exportProjectFile` and the MCP `export` tool. Each frame is rendered at several instants inside the open shutter and averaged in linear light on the GPU, in a floating-point texture. The sample count follows how far things travel on screen (keyframes, transitions, the camera, and the elements of a stage sequence), a frame where nothing moves renders once, and a hard cut (a clip edge without a transition, a `tl.cut`) is never blended. Sub-frame times are whole microseconds and mirror around the frame centre. Video footage uses the nearest decoded frame. The kit gains `window.__miraiclipMotion(from, to)`. Where the browser can't render to float textures the export finishes without blur and warns. The continuous-shot skill suggests blur for the final export only.
- ba096e4: Sound and music for a continuous shot. `planSoundFromEvents` (core) plans one sound effect clip at each hit a sequence declared, with one sound per hit kind, and volume keyframes that duck a music clip under the hits. `applyBeatGrid` (core) writes a music beat grid onto a sequence's stage root. The stage kit reads `data-downbeats` (`S.downbeats`, `S.downbeat(n)`) next to `data-beats`, and the shot report lists the sequence's `events`. The MCP server and the assistant gain `place_sfx_from_events` (the assistant's only when the host supplies `checkSequence`) and `set_beat_grid`. The Claude Code plugin's `mc.mjs beats <file>` analyses a music file into beats and downbeats.

### Patch Changes

- Updated dependencies [1240743]
- Updated dependencies [02fa701]
- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
  - @miraiclip/server-export@0.6.0
  - @miraiclip/core@0.8.0

## 0.2.1

### Patch Changes

- Updated dependencies [7477fe6]
  - @miraiclip/core@0.7.0
  - @miraiclip/server-export@0.5.1

## 0.2.0

### Minor Changes

- fd07ee1: Self-describing plugins (`doc.plugins`): custom kinds load and render in the browser, worker export, server export and MCP.

### Patch Changes

- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
  - @miraiclip/core@0.6.0
  - @miraiclip/server-export@0.5.0

## 0.1.3

### Patch Changes

- Updated dependencies [880ad42]
  - @miraiclip/core@0.5.0
  - @miraiclip/server-export@0.4.1

## 0.1.2

### Patch Changes

- Updated dependencies [399ef67]
  - @miraiclip/server-export@0.4.0

## 0.1.1

### Patch Changes

- Updated dependencies [a27c4ef]
- Updated dependencies [a27c4ef]
  - @miraiclip/core@0.4.0
  - @miraiclip/server-export@0.3.1

## 0.1.0

### Minor Changes

- fc2827e: New package: an MCP server that lets Claude, Codex, or any MCP client edit a Miraiclip project over stdio — validating `dispatch` with machine-readable failures, transactional `apply_commands`, undo/redo, `preview_frame` (the agent sees the actual pixels, rendered through the export pipeline), and `export` to file. `npx @miraiclip/mcp --project ./video.miraiclip.json`; every successful edit autosaves atomically.

### Patch Changes

- Updated dependencies [fc2827e]
  - @miraiclip/server-export@0.3.0
