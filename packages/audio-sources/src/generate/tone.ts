/**
 * An offline test generator: synthesizes a short WAV from the request (a
 * pitch derived from the prompt), with no network and no keys. For tests,
 * demos and wiring up UIs before connecting a real service. Output is CC0.
 */
import { parseCreativeCommons } from "../licenses.js";
import { defineGenerator } from "./run.js";
import type { AudioGenerator, GenerateRequest } from "./types.js";

export interface ToneGeneratorOptions {
  id?: string;
  label?: string;
  /** Simulated latency in ms (progress is reported along the way). Default 0. */
  latencyMs?: number;
  sampleRate?: number;
}

export function toneGenerator(options: ToneGeneratorOptions = {}): AudioGenerator {
  const sampleRate = options.sampleRate ?? 22_050;
  return defineGenerator({
    id: options.id ?? "tone",
    label: options.label ?? "Test tones",
    kinds: ["sfx", "music", "voice"],
    models: [{ id: "sine", label: "Sine", kinds: ["sfx", "music", "voice"] }],
    limits: { sfx: { maxDurationS: 30 }, music: { maxDurationS: 120 } },
    paramsSchema: {
      sfx: { type: "object", properties: { pitch: { type: "number", minimum: 50, maximum: 2000, title: "Pitch (Hz)" } } },
      music: { type: "object", properties: { pitch: { type: "number", minimum: 50, maximum: 2000, title: "Root pitch (Hz)" } } },
    },
    terms: { license: parseCreativeCommons("cc0")!, notice: "Offline test tones — no service connected." },
    async voices() {
      return [
        { id: "low", name: "Low tone" },
        { id: "high", name: "High tone" },
      ];
    },
    async generate(request, opts) {
      const steps = 4;
      for (let i = 1; i <= steps && options.latencyMs; i++) {
        await sleep(options.latencyMs / steps, opts.signal);
        opts.onProgress?.({ progress: i / steps, message: `step ${i}/${steps}` });
      }
      if (opts.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      const seconds = durationOf(request);
      const pitch = Number(opts.params?.pitch) || pitchOf(request);
      const wav = encodeWav(synth(request, seconds, pitch, sampleRate), sampleRate);
      return { data: wav, mimeType: "audio/wav", durationUs: Math.round(seconds * 1e6), model: "sine", id: `tone-${Math.round(pitch)}-${seconds}` };
    },
  });
}

function durationOf(r: GenerateRequest): number {
  if (r.kind === "voice") return Math.min(20, Math.max(0.5, r.text.split(/\s+/).length * 0.35));
  return r.durationS ?? (r.kind === "music" ? 8 : 1);
}

function pitchOf(r: GenerateRequest): number {
  if (r.kind === "voice") return r.voice === "high" ? 520 : 220;
  let h = 0;
  for (const c of r.prompt) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 200 + (h % 600);
}

function synth(r: GenerateRequest, seconds: number, pitch: number, rate: number): Float32Array {
  const n = Math.round(seconds * rate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let v: number;
    if (r.kind === "music") {
      const step = Math.floor(t * 2) % 4;
      const f = pitch * [1, 1.25, 1.5, 1.25][step]!;
      v = 0.5 * Math.sin(2 * Math.PI * f * t) * (1 - ((t * 2) % 1) * 0.6);
    } else if (r.kind === "voice") {
      const syllable = (t * 3) % 1;
      v = 0.5 * Math.sin(2 * Math.PI * pitch * (1 + 0.05 * Math.sin(t * 9)) * t) * Math.sin(Math.PI * syllable);
    } else {
      v = 0.6 * Math.sin(2 * Math.PI * pitch * (1 + t) * t) * Math.exp(-t * 3 / seconds);
    }
    const edge = Math.min(1, t / 0.01, (seconds - t) / 0.01);
    out[i] = v * edge;
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i]!)) * 0x7fff, true);
  return buf;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    }, { once: true });
  });
}
