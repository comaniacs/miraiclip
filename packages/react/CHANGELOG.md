# @miraiclip/react

## 0.3.1

### Patch Changes

- Updated dependencies [e856c77]
  - @miraiclip/renderer@0.14.0

## 0.3.0

### Minor Changes

- 84c5402: Side handles for the transform box. `<TransformBox.SideHandle side="top|right|bottom|left" />` sits in the middle of a side and stretches only that axis of the clip (left and right its width, top and bottom its height, pivoting at the origin like the corner handles; one undo step; a mirrored clip stays mirrored). `@miraiclip/editor` exports the pieces for custom handles: `sideHandlePosition`, `sideDragMode`, `sideCursor` and the `TransformSide` type.

### Patch Changes

- Updated dependencies [84c5402]
  - @miraiclip/editor@0.6.0

## 0.2.6

### Patch Changes

- Updated dependencies [5fa8674]
  - @miraiclip/core@0.9.0
  - @miraiclip/renderer@0.13.0
  - @miraiclip/editor@0.5.0

## 0.2.5

### Patch Changes

- Updated dependencies [dedf3d8]
- Updated dependencies [9207399]
  - @miraiclip/renderer@0.12.0

## 0.2.4

### Patch Changes

- Updated dependencies [e82dd58]
  - @miraiclip/renderer@0.11.0

## 0.2.3

### Patch Changes

- Updated dependencies [1240743]
- Updated dependencies [888c1eb]
- Updated dependencies [02fa701]
- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
- Updated dependencies [63276db]
- Updated dependencies [63276db]
  - @miraiclip/renderer@0.10.0
  - @miraiclip/editor@0.4.0
  - @miraiclip/core@0.8.0

## 0.2.2

### Patch Changes

- Updated dependencies [7477fe6]
  - @miraiclip/core@0.7.0
  - @miraiclip/editor@0.3.1
  - @miraiclip/renderer@0.9.1

## 0.2.1

### Patch Changes

- fd07ee1: Clip speed and freeze frames, timeline markers, effect regions, gestures, custom-kind props editing and idempotent kind registration.
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
  - @miraiclip/core@0.6.0
  - @miraiclip/renderer@0.9.0
  - @miraiclip/editor@0.3.0

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
