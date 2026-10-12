# @miraiclip/react

React bindings for [Miraiclip](https://github.com/comaniacs/miraiclip): providers for a project and its preview, narrow state hooks, and the timeline behaviour an editor needs. The logic lives in `@miraiclip/editor` and `@miraiclip/renderer`; this package adapts it to React.

## Install

```bash
npm install @miraiclip/core @miraiclip/renderer @miraiclip/react
```

## Usage

```tsx
import { ProjectProvider, PlaybackProvider, usePlayback, useClips, useUndoRedo } from "@miraiclip/react";

export function App() {
  return (
    <ProjectProvider init={{ width: 1920, height: 1080, fps: 30 }}>
      <PlaybackProvider volumeStorageKey="my-editor:volume">
        <Transport />
      </PlaybackProvider>
    </ProjectProvider>
  );
}

function Transport() {
  const { isPlaying, toggle } = usePlayback();
  const { canUndo, undo } = useUndoRedo();
  return (
    <>
      <button onClick={toggle}>{isPlaying ? "Pause" : "Play"}</button>
      <button disabled={!canUndo} onClick={undo}>Undo</button>
    </>
  );
}
```

| Area | Hooks and components |
| --- | --- |
| Project | `ProjectProvider`, `ProjectSessionProvider`, `useProject`, `useProjectSession` |
| State | `useProjectState`, `useSettings`, `useTracks`, `useTrack`, `useClips`, `useClip`, `useClipCount`, `useTransitions`, `useSelection`, `useSelectedClip`, `useDurationUs` |
| Playhead | `usePlayheadUs` (re-renders), `usePlayheadRef` (no re-render) |
| Editing | `useCommands`, `useUndoRedo`, `useGesture`, `useEditorShortcuts` |
| Preview | `PlaybackProvider`, `usePlayback` (attach a `<canvas>`, play, seek, volume, hit-testing) |
| Timeline | `useCompositorPlayhead`, `useVisibleRange`, `usePlayheadFollow`, `useTimelineZoom` |

**Documentation**: [docs.miraiclip.com](https://docs.miraiclip.com/) · [Source](https://github.com/comaniacs/miraiclip)
