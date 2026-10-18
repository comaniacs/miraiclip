/**
 * The vendor-neutral speech-to-text contract, and two adapters. Nothing else
 * in the package knows which service produced a transcript.
 *
 * Keys belong on a server: run real providers behind `createAsrHandler` and
 * give the browser `remoteAsr(endpoint)`, which has the same shape.
 */
import type { FetchLike, Transcript, TranscriptWord } from "./types.js";

export type AudioInput = Blob | ArrayBuffer | Uint8Array | { url: string };

export interface TranscribeOptions {
  /** Language hint (ISO 639-1, e.g. "en"); absent = detect. */
  language?: string;
  /** Vocabulary or style hint (product names, "keep um and uh"). */
  prompt?: string;
  /** MIME type of `audio` when it isn't a Blob (default "audio/webm"). */
  mimeType?: string;
  /** Vendor-specific request fields, passed through untouched. */
  params?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface AsrProvider {
  id: string;
  label: string;
  transcribe(audio: AudioInput, options?: TranscribeOptions): Promise<Transcript>;
}

export class AsrError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "AsrError";
  }
}

const S = 1_000_000;
const us = (seconds: number) => Math.round(seconds * S);

function defaultFetch(): FetchLike {
  if (typeof fetch !== "function") throw new Error("No global fetch: pass `fetch` to the provider.");
  return (input, init) => fetch(input, init);
}

async function toBlob(audio: AudioInput, mimeType: string, doFetch: FetchLike): Promise<Blob> {
  if (typeof Blob !== "undefined" && audio instanceof Blob) return audio;
  if ("url" in audio) {
    const res = await doFetch(audio.url);
    if (!res.ok) throw new Error(`could not fetch ${audio.url}: HTTP ${res.status}`);
    return res.blob();
  }
  const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio as ArrayBuffer);
  return new Blob([bytes as BlobPart], { type: mimeType });
}

async function send(provider: string, doFetch: FetchLike, url: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await doFetch(url, init);
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new AsrError(provider, `request failed: ${(err as Error)?.message ?? err}`);
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } | string; err_msg?: string };
      const msg = typeof body.error === "string" ? body.error : (body.error?.message ?? body.err_msg);
      if (msg) detail += `: ${msg}`;
    } catch {
      /* not JSON */
    }
    throw new AsrError(provider, detail, res.status);
  }
  return res.json();
}

// --------------------------------------------------------------------------- OpenAI

export interface OpenAiAsrOptions {
  /** Omit when `baseUrl` is a proxy that authenticates for you. */
  apiKey?: string;
  /** Default "https://api.openai.com". Any server with the same API works. */
  baseUrl?: string;
  /** Default "whisper-1" (the model with word timestamps). */
  model?: string;
  fetch?: FetchLike;
  id?: string;
  label?: string;
}

/**
 * OpenAI speech-to-text (`POST /v1/audio/transcriptions`, `verbose_json`
 * with word timestamps). Whisper tends to drop "um" and "uh"; pass a prompt
 * that contains them ("Umm, let me think, uh…") when you want fillers kept
 * for `detectFillers`.
 */
export function openAiAsr(options: OpenAiAsrOptions = {}): AsrProvider {
  const id = options.id ?? "openai";
  const base = (options.baseUrl ?? "https://api.openai.com").replace(/\/+$/, "");
  const doFetch = options.fetch ?? defaultFetch();
  return {
    id,
    label: options.label ?? "OpenAI Whisper",
    async transcribe(audio, opts = {}) {
      const blob = await toBlob(audio, opts.mimeType ?? "audio/webm", doFetch);
      const form = new FormData();
      const ext = (blob.type.split("/")[1] ?? "webm").split(";")[0];
      form.append("file", blob, `audio.${ext}`);
      form.append("model", options.model ?? "whisper-1");
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "word");
      form.append("timestamp_granularities[]", "segment");
      if (opts.language) form.append("language", opts.language);
      if (opts.prompt) form.append("prompt", opts.prompt);
      for (const [k, v] of Object.entries(opts.params ?? {})) form.append(k, String(v));
      const body = (await send(id, doFetch, `${base}/v1/audio/transcriptions`, {
        method: "POST",
        headers: options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {},
        body: form,
        ...(opts.signal ? { signal: opts.signal } : {}),
      })) as {
        language?: string;
        words?: { word: string; start: number; end: number }[];
        segments?: { text: string; start: number; end: number }[];
      };
      const words = attachPunctuation(
        (body.words ?? []).map((w) => ({ text: w.word.trim(), startUs: us(w.start), endUs: us(w.end) })),
        (body.segments ?? []).map((s) => s.text).join(" "),
      );
      return { ...(body.language ? { language: languageCode(body.language) } : {}), words };
    },
  };
}

