/**
 * Speak the script: each line through a voice generator (any
 * `@miraiclip/audio-sources` AudioGenerator with the "voice" kind —
 * ElevenLabs, OpenAI, a remote proxy, your own), stored wherever you keep
 * media, with its exact length.
 */
import { audioDurationUs } from "@miraiclip/audio-sources";
import type { Script, ScriptSegment } from "./script.js";

/** The slice of an AudioGenerator this needs. */
export interface VoiceGenerator {
  id: string;
  generate(
    request: { kind: "voice"; text: string; voice?: string; language?: string; style?: string },
    options: { model?: string; format?: "mp3" | "wav" | "ogg" | "webm"; signal?: AbortSignal; params?: Record<string, unknown> },
  ): Promise<{ data: Blob | ArrayBuffer | Uint8Array | { url: string }; mimeType: string; durationUs?: number; license?: unknown; attribution?: string }>;
  terms?: { license: unknown; attribution?: string };
}

/** One spoken line, stored. */
export interface NarrationTake {
  segmentId: string;
  /** Where the audio is, as the project will load it. */
  src: string;
  mimeType: string;
  durationUs: number;
  /** The text that was spoken (to spot stale takes after an edit). */
  text: string;
  generator?: string;
}

export interface SynthesizeOptions {
  /** Store the audio and return its `src` (a path, a URL). Not needed when the generator returns URLs. */
  store?: (audio: { data: Uint8Array; mimeType: string }, segment: ScriptSegment) => Promise<string>;
  voice?: string;
  /** Delivery direction for models that take it ("calm, friendly walkthrough"). */
  style?: string;
  model?: string;
  format?: "mp3" | "wav" | "ogg" | "webm";
  params?: Record<string, unknown>;
  /** Lines generated at once (default 2). */
  concurrency?: number;
  /** Length of audio in formats this package can't read (default: WAV and MP3 only). */
  durationOf?: (audio: { data: Uint8Array; mimeType: string }) => Promise<number>;
  /** Reuse takes whose text hasn't changed (pass the previous result). */
  reuse?: NarrationTake[];
  onTake?: (take: NarrationTake) => void;
  signal?: AbortSignal;
}

async function bytesOf(data: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(await data.arrayBuffer());
}

export async function synthesizeNarration(generator: VoiceGenerator, script: Script, options: SynthesizeOptions = {}): Promise<NarrationTake[]> {
  const reuse = new Map((options.reuse ?? []).map((t) => [t.segmentId, t]));
  const out: NarrationTake[] = new Array(script.segments.length);
  let next = 0;
  const worker = async () => {
    while (next < script.segments.length) {
      const i = next++;
      const segment = script.segments[i]!;
      const old = reuse.get(segment.id);
      if (old && old.text === segment.text) {
        out[i] = old;
        continue;
      }
      const audio = await generator.generate(
        { kind: "voice", text: segment.text, ...(options.voice ? { voice: options.voice } : {}), ...(script.language ? { language: script.language } : {}), ...(options.style ? { style: options.style } : {}) },
        { ...(options.model ? { model: options.model } : {}), ...(options.format ? { format: options.format } : {}), ...(options.params ? { params: options.params } : {}), ...(options.signal ? { signal: options.signal } : {}) },
      );
      let src: string;
      let durationUs = audio.durationUs;
      if ("url" in audio.data && !(audio.data instanceof Uint8Array) && !(audio.data instanceof ArrayBuffer) && !(typeof Blob !== "undefined" && audio.data instanceof Blob)) {
        src = audio.data.url;
        if (durationUs === undefined) throw new Error(`${generator.id} returned a URL without a duration for "${segment.id}"; store the bytes instead`);
      } else {
        const data = await bytesOf(audio.data as Blob | ArrayBuffer | Uint8Array);
        durationUs ??= audioDurationUs(data, audio.mimeType) ?? (options.durationOf ? await options.durationOf({ data, mimeType: audio.mimeType }) : undefined);
        if (durationUs === undefined) throw new Error(`can't tell the length of ${audio.mimeType} audio: ask for "mp3" or "wav", or pass durationOf`);
        if (!options.store) throw new Error("pass `store` to save the generated audio somewhere the project can load it");
        src = await options.store({ data, mimeType: audio.mimeType }, segment);
      }
      const take: NarrationTake = { segmentId: segment.id, src, mimeType: audio.mimeType, durationUs, text: segment.text, generator: generator.id };
      out[i] = take;
      options.onTake?.(take);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 2) }, worker));
  return out;
}
