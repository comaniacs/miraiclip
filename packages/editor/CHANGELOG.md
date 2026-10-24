# @miraiclip/editor

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
