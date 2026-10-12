# @miraiclip/editor

## 0.1.1

### Patch Changes

- 373735b: Browser helpers for media import: `probeMediaFile(file)` reads a picked or dropped file's kind, duration, size and a thumbnail (with an object URL as `src`), and `isSourceReachable(src)` tells whether a saved project's media can still be fetched. Both touch the DOM only when called; the rest of the package still runs without one.

## 0.1.0

### Minor Changes

- dccd95f: First release: the headless logic of an editor UI, with no framework and no DOM. Cached selectors (`clipsByTrack`, `clipsInRange`, `compositionDurationUs`, `isTrackFree`), timeline geometry (`usToPx`, `visibleRange`, `zoomAtPoint`, playhead follow), clip move and trim with snapping (`beginClipDrag`), typed command builders (`createCommands`), one-undo-step live edits (`beginGesture`), the default key map (`matchEditorShortcut`, `runEditorAction`, locked tracks respected), asset placement and aspect-ratio framing helpers.
