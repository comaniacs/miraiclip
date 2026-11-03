export { createProject } from "./engine.js";
export {
  applyCommands,
  commandTypeForTool,
  describeProject,
  toolDefinition,
  toolNameForCommand,
  toToolDefinitions,
  tryDispatch,
} from "./ai.js";
export type { EffectRegion, EffectRegionProperty, Marker, PluginRef } from "./types.js";
export type {
  ApplyCommandsResult,
  CommandFailure,
  CommandResult,
  DescribeProjectOptions,
  ToolStyle,
  ToToolDefinitionsOptions,
} from "./ai.js";
export type {
  CommandDefinition,
  CreateProjectOptions,
  GestureHandle,
  PatchSource,
  Project,
  ProjectEvents,
} from "./engine.js";

export {
  builtinPayloadSchemas,
  commandCatalog,
  transformSchema,
} from "./commands/schemas.js";
export type {
  BuiltinCommand,
  BuiltinCommandPayload,
  BuiltinCommandType,
  Command,
} from "./commands/schemas.js";
export type { CommandHandler } from "./commands/handlers.js";

export {
  CommandRejectedError,
  CommandValidationError,
  UnknownCommandError,
} from "./errors.js";

export { Emitter } from "./events.js";
export type { Listener } from "./events.js";

export { applyJsonPatches, fromJsonPointer, toJsonPatches, toJsonPointer } from "./patches.js";
export type { JsonPatchOp } from "./patches.js";

export * from "./timeline.js";

export { DEFAULT_TRANSFORM, TRACK_ACCEPTS, TYPOGRAPHY_DEFAULTS, isAudioClip, isCaptionClip, isHtmlClip, isImageClip, isTextClip, isVideoClip } from "./types.js";
export type {
  AnimatableProperty,
  Crop,
  Asset,
  AssetKind,
  AssetLicense,
  AssetSource,
  AudioFades,
  AudioClip,
  BuiltinClip,
  CaptionClip,
  CaptionStyle,
  CaptionWord,
  Clip,
  ClipBase,
  ClipKind,
  CustomClip,
  Easing,
  EasingPreset,
  EffectInstance,
  EphemeralState,
  FontStyle,
  FontWeight,
  HtmlClip,
  HtmlParamValue,
  ImageClip,
  Keyframe,
  ProjectDocument,
  FrameRate,
  ProjectSettings,
  ProjectState,
  TextAlign,
  TextClip,
  Track,
  TrackKind,
  Transform,
  Transition,
  TextDecoration,
  Typography,
  Us,
  VideoClip,
} from "./types.js";

export {
  EASING_PRESETS,
  cubicBezierProgress,
  evaluateClipAt,
  evaluateClipInto,
  evaluateKeyframes,
  keyframeTimeUs,
  resolveEasing,
  resolveKeyframes,
} from "./animation.js";
export type { EvaluatedClip } from "./animation.js";
export {
  ANIMATION_DEFAULT_SLOT_US,
  ANIMATION_EASINGS,
  ANIMATION_MAX_SLOT_US,
  ANIMATION_MIN_SLOT_US,
  ANIMATION_PRESETS,
  BLUR_ANIMATION_PEAK,
  animationCommands,
  animationPreset,
  describeAnimation,
  fitAnimation,
  planAnimation,
  presetAppliesTo,
  readAnimation,
} from "./animation-presets.js";
export type {
  AnimationEasing,
  AnimationPreset,
  AnimationRecipe,
  AnimationSlot,
  AnimationSlotChoice,
  PlannedKeyframe,
  ReadAnimation,
} from "./animation-presets.js";
export { clipHeadroomUs, findCuts } from "./cuts.js";
export {
  definePlugin,
  documentPlugins,
  pluginFromModule,
  pluginZod,
  trackedCorePluginApi,
  unregisterPluginKinds,
} from "./plugins.js";
export type { CorePluginApi, MiraiclipPlugin, PluginApi, PluginEnvironment, PluginRegistrations } from "./plugins.js";
export { evaluateEffectRegion, hasAnimatedEffectRegion } from "./effect-region.js";
export type { EvaluatedRegion } from "./effect-region.js";
export { listMarkers, markerChapters, markersInRange } from "./markers.js";
export type { Chapter } from "./markers.js";
export {
  MAX_CLIP_SPEED,
  MIN_CLIP_SPEED,
  clipHeadroomTimelineUs,
  clipSpeed,
  durationForSource,
  isFrozenClip,
  isValidClipSpeed,
  sourceEndUs,
  sourceSpanUs,
  toSourceUs,
  toTimelineUs,
} from "./time-remap.js";
export type { Cut } from "./cuts.js";

export {
  builtinEffectParamSchemas,
  builtinTransitionParamSchemas,
  transitionHoldsFrames,
  effectParamsSchema,
  isBuiltinClipKind,
  clipKindRegistration,
  registerClipKind,
  registerEffectKind,
  registerTransitionKind,
  transitionParamsSchema,
  unregisterClipKind,
  unregisterEffectKind,
  unregisterTransitionKind,
} from "./registry.js";
export type { ClipKindRegistration, RegisterOptions } from "./registry.js";

export { EFFECT_CATALOG, EFFECT_CATEGORIES, defaultEffectParams, getEffectInfo } from "./effect-catalog.js";
export type { EffectCategory, EffectInfo, EffectParamFormat, EffectParamInfo } from "./effect-catalog.js";

export {
  captionClipsFromAsrWords,
  captionClipsFromSubtitles,
  captionsToSrt,
  captionsToText,
  captionsToVtt,
  parseSubtitles,
  retimeWords,
  wordsFromCue,
} from "./captions.js";
export { creditsFor, licenseReport, usedAssets } from "./provenance.js";
export type { LicenseIssue } from "./provenance.js";
export type { AsrGroupingOptions, AsrWord, CaptionCue, CaptionCueSource, CaptionImportOptions } from "./captions.js";
export { planSoundFromEvents } from "./sound-from-events.js";
export type { EventSound, SoundFromEventsOptions, SoundFromEventsPlan, SoundPlacement, StageEvent } from "./sound-from-events.js";
export { applyBeatGrid } from "./beat-grid.js";
export type { BeatGrid } from "./beat-grid.js";
