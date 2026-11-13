# @miraiclip/editor

## 0.6.4

### Patch Changes

- 4da16f5: Track volume: `Track.volume` (a gain, 0..4, absent = 1) set with `track/set-property {volume}`. Preview and export multiply it into every clip on the track through the shared gain math, so clip volumes, volume keyframes and fades stay their own. `1` clears it (documents stay minimal). `setTrackProperty` in `@miraiclip/editor` takes `volume`.
- Updated dependencies [916ac08]
- Updated dependencies [5529ae0]
- Updated dependencies [ee9480d]
- Updated dependencies [4da16f5]
  - @miraiclip/core@0.13.0

## 0.6.3

### Patch Changes

- Updated dependencies [7e7673b]
  - @miraiclip/core@0.12.0

## 0.6.2

### Patch Changes

- 8399f44: Outline and shadow / glow on text clips. `TextClip` takes the optional `strokeColor`, `strokeWidthFrac`, `shadowColor`, `shadowBlurFrac` and `shadowOffsetFrac` that caption styles already had (new shared `TextDecoration` type): set with `clip/add` or `clip/set-property`, where `null` removes a field; sizes are fractions of the font size and an offset of 0 is a glow. Documents that never use them are unchanged. The preview and the worker and server exports draw them through the same code as captions. `addTextClip` and the `setClipProperty` patch type in `@miraiclip/editor` accept the fields, and the assistant's command reference lists them.
- Updated dependencies [8399f44]
  - @miraiclip/core@0.11.0

## 0.6.1

### Patch Changes

- Updated dependencies [9ac0cee]
  - @miraiclip/core@0.10.0

## 0.6.0

### Minor Changes

- 84c5402: Side handles for the transform box. `<TransformBox.SideHandle side="top|right|bottom|left" />` sits in the middle of a side and stretches only that axis of the clip (left and right its width, top and bottom its height, pivoting at the origin like the corner handles; one undo step; a mirrored clip stays mirrored). `@miraiclip/editor` exports the pieces for custom handles: `sideHandlePosition`, `sideDragMode`, `sideCursor` and the `TransformSide` type.

## 0.5.0

### Minor Changes

- 5fa8674: Stretch and flip. A clip's `transform` takes optional `scaleX` and `scaleY` (default 1, multiplied with `scale`; negative mirrors the content, 0 is rejected; not animatable). They are set with `clip/add` / `clip/set-property` like the other transform fields, and documents that never use them are unchanged: a value of 1 is not stored. The preview, worker export and server export draw them the same way, `getClipBounds` / `hitTest` follow them (`ClipBounds` and `Placement` gain optional `scaleX` / `scaleY`), and `EvaluatedClip` carries them. `@miraiclip/editor` adds the `stretch-x` and `stretch-y` modes to `beginTransformDrag` for side handles: the pointer's distance along the clip's own axis scales only that axis (pivoting at the origin like `scale`), never flips through the origin, keeps a mirrored clip mirrored, and is one undo step.

### Patch Changes

- Updated dependencies [5fa8674]
  - @miraiclip/core@0.9.0

## 0.4.1

### Patch Changes

- bb6fb02: `beginGesture` is one history entry for real. It now rides on core's `project.beginGesture` instead of committing and undoing an entry per update, so a drag no longer fires a `history` commit (and an undo) for every mouse move, and listeners see one `commit` when the gesture ends. New `Gesture.cancel()` reverts everything a gesture changed and leaves no entry (Esc during a drag). If an undo or redo closes the gesture midway, the next update opens a fresh one rather than writing outside any gesture. `beginTransformDrag`, `beginClipDrag` and `useGesture` get this with no change.

## 0.4.0

### Minor Changes

- 1240743: Check a sequence as one continuous shot. The stage kit now reports, for every label, whether something survives into the next beat (carried, anchored or bare), subjects that leave the frame (`data-keep-in-frame="t0,t1[,whole]"`), uneven beat spacing and stray hard cuts. `@miraiclip/server-export` exports `checkShot(doc, options)`, the MCP server gains a `check_sequence` tool, and `editorTools({ checkSequence })` in `@miraiclip/assistant` offers the same tool to a host that can run the check. `MOTION_TARGETS.shot` is a stricter target for a continuous shot, and `motionFindings` takes `{ rests }` so declared rests are not flagged. The skills now allow stillness only inside a declared `tl.rest`. Warnings never block an export. `probeScriptedHtml` in `@miraiclip/renderer` runs the check in the editor's own sandboxed frame, and `@miraiclip/editor` adds `shotWarnings`, `staleShotChecks` and `shotCheckKey` for a badge, timeline markers and re-checking after edits. `check_sequence` can return before/after frames for bare boundaries (`frames: true`).

### Patch Changes

- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
  - @miraiclip/core@0.8.0

## 0.3.1

### Patch Changes

- Updated dependencies [7477fe6]
  - @miraiclip/core@0.7.0

## 0.3.0

### Minor Changes

- fd07ee1: Clip speed and freeze frames, timeline markers, effect regions, gestures, custom-kind props editing and idempotent kind registration.

### Patch Changes

- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
  - @miraiclip/core@0.6.0

## 0.2.0

### Minor Changes

- 28a6f95: Preview transforms and per-track cuts, with no DOM. `beginTransformDrag(project, bounds, "move" | "scale" | "rotate", start, options)` moves, scales or rotates a clip from where the renderer draws it (`ClipBounds` fits as is): moves snap to the frame's edges and center and return the guides to draw, rotation snaps to right angles (15° steps with Shift), and the whole drag is one undo step. `writeClipTransform` writes keyframes at the playhead for animated properties and static values otherwise; `nudgeClip`, `canTransformClip`, `rotateHandlePosition`, `cornerCursor` and `snapOffset` cover the rest of a transform box. `trackCuts(clips, transitions)` lists one track's cuts and their transitions, for timeline markers.

## 0.1.1

### Patch Changes

- 373735b: Browser helpers for media import: `probeMediaFile(file)` reads a picked or dropped file's kind, duration, size and a thumbnail (with an object URL as `src`), and `isSourceReachable(src)` tells whether a saved project's media can still be fetched. Both touch the DOM only when called; the rest of the package still runs without one.

## 0.1.0

### Minor Changes

- dccd95f: First release: the headless logic of an editor UI, with no framework and no DOM. Cached selectors (`clipsByTrack`, `clipsInRange`, `compositionDurationUs`, `isTrackFree`), timeline geometry (`usToPx`, `visibleRange`, `zoomAtPoint`, playhead follow), clip move and trim with snapping (`beginClipDrag`), typed command builders (`createCommands`), one-undo-step live edits (`beginGesture`), the default key map (`matchEditorShortcut`, `runEditorAction`, locked tracks respected), asset placement and aspect-ratio framing helpers.