/** Whisper's word list has no punctuation; copy it back from the segment text, word by word. */
export function attachPunctuation(words: TranscriptWord[], text: string): TranscriptWord[] {
  if (!text) return words;
  const tokens = text.split(/\s+/).filter(Boolean);
  const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
  let t = 0;
  return words.map((w) => {
    const want = bare(w.text);
    for (let look = t; look < Math.min(tokens.length, t + 4); look++) {
      if (bare(tokens[look]!) === want) {
        t = look + 1;
        return { ...w, text: tokens[look]! };
      }
    }
    return w;
  });
}

const LANGUAGE_NAMES: Record<string, string> = {
  english: "en", hindi: "hi", spanish: "es", french: "fr", german: "de", japanese: "ja", chinese: "zh", portuguese: "pt",
  italian: "it", russian: "ru", korean: "ko", arabic: "ar", dutch: "nl", turkish: "tr", polish: "pl", bengali: "bn",
  tamil: "ta", telugu: "te", marathi: "mr", urdu: "ur", indonesian: "id", vietnamese: "vi", thai: "th", swedish: "sv",
};
const languageCode = (name: string) => LANGUAGE_NAMES[name.toLowerCase()] ?? name;

// --------------------------------------------------------------------------- Deepgram

export interface DeepgramAsrOptions {
  apiKey?: string;
  /** Default "https://api.deepgram.com". */
  baseUrl?: string;
  /** Default "nova-3". */
  model?: string;
  /** Speaker labels (default false). */
  diarize?: boolean;
  fetch?: FetchLike;
  id?: string;
  label?: string;
}

/** Deepgram pre-recorded transcription (`POST /v1/listen`), with filler words kept. */
export function deepgramAsr(options: DeepgramAsrOptions = {}): AsrProvider {
  const id = options.id ?? "deepgram";
  const base = (options.baseUrl ?? "https://api.deepgram.com").replace(/\/+$/, "");
  const doFetch = options.fetch ?? defaultFetch();
  return {
    id,
    label: options.label ?? "Deepgram",
    async transcribe(audio, opts = {}) {
      const query = new URLSearchParams({
        model: options.model ?? "nova-3",
        smart_format: "true",
        punctuate: "true",
        filler_words: "true",
        ...(options.diarize ? { diarize: "true" } : {}),
        ...(opts.language ? { language: opts.language } : { detect_language: "true" }),
        ...(opts.prompt ? { keyterm: opts.prompt } : {}),
        ...Object.fromEntries(Object.entries(opts.params ?? {}).map(([k, v]) => [k, String(v)])),
      });
      const auth: Record<string, string> = options.apiKey ? { Authorization: `Token ${options.apiKey}` } : {};
      const init: RequestInit =
        "url" in audio && !(typeof Blob !== "undefined" && audio instanceof Blob)
          ? { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ url: audio.url }) }
          : await (async () => {
              const blob = await toBlob(audio, opts.mimeType ?? "audio/webm", doFetch);
              return { method: "POST", headers: { ...auth, "Content-Type": blob.type || "audio/webm" }, body: blob };
            })();
      const body = (await send(id, doFetch, `${base}/v1/listen?${query}`, { ...init, ...(opts.signal ? { signal: opts.signal } : {}) })) as {
        results?: {
          channels?: {
            detected_language?: string;
            alternatives?: { words?: { word: string; punctuated_word?: string; start: number; end: number; confidence?: number; speaker?: number }[] }[];
          }[];
        };
      };
      const channel = body.results?.channels?.[0];
      const words = (channel?.alternatives?.[0]?.words ?? []).map((w) => ({
        text: w.punctuated_word ?? w.word,
        startUs: us(w.start),
        endUs: us(w.end),
        ...(w.confidence !== undefined ? { confidence: w.confidence } : {}),
        ...(w.speaker !== undefined ? { speaker: String(w.speaker) } : {}),
      }));
      const language = opts.language ?? channel?.detected_language;
      return { ...(language ? { language } : {}), words };
    },
  };
}

