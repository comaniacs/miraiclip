/**
 * ElevenLabs (elevenlabs.io): sound effects, music and text-to-speech.
 *
 *   POST /v1/sound-generation          { text, duration_seconds?, prompt_influence?, loop?, model_id? }
 *   POST /v1/music                     { prompt, music_length_ms?, force_instrumental?, model_id?, … }
 *   POST /v1/text-to-speech/{voice_id} { text, model_id?, language_code?, seed?, voice_settings? }
 *   GET  /v2/voices
 *
 * All return audio bytes (`?output_format=mp3_44100_128` by default). Auth is
 * the `xi-api-key` header: pass `apiKey` only server-side, or point `baseUrl`
 * at a proxy that adds it.
 *
 * Output terms depend on your ElevenLabs plan — set `plan` so assets record
 * them (free: non-commercial with attribution; paid: commercial). Check the
 * current ElevenLabs terms for your use; this is not legal advice.
 */
import type { AssetLicense } from "@miraiclip/core";
import { AudioSourceError, defaultFetch, joinUrl } from "../common.js";
import type { FetchLike } from "../types.js";
import { defineGenerator } from "./run.js";
import type { AudioGenerator, GenerateOptions, GeneratedAudio, GeneratorVoice } from "./types.js";

export interface ElevenLabsGeneratorOptions {
  /** API key. Omit when `baseUrl` is a proxy that authenticates for you. */
  apiKey?: string;
  /** Default "https://api.elevenlabs.io". */
  baseUrl?: string;
  /** Plan, for the output terms recorded on assets. Default "free". */
  plan?: "free" | "paid";
  /** Voice used when a voice request names none (default: the first voice in the account). */
  defaultVoiceId?: string;
  /** ElevenLabs output format (default "mp3_44100_128"). */
  outputFormat?: string;
  fetch?: FetchLike;
  id?: string;
  label?: string;
}

const FREE_TERMS: AssetLicense = {
  id: "ElevenLabs-Free",
  url: "https://elevenlabs.io/terms-of-use",
  commercial: false,
  attributionRequired: true,
};
const PAID_TERMS: AssetLicense = {
  id: "ElevenLabs-Paid",
  url: "https://elevenlabs.io/terms-of-use",
  commercial: true,
  attributionRequired: false,
};

