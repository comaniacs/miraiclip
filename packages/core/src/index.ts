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

export { DEFAULT_TRANSFORM, TRACK_ACCEPTS, isAudioClip, isCaptionClip, isHtmlClip, isImageClip, isTextClip, isVideoClip } from "./types.js";
export type {
  AnimatableProperty,
  Asset,
  AssetKind,
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
  HtmlClip,
  HtmlParamValue,
  ImageClip,
  Keyframe,
  ProjectDocument,
  ProjectSettings,
  ProjectState,
  TextClip,
  Track,
  TrackKind,
  Transform,
  Transition,
  Us,
  VideoClip,
} from "./types.js";

export {
  EASING_PRESETS,
  cubicBezierProgress,
  evaluateClipAt,
  evaluateClipInto,
  evaluateKeyframes,
  resolveEasing,
} from "./animation.js";
export type { EvaluatedClip } from "./animation.js";

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

export {
  captionClipsFromAsrWords,
  captionClipsFromSubtitles,
  parseSubtitles,
  wordsFromCue,
} from "./captions.js";
export type { AsrGroupingOptions, AsrWord, CaptionCue, CaptionImportOptions } from "./captions.js";
