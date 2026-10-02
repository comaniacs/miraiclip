import type { ResolvedAudio } from "../types.js";
import type {
  AudioGenerator,
  GenerateOptions,
  GenerateRequest,
  GeneratedAudio,
  GeneratorInfo,
} from "./types.js";

/** Check an adapter's shape once, at registration (typos fail early). */
export function defineGenerator<G extends AudioGenerator>(generator: G): G {
  if (!generator.id || !/^[a-z0-9][a-z0-9_-]*$/i.test(generator.id)) {
    throw new Error(`Generator id must be alphanumeric with - or _ (got "${generator.id}")`);
  }
  if (!generator.kinds.length) throw new Error(`Generator "${generator.id}" declares no kinds`);
  if (typeof generator.generate !== "function") throw new Error(`Generator "${generator.id}" has no generate()`);
  for (const m of generator.models ?? []) {
    const bad = m.kinds.filter((k) => !generator.kinds.includes(k));
    if (bad.length) throw new Error(`Model "${m.id}" of "${generator.id}" lists unsupported kinds: ${bad.join(", ")}`);
  }
  return generator;
}

/** The serializable description of a generator (what a backend advertises). */
export function describeGenerator(generator: AudioGenerator): GeneratorInfo {
  const { generate: _g, voices, ...info } = generator;
  return { ...info, hasVoices: typeof voices === "function" };
}

/** Reject requests a generator can't take, with messages fit for users and agents. */
export function validateRequest(generator: Pick<AudioGenerator, "id" | "kinds" | "limits">, request: GenerateRequest): string | null {
  if (!generator.kinds.includes(request.kind)) {
    return `${generator.id} can't generate ${request.kind} (supports: ${generator.kinds.join(", ")})`;
  }
  const limits = generator.limits?.[request.kind] ?? {};
  if (request.kind === "voice") {
    if (!request.text?.trim()) return "text is required for voice";
    if (limits.maxTextChars && request.text.length > limits.maxTextChars) return `text is longer than ${limits.maxTextChars} characters`;
  } else {
    if (!request.prompt?.trim()) return "prompt is required";
    if (limits.maxPromptChars && request.prompt.length > limits.maxPromptChars) return `prompt is longer than ${limits.maxPromptChars} characters`;
    const d = request.durationS;
    if (d !== undefined) {
      if (!(d > 0)) return "durationS must be positive";
      if (limits.minDurationS && d < limits.minDurationS) return `durationS must be at least ${limits.minDurationS}`;
      if (limits.maxDurationS && d > limits.maxDurationS) return `durationS must be at most ${limits.maxDurationS}`;
    }
  }
  return null;
}

export type GenerationStatus = "running" | "done" | "failed" | "canceled";

export interface GeneratedResult {
  /** A playable file with provenance, ready for `importAudio`. */
  resolved: ResolvedAudio;
  /** The bytes, when the generator returned bytes (or they were fetched to store them). */
  file?: Blob;
}

/** A generation in progress. One shape for sync and job-based vendors. */
export interface GenerationJob {
  readonly id: string;
  readonly generator: string;
  readonly request: GenerateRequest;
  readonly status: GenerationStatus;
  readonly progress: number | undefined;
  readonly message: string | undefined;
  readonly error: string | undefined;
  result: Promise<GeneratedResult>;
  cancel(): void;
  /** Called on every status/progress change. Returns an unsubscribe. */
  onChange(listener: (job: GenerationJob) => void): () => void;
}

export interface StartGenerationOptions extends Omit<GenerateOptions, "signal" | "onProgress"> {
  signal?: AbortSignal;
  /**
   * Persist the file and return its durable URL (your storage). Without it,
   * the result uses an object URL (browsers: session-only) or a data: URL.
   */
  storeFile?: (file: Blob, name: string) => Promise<string>;
  /** Asset name (default: derived from the prompt/text). */
  name?: string;
  /** Measure duration when the vendor doesn't report it (default: Web Audio decode when available). */
  probeDurationUs?: (file: Blob) => Promise<number | undefined>;
}

let seq = 0;