export function elevenLabsGenerator(options: ElevenLabsGeneratorOptions = {}): AudioGenerator {
  const id = options.id ?? "elevenlabs";
  const base = options.baseUrl ?? "https://api.elevenlabs.io";
  const doFetch = options.fetch ?? defaultFetch();
  const outputFormat = options.outputFormat ?? "mp3_44100_128";
  const headers = (json: boolean): Record<string, string> => ({
    ...(options.apiKey ? { "xi-api-key": options.apiKey } : {}),
    ...(json ? { "Content-Type": "application/json" } : {}),
    Accept: json ? "audio/mpeg" : "application/json",
  });
  let fallbackVoice: Promise<string> | undefined;

  const post = async (path: string, body: Record<string, unknown>, opts: GenerateOptions, format?: string): Promise<{ res: Response; bytes: ArrayBuffer }> => {
    const of = (opts.params?.output_format as string | undefined) ?? format ?? outputFormat;
    let res: Response;
    try {
      res = await doFetch(joinUrl(base, path, { output_format: of }), {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify(body),
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") throw err;
      throw new AudioSourceError(id, `request failed: ${(err as Error)?.message ?? err}`);
    }
    if (!res.ok) throw new AudioSourceError(id, await errorDetail(res), res.status);
    return { res, bytes: await res.arrayBuffer() };
  };

  const listVoices = async (signal?: AbortSignal): Promise<GeneratorVoice[]> => {
    const res = await doFetch(joinUrl(base, "/v2/voices", { page_size: 100 }), { headers: headers(false), ...(signal ? { signal } : {}) });
    if (!res.ok) throw new AudioSourceError(id, await errorDetail(res), res.status);
    const data = (await res.json()) as { voices?: { voice_id: string; name: string; preview_url?: string; description?: string; labels?: Record<string, string> }[] };
    return (data.voices ?? []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      ...(v.preview_url ? { previewUrl: v.preview_url } : {}),
      ...(v.description ? { description: v.description } : {}),
      ...(v.labels?.language ? { language: v.labels.language } : {}),
      ...(v.labels?.gender ? { gender: v.labels.gender } : {}),
    }));
  };

  const plan = options.plan ?? "free";
  return defineGenerator({
    id,
    label: options.label ?? "ElevenLabs",
    kinds: ["sfx", "music", "voice"],
    models: [
      { id: "eleven_text_to_sound_v2", label: "Sound effects v2", kinds: ["sfx"] },
      { id: "music_v1", label: "Music v1", kinds: ["music"] },
      { id: "eleven_multilingual_v2", label: "Multilingual v2", kinds: ["voice"] },
      { id: "eleven_flash_v2_5", label: "Flash v2.5 (fast)", kinds: ["voice"] },
      { id: "eleven_v3", label: "Eleven v3", kinds: ["voice"] },
    ],
    limits: {
      sfx: { minDurationS: 0.5, maxDurationS: 30 },
      music: { minDurationS: 3, maxDurationS: 600, maxPromptChars: 4100 },
    },
    paramsSchema: {
      sfx: {
        type: "object",
        properties: {
          prompt_influence: { type: "number", minimum: 0, maximum: 1, default: 0.3, title: "Prompt influence", description: "Higher follows the prompt more literally." },
          loop: { type: "boolean", default: false, title: "Seamless loop" },
        },
      },
      voice: {
        type: "object",
        properties: {
          stability: { type: "number", minimum: 0, maximum: 1, default: 0.5, title: "Stability" },
          similarity_boost: { type: "number", minimum: 0, maximum: 1, default: 0.75, title: "Similarity" },
          style: { type: "number", minimum: 0, maximum: 1, default: 0, title: "Style exaggeration" },
          speed: { type: "number", minimum: 0.7, maximum: 1.2, default: 1, title: "Speed" },
        },
      },
    },
    terms:
      plan === "paid"
        ? { license: PAID_TERMS, notice: "Generated with your paid ElevenLabs plan (commercial use per ElevenLabs terms)." }
        : { license: FREE_TERMS, attribution: "Audio generated with ElevenLabs (elevenlabs.io)", notice: "Free ElevenLabs plan: non-commercial use, credit ElevenLabs." },

    voices: (opts) => listVoices(opts?.signal),

    async generate(request, opts): Promise<GeneratedAudio> {
      const params = { ...opts.params };
      delete params.output_format;
      opts.onProgress?.({ message: "Generating with ElevenLabs…" });

      if (request.kind === "sfx") {
        const model = opts.model ?? "eleven_text_to_sound_v2";
        const { res, bytes } = await post("/v1/sound-generation", {
          text: request.prompt,
          model_id: model,
          ...(request.durationS ? { duration_seconds: request.durationS } : {}),
          ...params,
        }, opts);
        return { data: bytes, mimeType: mime(res), model, ...(request.durationS ? { durationUs: Math.round(request.durationS * 1e6) } : {}) };
      }

      if (request.kind === "music") {
        const model = opts.model ?? "music_v1";
        const prompt = request.lyrics ? `${request.prompt}\n\nLyrics:\n${request.lyrics}` : request.prompt;
        const { res, bytes } = await post("/v1/music", {
          prompt,
          model_id: model,
          ...(request.durationS ? { music_length_ms: Math.round(request.durationS * 1000) } : {}),
          ...(request.instrumental ? { force_instrumental: true } : {}),
          ...params,
        }, opts);
        const songId = res.headers.get("song-id");
        return { data: bytes, mimeType: mime(res), model, ...(songId ? { id: songId } : {}), ...(request.durationS ? { durationUs: Math.round(request.durationS * 1e6) } : {}) };
      }

      // voice
      const model = opts.model ?? "eleven_multilingual_v2";
      let voice = request.voice ?? options.defaultVoiceId;
      if (!voice) {
        fallbackVoice ??= listVoices(opts.signal).then((v) => {
          if (!v[0]) throw new AudioSourceError(id, "no voices in this ElevenLabs account");
          return v[0].id;
        });
        voice = await fallbackVoice.catch((err) => {
          fallbackVoice = undefined;
          throw err;
        });
      }
      const { stability, similarity_boost, style, speed, use_speaker_boost, ...restParams } = params;
      const settings = Object.fromEntries(Object.entries({ stability, similarity_boost, style, speed, use_speaker_boost }).filter(([, v]) => v !== undefined));
      const { res, bytes } = await post(`/v1/text-to-speech/${encodeURIComponent(voice)}`, {
        text: request.text,
        model_id: model,
        ...(request.language ? { language_code: request.language.slice(0, 2).toLowerCase() } : {}),
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
        ...(Object.keys(settings).length ? { voice_settings: settings } : {}),
        ...restParams,
      }, opts);
      const requestId = res.headers.get("request-id");
      return { data: bytes, mimeType: mime(res), model, ...(requestId ? { id: requestId } : {}) };
    },
  });
}

function mime(res: Response): string {
  const t = res.headers.get("content-type")?.split(";")[0]?.trim();
  return t && t.startsWith("audio/") ? t : "audio/mpeg";
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    const d = body.detail as { message?: string; status?: string } | string | { msg?: string }[] | undefined;
    if (typeof d === "string") return `HTTP ${res.status}: ${d}`;
    if (Array.isArray(d)) return `HTTP ${res.status}: ${d.map((x) => x.msg).filter(Boolean).join("; ")}`;
    if (d && typeof d === "object" && "message" in d && d.message) return `HTTP ${res.status}: ${d.message}`;
  } catch {
    /* not JSON */
  }
  return `HTTP ${res.status}`;
}
