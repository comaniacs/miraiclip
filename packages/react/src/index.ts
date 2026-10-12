/**
 * @miraiclip/react — React bindings for Miraiclip. Providers for the project
 * and its playback, narrow state hooks, the timeline behaviour an editor needs
 * (virtualised range, playhead follow, zoom, shortcuts), and unstyled
 * components (<Timeline.*>, <Preview>, <Scrubber.*>, <Waveform>,
 * <TransformBox.*>) that carry the behaviour and leave the look to you. The
 * logic lives in @miraiclip/editor and @miraiclip/renderer; this package
 * adapts it.
 */
export {
  ProjectProvider,
  ProjectSessionProvider,
  useProject,
  useProjectSession,
  type ProjectProviderProps,
  type ProjectSession,
  type SessionInit,
} from "./project.js";
export {
  shallowEqual,
  useClip,
  useClipCount,
  useClips,
  useCommands,
  useDurationUs,
  useHistoryState,
  usePlayheadRef,
  usePlayheadUs,
  useProjectState,
  useSelectedClip,
  useSelection,
  useSettings,
  useTrack,
  useTrackOrder,
  useTracks,
  useTransitions,
  useUndoRedo,
  type UndoRedo,
} from "./state.js";
export { PlaybackProvider, usePlayback, type PlaybackProviderProps, type PlaybackValue } from "./playback.js";
export {
  isEditableTarget,
  useCompositorPlayhead,
  useEditorShortcuts,
  useGesture,
  usePlayheadFollow,
  useTimelineZoom,
  useVisibleRange,
  type PlayheadFollow,
  type TimelineZoomOptions,
} from "./timeline.js";
export {
  Timeline,
  rulerStepUs,
  useTimeline,
  useTimelineClip,
  useTimelineDrag,
  useTimelineRange,
  useTimelineTrack,
  type RulerTick,
  type TimelineClipProps,
  type TimelineClipState,
  type TimelineContextValue,
  type TimelineCut,
  type TimelineCutsProps,
  type TimelineLaneProps,
  type TimelineRootProps,
  type TimelineRulerProps,
  type TimelineTrackProps,
  type TimelineTrimHandleProps,
  type TimelineViewportProps,
} from "./components/timeline.js";
export { Preview, usePreview, type PreviewProps, type PreviewState } from "./components/preview.js";
export { Scrubber, type ScrubberRootProps } from "./components/scrubber.js";
export { Waveform, useWaveformPeaks, type WaveformProps } from "./components/waveform.js";
export {
  TransformBox,
  useTransformBox,
  type TransformBoxOutlineProps,
  type TransformBoxRootProps,
  type TransformBoxState,
} from "./components/transform-box.js";
