/**
 * @miraiclip/editor — the logic of an editor UI with no framework and no DOM:
 * timeline geometry, clip drag and trim with snapping, cached selectors,
 * typed commands, live-edit gestures, shortcuts and placement. Framework
 * adapters (@miraiclip/react, …) and vanilla apps build on these.
 */
export {
  clipsByTrack,
  clipsInRange,
  compositionDurationUs,
  isTrackFree,
  lowerBound,
  transitionsByTrack,
} from "./selectors.js";
export {
  followPlayheadScroll,
  formatClock,
  playheadOffscreenSide,
  pxToUs,
  revealPlayheadScroll,
  usToPx,
  visibleRange,
  wheelZoomFactor,
  zoomAtPoint,
} from "./time-scale.js";
export type { PlayheadViewInput, VisibleRangeInput, ZoomAtPointInput } from "./time-scale.js";
export { createCommands, type Commands } from "./commands.js";
export { newId } from "./ids.js";
export { beginGesture, type Gesture } from "./gesture.js";
export { beginClipDrag, clipSnapTargets, snapToTargets } from "./clip-drag.js";
export type { ClipDrag, ClipDragMode, ClipDragOptions, ClipDragPreview } from "./clip-drag.js";
export { matchEditorShortcut, runEditorAction } from "./shortcuts.js";
export type { EditorAction, ShortcutKey } from "./shortcuts.js";
export { placeAssetAtPlayhead, placeAssetOnTrack, type PlaceAssetOptions } from "./placement.js";
export { ASPECT_PRESETS, fillScale, isFramable, presetFor, refillForAspect, type AspectPreset } from "./framing.js";
