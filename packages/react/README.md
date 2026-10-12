# @miraiclip/react

React bindings for [Miraiclip](https://github.com/comaniacs/miraiclip): providers for a project and its preview, narrow state hooks, the timeline behaviour an editor needs, and unstyled components that carry that behaviour while you supply the look. The logic lives in `@miraiclip/editor` and `@miraiclip/renderer`; this package adapts it to React.

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
| Components | `<Timeline.*>`, `<Preview>`, `<Scrubber.*>`, `<Waveform>` + `useWaveformPeaks`, `<TransformBox.*>` |

## Components

The components render plain elements with no styles beyond layout (positions, sizes, scrolling). State shows up as data attributes, so you style them with Tailwind variants or CSS:

```tsx
import { Timeline, useTracks } from "@miraiclip/react";

function Tracks({ pxPerSecond }: { pxPerSecond: number }) {
  const tracks = useTracks();
  return (
    <Timeline.Root pxPerSecond={pxPerSecond} className="h-64">
      <Timeline.Viewport className="h-full">
        <Timeline.Ruler className="h-6 border-b">
          <Timeline.Playhead className="h-full w-px bg-red-500" />
        </Timeline.Ruler>
        {tracks.map((track) => (
          <Timeline.Track key={track.id} track={track} className="h-12">
            <Timeline.Lane className="border-b data-[drop-target]:bg-sky-50">
              {(clip) => (
                <Timeline.Clip clip={clip} className="h-10 rounded bg-sky-200 data-[selected]:ring-2">
                  <Timeline.TrimHandle side="start" className="w-1.5 bg-sky-500" />
                  <Timeline.TrimHandle side="end" className="w-1.5 bg-sky-500" />
                </Timeline.Clip>
              )}
            </Timeline.Lane>
          </Timeline.Track>
        ))}
      </Timeline.Viewport>
    </Timeline.Root>
  );
}
```

Lanes render only the clips in view, drags snap and land as one undo step, and the playhead moves on the compositor. `<Preview>` with `<TransformBox.*>` inside gives the canvas side: select, move, scale and rotate clips with frame snapping.

**Documentation**: [docs.miraiclip.com](https://docs.miraiclip.com/) · [Source](https://github.com/comaniacs/miraiclip)
