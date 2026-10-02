export type {
  AudioItem,
  AudioKind,
  AudioProvider,
  AudioProviderCapabilities,
  AudioQuery,
  AudioSearchResult,
  FetchLike,
  ResolvedAudio,
} from "./types.js";
export { AudioSourceError } from "./common.js";
export { creditLine, parseCreativeCommons } from "./licenses.js";
export { createAudioLibrary } from "./library.js";
export type { AudioLibrary, CreateAudioLibraryOptions } from "./library.js";
export { audioAssetPayload, importAudio } from "./import.js";
export type { ImportAudioOptions, ImportAudioResult } from "./import.js";
export { AUDIO_TOOL_NAMES, audioToolDefinitions, runAudioTool } from "./ai.js";
export type { AudioToolDefinitionsOptions, AudioToolName, AudioToolResult, RunAudioToolContext } from "./ai.js";
export { openverseItem, openverseProvider } from "./providers/openverse.js";
export type { OpenverseAudio, OpenverseProviderOptions } from "./providers/openverse.js";
export { freesoundItem, freesoundProvider } from "./providers/freesound.js";
export type { FreesoundProviderOptions, FreesoundSound } from "./providers/freesound.js";
export { staticProvider } from "./providers/static.js";
export type { StaticAudioEntry, StaticProviderOptions } from "./providers/static.js";
export { httpProvider } from "./providers/http.js";
export type { HttpProviderOptions } from "./providers/http.js";

// Generation: one vendor-neutral contract; adapters are small objects.
export type {
  AudioGenerator,
  GenerateOptions,
  GenerateProgress,
  GenerateRequest,
  GeneratedAudio,
  GeneratorInfo,
  GeneratorLimits,
  GeneratorModel,
  GeneratorTerms,
  GeneratorVoice,
  MusicRequest,
  ParamsSchema,
  SfxRequest,
  VoiceRequest,
} from "./generate/types.js";
export { defineGenerator, describeGenerator, nameFor, startGeneration, validateRequest } from "./generate/run.js";
export type { GeneratedResult, GenerationJob, GenerationStatus, StartGenerationOptions } from "./generate/run.js";
export { createGeneratorHandler, remoteGenerator, remoteGenerators } from "./generate/http.js";
export type { GeneratorHandlerOptions, RemoteGeneratorsOptions } from "./generate/http.js";
export { elevenLabsGenerator } from "./generate/elevenlabs.js";
export type { ElevenLabsGeneratorOptions } from "./generate/elevenlabs.js";
export { toneGenerator } from "./generate/tone.js";
export type { ToneGeneratorOptions } from "./generate/tone.js";
