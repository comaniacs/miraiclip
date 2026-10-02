export { createProject } from "./engine.js";
export {
  applyCommands,
  commandTypeForTool,
  describeProject,
  toolNameForCommand,
  toToolDefinitions,
  tryDispatch,
} from "./ai.js";
export type {
  ApplyCommandsResult,
  CommandFailure,
  CommandResult,
  DescribeProjectOptions,
  ToToolDefinitionsOptions,
} from "./ai.js";
export type {
  CommandDefinition,
  CreateProjectOptions,
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
  ProjectSettings,
  ProjectState,
  TextAlign,
  TextClip,
  Track,
  TrackKind,
  Transform,
  Transition,
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
  animationCommands,
  animationPreset,
  describeAnimation,
  fitAnimation,
  planAnimation,
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
export type { Cut } from "./cuts.js";

export {
  builtinEffectParamSchemas,
  builtinTransitionParamSchemas,
  effectParamsSchema,
  isBuiltinClipKind,
  clipKindRegistration,
  registerClipKind,
  registerEffectKind,
  registerTransitionKind,
  transitionParamsSchema,
} from "./registry.js";
export type { ClipKindRegistration } from "./registry.js";

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
