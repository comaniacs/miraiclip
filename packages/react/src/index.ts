/**
 * @miraiclip/react — React bindings for Miraiclip. Providers for the project
 * and its playback, narrow state hooks, and the timeline behaviour an editor
 * needs (virtualised range, playhead follow, zoom, shortcuts). The logic lives
 * in @miraiclip/editor and @miraiclip/renderer; this package adapts it.
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
