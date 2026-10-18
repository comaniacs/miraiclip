/**
 * OpenAI text-to-speech (`POST /v1/audio/speech`): voiceover from text, with
 * delivery direction ("calm, friendly product walkthrough") on models that
 * take instructions. Any server with the same API works through `baseUrl`.
 *
 * OpenAI's usage policies ask you to tell listeners the voice is
 * AI-generated; the recorded terms say so. Check the current terms for your
 * use; this is not legal advice.
 */
import type { AssetLicense } from "@miraiclip/core";
import { AudioSourceError, defaultFetch } from "../common.js";
import type { FetchLike } from "../types.js";
import { audioDurationUs } from "./duration.js";
import { defineGenerator } from "./run.js";
import type { AudioGenerator, GeneratedAudio } from "./types.js";

export interface OpenAiSpeechGeneratorOptions {
  apiKey?: string;
  /** Default "https://api.openai.com". */
  baseUrl?: string;
  /** Default model (default "gpt-4o-mini-tts"). */
  model?: string;
  /** Voice when a request names none (default "alloy"). */
  defaultVoice?: string;
  fetch?: FetchLike;
  id?: string;
  label?: string;
}

const TERMS: AssetLicense = { id: "OpenAI-TTS", url: "https://openai.com/policies/usage-policies/", commercial: true, attributionRequired: false };
const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];
const FORMATS: Record<string, string> = { mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", webm: "audio/webm" };

export function openAiSpeechGenerator(options: OpenAiSpeechGeneratorOptions = {}): AudioGenerator {
  const id = options.id ?? "openai-tts";
  const base = (options.baseUrl ?? "https://api.openai.com").replace(/\/+$/, "");
  const doFetch = options.fetch ?? defaultFetch();
  return defineGenerator({
    id,
    label: options.label ?? "OpenAI speech",
    kinds: ["voice"],
    models: [
      { id: "gpt-4o-mini-tts", label: "GPT-4o mini TTS (takes delivery direction)", kinds: ["voice"] },
      { id: "tts-1", label: "TTS-1 (fast)", kinds: ["voice"] },
      { id: "tts-1-hd", label: "TTS-1 HD", kinds: ["voice"] },
    ],
    limits: { voice: { maxTextChars: 4096 } },
    paramsSchema: {
      voice: {
        type: "object",
        properties: { speed: { type: "number", minimum: 0.25, maximum: 4, default: 1, title: "Speed" } },
      },
    },
    terms: { license: TERMS, notice: "AI-generated voice (OpenAI): tell listeners the voice is AI-generated." },
    voices: async () => VOICES.map((v) => ({ id: v, name: v[0]!.toUpperCase() + v.slice(1) })),

    async generate(request, opts): Promise<GeneratedAudio> {
      if (request.kind !== "voice") throw new AudioSourceError(id, `can't generate ${request.kind}`);
      const model = opts.model ?? options.model ?? "gpt-4o-mini-tts";
      // MP3 by default: small, and its length can be read from the frames.
      const format = opts.format === "ogg" ? "opus" : opts.format === "webm" ? "opus" : (opts.format ?? "mp3");
      opts.onProgress?.({ message: "Generating with OpenAI…" });
      let res: Response;
      try {
        res = await doFetch(`${base}/v1/audio/speech`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}) },
          body: JSON.stringify({
            model,
            input: request.text,
            voice: request.voice ?? options.defaultVoice ?? "alloy",
            response_format: format,
            ...(request.style && model.startsWith("gpt-") ? { instructions: request.style } : {}),
            ...opts.params,
          }),
          ...(opts.signal ? { signal: opts.signal } : {}),
        });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") throw err;
        throw new AudioSourceError(id, `request failed: ${(err as Error)?.message ?? err}`);
      }
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: { message?: string } };
          if (body.error?.message) detail += `: ${body.error.message}`;
        } catch {
          /* not JSON */
        }
        throw new AudioSourceError(id, detail, res.status);
      }
      const bytes = await res.arrayBuffer();
      const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || FORMATS[format] || "audio/mpeg";
      const durationUs = audioDurationUs(bytes, mimeType);
      return { data: bytes, mimeType, model, ...(durationUs ? { durationUs } : {}) };
    },
  });
}
