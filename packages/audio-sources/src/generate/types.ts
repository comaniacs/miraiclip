import type { AssetLicense } from "@miraiclip/core";
import type { AudioKind } from "../types.js";

/**
 * The vendor-neutral generation contract. Nothing here names a service: an
 * ElevenLabs, OpenAI, Google, ByteDance or self-hosted adapter is a small
 * object implementing `AudioGenerator`. Common intent goes in the request;
 * anything vendor-specific goes in `options.params`, described by the
 * adapter's `paramsSchema` so UIs and AI tools can offer it without code.
 */

export interface SfxRequest {
  kind: "sfx";
  prompt: string;
  durationS?: number;
}

export interface MusicRequest {
  kind: "music";
  prompt: string;
  durationS?: number;
  instrumental?: boolean;
  /** Lyrics to sing, when the model supports vocals. */
  lyrics?: string;
}

export interface VoiceRequest {
  kind: "voice";
  /** What to say. */
  text: string;
  /** A voice id from `generator.voices()`. Default: the adapter's default voice. */
  voice?: string;
  /** BCP-47 / ISO 639-1 language hint, e.g. "en", "hi". */
  language?: string;
  /** Free-form delivery direction ("warm, slow, smiling"), for models that take one. */
  style?: string;
}

export type GenerateRequest = SfxRequest | MusicRequest | VoiceRequest;

export interface GenerateProgress {
  /** 0..1 when the vendor reports it. */
  progress?: number;
  message?: string;
}

export interface GenerateOptions {
  /** A model id from `generator.models` (default: the adapter's default for the kind). */
  model?: string;
  seed?: number;
  /** Container/codec preference; adapters map it onto their own format names. */
  format?: "mp3" | "wav" | "ogg" | "webm";
  /** Vendor-specific settings, validated by nothing here and passed through untouched. */
  params?: Record<string, unknown>;
  signal?: AbortSignal;
  onProgress?: (progress: GenerateProgress) => void;
}

/** The bytes (or a fetchable URL) a generator produced, plus what it is. */
export interface GeneratedAudio {
  /** The audio. A `{ url }` must be fetchable by whoever stores it. */
  data: Blob | ArrayBuffer | Uint8Array | { url: string };
  mimeType: string;
  durationUs?: number;
  /** The vendor's id for this generation (request id, song id, …). */
  id?: string;
  /** The model that produced it. */
  model?: string;
  /** Overrides the generator's `terms` for this output (e.g. per-model terms). */
  license?: AssetLicense;
  attribution?: string;
}

export interface GeneratorModel {
  id: string;
  label: string;
  kinds: AudioKind[];
}

export interface GeneratorVoice {
  id: string;
  name: string;
  language?: string;
  gender?: string;
  description?: string;
  previewUrl?: string;
}

/** A JSON Schema object describing `options.params` for one kind. */
export type ParamsSchema = {
  type: "object";
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
  additionalProperties?: boolean;
};

export interface GeneratorTerms {
  /** What the output may be used for, as recorded on the asset. */
  license: AssetLicense;
  /** Credit line the terms ask for, if any. */
  attribution?: string;
  /** Short note shown to users. */
  notice?: string;
}

export interface GeneratorLimits {
  minDurationS?: number;
  maxDurationS?: number;
  maxPromptChars?: number;
  maxTextChars?: number;
}

export interface AudioGenerator {
  id: string;
  label: string;
  kinds: AudioKind[];
  models?: GeneratorModel[];
  /** Voices for `kind: "voice"`. */
  voices?(options?: { signal?: AbortSignal }): Promise<GeneratorVoice[]>;
  limits?: Partial<Record<AudioKind, GeneratorLimits>>;
  paramsSchema?: Partial<Record<AudioKind, ParamsSchema>>;
  terms: GeneratorTerms;
  /**
   * Produce audio. Sync vendors return the file; job-based vendors poll or
   * stream here and report through `onProgress`. Must honor `signal`.
   */
  generate(request: GenerateRequest, options: GenerateOptions): Promise<GeneratedAudio>;
}

/** Everything about a generator except `generate` — what a backend advertises. */
export type GeneratorInfo = Omit<AudioGenerator, "generate" | "voices"> & { hasVoices: boolean };
