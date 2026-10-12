# @miraiclip/react

## 0.2.0

### Minor Changes

- 28a6f95: Unstyled components that carry an editor's behaviour and leave the look to you. State is exposed as data attributes (`data-selected`, `data-dragging`, `data-locked`, `data-drop-target`, `data-mode`, …), so Tailwind variants or plain CSS style them.
  
  - `<Timeline.*>`: `Root` (zoom, Ctrl/⌘ + wheel zoom, clip drag state), `Viewport` (one scroll container sized to the timeline), `Ruler` (ticks for the visible range, press or drag to seek), `Track`, `TrackHeader` (sticky), `Lane` (renders only the clips in view), `Clip` (move across tracks with snapping, one undo step on release, touch-friendly), `TrimHandle`, `Playhead` (moved on the compositor), `Cuts` (cuts and their transitions, in view) and `PlayheadFollow` (keeps the playhead in view, with an off-screen indicator). Hooks: `useTimeline`, `useTimelineClip`, `useTimelineDrag`, `useTimelineRange`, `useTimelineTrack`, `rulerStepUs`.
  - `<Preview>`: the preview canvas wired to `<PlaybackProvider>`, at a fixed size or fitted to its parent; overlays receive its size, scale and mode (`usePreview`).
  - `<Scrubber.Root | Range | Thumb>`: a keyboard-accessible seek bar whose fill and knob move on the compositor.
  - `<Waveform>` and `useWaveformPeaks(asset)`: decibel-scaled waveform bars with a capped backing store, and peaks computed once per asset and shared.
  - `<TransformBox.*>`: move, scale and rotate the selected clip on the preview, with frame snapping and guides, arrow-key nudges and keyframe-aware edits.
  
  `useTimelineZoom` takes `enabled: false` to leave Ctrl/⌘ + wheel to the browser.

### Patch Changes

- Updated dependencies [28a6f95]
  - @miraiclip/editor@0.2.0

## 0.1.0

### Minor Changes

- dccd95f: First release: React bindings. `ProjectProvider` / `ProjectSessionProvider`, narrow state hooks (`useProjectState`, `useClips`, `useSelection`, `usePlayheadUs`, `usePlayheadRef`, `useUndoRedo`, …), `useCommands`, `PlaybackProvider` / `usePlayback` on the renderer's preview controller, and timeline behaviour hooks (`useCompositorPlayhead`, `useVisibleRange`, `usePlayheadFollow`, `useTimelineZoom`, `useEditorShortcuts`, `useGesture`). Requires @miraiclip/renderer 0.8.1.

### Patch Changes

- Updated dependencies [dccd95f]
- Updated dependencies [dccd95f]
  - @miraiclip/editor@0.1.0
  - @miraiclip/renderer@0.8.1
