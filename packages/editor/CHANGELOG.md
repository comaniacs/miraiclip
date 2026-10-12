# @miraiclip/editor

## 0.1.0

### Minor Changes

- dccd95f: First release: the headless logic of an editor UI, with no framework and no DOM. Cached selectors (`clipsByTrack`, `clipsInRange`, `compositionDurationUs`, `isTrackFree`), timeline geometry (`usToPx`, `visibleRange`, `zoomAtPoint`, playhead follow), clip move and trim with snapping (`beginClipDrag`), typed command builders (`createCommands`), one-undo-step live edits (`beginGesture`), the default key map (`matchEditorShortcut`, `runEditorAction`, locked tracks respected), asset placement and aspect-ratio framing helpers. Browser-only helpers for media import: `probeMediaFile` (kind, duration, size and a thumbnail for a dropped file) and `isSourceReachable`; they touch the DOM only when called.