// --------------------------------------------------------------------------- server handler + browser proxy

/**
 * A Fetch-API handler that runs providers server-side:
 *
 *   GET  {base}/                     → { providers: [{ id, label }] }
 *   POST {base}/{id}/transcribe?language=&prompt=   body: the audio bytes (Content-Type = its MIME type)
 *                                    → Transcript JSON
 *
 * Errors come back as `{ error }` with 400/404 or the vendor's status.
 */
export function createAsrHandler(providers: AsrProvider[], options: { basePath?: string; maxBytes?: number } = {}) {
  const base = (options.basePath ?? "").replace(/\/+$/, "");
  const byId = new Map(providers.map((p) => [p.id, p]));
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  return async function handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (base && url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return null;
    const parts = url.pathname.slice(base.length).split("/").filter(Boolean);
    if (parts.length === 0 && request.method === "GET") return json(200, { providers: providers.map((p) => ({ id: p.id, label: p.label })) });
    const provider = parts[0] ? byId.get(decodeURIComponent(parts[0])) : undefined;
    if (!provider) return json(404, { error: "unknown provider" });
    if (parts[1] !== "transcribe" || request.method !== "POST") return json(404, { error: "not found" });
    const blob = await request.blob();
    if (blob.size === 0) return json(400, { error: "send the audio as the request body" });
    if (options.maxBytes && blob.size > options.maxBytes) return json(413, { error: `audio is larger than ${options.maxBytes} bytes` });
    const language = url.searchParams.get("language") ?? undefined;
    const prompt = url.searchParams.get("prompt") ?? undefined;
    try {
      const transcript = await provider.transcribe(blob, { ...(language ? { language } : {}), ...(prompt ? { prompt } : {}), signal: request.signal });
      return json(200, transcript);
    } catch (err) {
      const status = err instanceof AsrError && err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
      return json(status, { error: (err as Error).message });
    }
  };
}

/** Browser side of `createAsrHandler`: a provider that forwards to your server. */
export function remoteAsr(endpoint: string, providerId: string, options: { fetch?: FetchLike; label?: string } = {}): AsrProvider {
  const doFetch = options.fetch ?? defaultFetch();
  const base = endpoint.replace(/\/+$/, "");
  return {
    id: providerId,
    label: options.label ?? providerId,
    async transcribe(audio, opts = {}) {
      const blob = await toBlob(audio, opts.mimeType ?? "audio/webm", doFetch);
      const query = new URLSearchParams({ ...(opts.language ? { language: opts.language } : {}), ...(opts.prompt ? { prompt: opts.prompt } : {}) });
      const q = query.toString();
      return (await send(providerId, doFetch, `${base}/${encodeURIComponent(providerId)}/transcribe${q ? `?${q}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
        ...(opts.signal ? { signal: opts.signal } : {}),
      })) as Transcript;
    },
  };
}

/** Read a transcript from Whisper-style seconds (`{ text, start, end }` or core's `AsrWord`). */
export function transcriptFromSeconds(words: readonly { text?: string; word?: string; start?: number; end?: number; startS?: number; endS?: number }[], language?: string): Transcript {
  return {
    ...(language ? { language } : {}),
    words: words
      .map((w) => ({ text: (w.text ?? w.word ?? "").trim(), startUs: us(w.startS ?? w.start ?? 0), endUs: us(w.endS ?? w.end ?? 0) }))
      .filter((w) => w.text && w.endUs > w.startUs),
  };
}