/** Run a generator as a cancellable job and normalize its output into `ResolvedAudio`. */
export function startGeneration(generator: AudioGenerator, request: GenerateRequest, options: StartGenerationOptions = {}): GenerationJob {
  const controller = new AbortController();
  const listeners = new Set<(job: GenerationJob) => void>();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  const state: { status: GenerationStatus; progress?: number; message?: string; error?: string } = { status: "running" };
  const job: GenerationJob = {
    id: `gen-${Date.now().toString(36)}-${(++seq).toString(36)}`,
    generator: generator.id,
    request,
    get status() {
      return state.status;
    },
    get progress() {
      return state.progress;
    },
    get message() {
      return state.message;
    },
    get error() {
      return state.error;
    },
    result: undefined as never,
    cancel: () => controller.abort(),
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const emit = () => listeners.forEach((l) => l(job));

  job.result = (async (): Promise<GeneratedResult> => {
    const invalid = validateRequest(generator, request);
    if (invalid) throw new Error(invalid);
    const { storeFile, name: givenName, probeDurationUs, signal: _s, ...rest } = options;
    const out = await generator.generate(request, {
      ...rest,
      signal: controller.signal,
      onProgress: (p) => {
        if (state.status !== "running") return;
        if (p.progress !== undefined) state.progress = Math.max(0, Math.min(1, p.progress));
        if (p.message !== undefined) state.message = p.message;
        emit();
      },
    });
    if (controller.signal.aborted) throw abortError();
    return normalize(generator, request, out, { storeFile, name: givenName ?? nameFor(request), probeDurationUs });
  })().then(
    (result) => {
      state.status = "done";
      state.progress = 1;
      emit();
      return result;
    },
    (err: unknown) => {
      state.status = controller.signal.aborted ? "canceled" : "failed";
      state.error = (err as Error)?.message ?? String(err);
      emit();
      throw err;
    },
  );
  // Callers that only watch onChange shouldn't see an unhandled rejection.
  job.result.catch(() => {});
  return job;
}

function abortError(): Error {
  const err = new Error("Generation canceled");
  err.name = "AbortError";
  return err;
}

/** A readable asset name from the request. */
export function nameFor(request: GenerateRequest): string {
  const text = (request.kind === "voice" ? request.text : request.prompt).replace(/\s+/g, " ").trim();
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
}

async function normalize(
  generator: AudioGenerator,
  request: GenerateRequest,
  out: GeneratedAudio,
  opts: { storeFile: StartGenerationOptions["storeFile"] | undefined; probeDurationUs: StartGenerationOptions["probeDurationUs"] | undefined; name: string },
): Promise<GeneratedResult> {
  let file: Blob | undefined;
  let src: string | undefined;
  if (isUrlData(out.data)) {
    if (opts.storeFile) file = await (await fetch(out.data.url)).blob();
    else src = out.data.url;
  } else {
    file = out.data instanceof Blob ? out.data : new Blob([out.data as BlobPart], { type: out.mimeType });
  }
  if (file && file.type !== out.mimeType) file = new Blob([file], { type: out.mimeType });

  let durationUs = out.durationUs;
  if (!durationUs && file) durationUs = await (opts.probeDurationUs ?? webAudioDurationUs)(file).catch(() => undefined);
  if (!durationUs && request.kind !== "voice" && request.durationS) durationUs = Math.round(request.durationS * 1_000_000);

  if (!src) {
    const fileName = `${opts.name.replace(/[^\w\- ]+/g, "").trim().slice(0, 40) || "generated"}.${extensionFor(out.mimeType)}`;
    src = opts.storeFile ? await opts.storeFile(file!, fileName) : await localUrl(file!);
  }

  const license = out.license ?? generator.terms.license;
  const attribution = out.attribution ?? generator.terms.attribution;
  const resolved: ResolvedAudio = {
    src,
    mimeType: out.mimeType,
    name: opts.name,
    kind: request.kind,
    license,
    source: { provider: generator.id, id: out.id ?? `${Date.now().toString(36)}` },
    ...(durationUs ? { durationUs } : {}),
    ...(attribution && license.attributionRequired ? { attribution } : {}),
  };
  return file ? { resolved, file } : { resolved };
}

const isUrlData = (d: GeneratedAudio["data"]): d is { url: string } =>
  typeof d === "object" && d !== null && !(d instanceof Blob) && !(d instanceof ArrayBuffer) && !ArrayBuffer.isView(d) && "url" in d;

export function extensionFor(mimeType: string): string {
  const t = mimeType.split(";")[0]!.trim().toLowerCase();
  return ({ "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/ogg": "ogg", "audio/opus": "opus", "audio/webm": "webm", "audio/mp4": "m4a", "audio/aac": "aac", "audio/flac": "flac" } as Record<string, string>)[t] ?? "bin";
}

async function localUrl(file: Blob): Promise<string> {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") return URL.createObjectURL(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${file.type || "application/octet-stream"};base64,${btoa(bin)}`;
}

/** Duration via Web Audio decode, where available (browsers). */
async function webAudioDurationUs(file: Blob): Promise<number | undefined> {
  const Ctx = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!Ctx) return undefined;
  const ctx = new Ctx(1, 1, 44_100);
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  return Math.round(buffer.duration * 1_000_000);
}
