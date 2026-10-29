/**
 * Distributed rendering: one export split into frame-aligned video chunks
 * rendered in parallel, plus one audio pass over the whole range, joined
 * with an ffmpeg stream copy (no re-encode). Every chunk runs the same
 * in-browser export pipeline as a single-pass export, so the picture is the
 * same; audio is mixed once, exactly as a single pass mixes it, so there are
 * no seams at chunk boundaries.
 *
 * Where chunks run is a `RenderRunner`: `localRunner` (a pool of warm
 * browsers on this machine), `httpRunner` (POST jobs to workers you deploy
 * anywhere: Cloud Run, Lambda function URLs, Fly, your own boxes, each
 * running `createRenderJobHandler`), or your own.
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { projectFrameRate, type ProjectDocument } from "@miraiclip/core";
import { createExportSession, type CreateExportSessionOptions, type ExportSession } from "./export-session.js";
import type { ExportProjectFileOptions } from "./types.js";

/** One unit of work for a runner. Plain JSON, so it can travel over HTTP. */
export interface RenderJob {
  id: string;
  /** "video": a picture-only chunk; "audio": the whole range's sound (with a token picture). */
  kind: "video" | "audio";
  doc: ProjectDocument;
  options: Pick<ExportProjectFileOptions, "format" | "quality" | "fps" | "width" | "height" | "range" | "motionBlur">;
}

export interface RenderJobResult {
  id: string;
  /** A file on THIS machine (local runners). */
  file?: string;
  /** The encoded bytes (remote runners). */
  bytes?: Uint8Array;
}

export interface RenderRunner {
  /** How many jobs it runs at once. */
  readonly concurrency: number;
  run(job: RenderJob, options: { signal?: AbortSignal; workDir: string }): Promise<RenderJobResult>;
  close?(): Promise<void>;
}

export interface RenderDistributedOptions {
  format: "mp4" | "webm";
  quality?: ExportProjectFileOptions["quality"];
  fps?: number;
  width?: number;
  height?: number;
  range?: { startUs: number; endUs: number };
  /** Shutter motion blur on every video chunk (frames are pure functions of time, so chunks blur the same as one pass). */
  motionBlur?: ExportProjectFileOptions["motionBlur"];
  runner: RenderRunner;
  /** Number of video chunks (default: enough for every runner slot, at least 2 s each). */
  chunks?: number;
  /** Shortest chunk worth a separate job (default 2 s). */
  minChunkUs?: number;
  /** The joined file. */
  out: string;
  /** ffmpeg binary (default "ffmpeg" on PATH). */
  ffmpegPath?: string;
  signal?: AbortSignal;
  onProgress?: (progress: { jobsDone: number; jobsTotal: number; phase: "render" | "join" }) => void;
  /** Keep the chunk files (default false). */
  keepChunks?: boolean;
}

export interface RenderDistributedResult {
  filePath: string;
  chunks: { startUs: number; endUs: number }[];
  hasAudio: boolean;
}

/** End of the last clip (the default export range's end). */
const compositionEnd = (doc: ProjectDocument) => Math.max(0, ...Object.values(doc.clips).map((c) => c.startUs + c.durationUs));

/** Whether anything in the document can be heard over the range (unmuted sound clips). */
export function hasAudibleClips(doc: ProjectDocument, range: { startUs: number; endUs: number }): boolean {
  const soloed = Object.values(doc.tracks).some((t) => t.solo);
  return Object.values(doc.clips).some((c) => {
    if (!("assetId" in c) || !("volume" in c)) return false;
    const track = doc.tracks[c.trackId];
    if (!track || track.muted || (soloed && !track.solo)) return false;
    if (c.startUs >= range.endUs || c.startUs + c.durationUs <= range.startUs) return false;
    const animated = (c.animations?.volume?.length ?? 0) > 0;
    return (c as { volume: number }).volume > 0 || animated;
  });
}

/** Frame-aligned chunk ranges covering `range`. */
export function planChunks(doc: ProjectDocument, range: { startUs: number; endUs: number }, count: number, fps?: number): { startUs: number; endUs: number }[] {
  const rate = fps ? { num: fps, den: 1 } : projectFrameRate(doc.settings);
  const frameUs = (1_000_000 * rate.den) / rate.num;
  const frames = Math.ceil((range.endUs - range.startUs) / frameUs - 1e-6);
  const n = Math.max(1, Math.min(count, frames));
  const out: { startUs: number; endUs: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.round((frames * i) / n);
    const b = Math.round((frames * (i + 1)) / n);
    out.push({ startUs: range.startUs + Math.round(a * frameUs), endUs: i === n - 1 ? range.endUs : range.startUs + Math.round(b * frameUs) });
  }
  return out;
}

/** The document with every sound muted: video chunks carry no audio track. */
function silenced(doc: ProjectDocument): ProjectDocument {
  const copy = structuredClone(doc);
  for (const t of Object.values(copy.tracks)) t.muted = true;
  return copy;
}

function ffmpeg(bin: string, args: string[], signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["-hide_banner", "-loglevel", "error", ...args], { stdio: ["ignore", "ignore", "pipe"], ...(signal ? { signal } : {}) });
    let err = "";
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e) => reject(new Error(`could not run ffmpeg (${bin}): ${e.message}`)));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${err.trim()}`))));
  });
}

export async function renderDistributed(doc: ProjectDocument, options: RenderDistributedOptions): Promise<RenderDistributedResult> {
  const range = options.range ?? { startUs: 0, endUs: compositionEnd(doc) };
  if (!(range.endUs > range.startUs)) throw new Error("nothing to render: the composition is empty");
  const minChunk = options.minChunkUs ?? 2_000_000;
  const wanted = options.chunks ?? Math.max(1, options.runner.concurrency);
  const count = Math.max(1, Math.min(wanted, Math.floor((range.endUs - range.startUs) / minChunk) || 1));
  const chunks = planChunks(doc, range, count, options.fps);
  const hasAudio = hasAudibleClips(doc, range);
  const common = { format: options.format, ...(options.quality ? { quality: options.quality } : {}), ...(options.fps ? { fps: options.fps } : {}), ...(options.width ? { width: options.width } : {}), ...(options.height ? { height: options.height } : {}) };
  const videoDoc = silenced(doc);
  const videoOptions = { ...common, ...(options.motionBlur !== undefined ? { motionBlur: options.motionBlur } : {}) };
  const jobs: RenderJob[] = chunks.map((r, i) => ({ id: `video-${String(i).padStart(4, "0")}`, kind: "video", doc: videoDoc, options: { ...videoOptions, range: r } }));
  if (hasAudio) {
    // The sound over the whole range, with a token picture (tiny, 1 fps): its audio track is the deliverable.
    const aspect = doc.settings.width / doc.settings.height;
    const h = 64;
    const w = Math.max(16, Math.round((h * aspect) / 2) * 2);
    jobs.push({ id: "audio", kind: "audio", doc, options: { format: options.format, quality: "draft", fps: 1, width: w, height: h, range } });
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "miraiclip-dist-"));
  const files = new Map<string, string>();
  const abort = new AbortController();
  const onAbort = () => abort.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    let next = 0;
    let done = 0;
    const order = [...jobs].sort((a, b) => (a.kind === "audio" ? -1 : b.kind === "audio" ? 1 : 0)); // the long audio job first
    const worker = async () => {
      while (next < order.length) {
        const job = order[next++]!;
        const result = await options.runner.run(job, { signal: abort.signal, workDir });
        let file = result.file;
        if (!file) {
          if (!result.bytes) throw new Error(`runner returned nothing for ${job.id}`);
          file = path.join(workDir, `${job.id}.${options.format}`);
          await writeFile(file, result.bytes);
        }
        files.set(job.id, file);
        options.onProgress?.({ jobsDone: ++done, jobsTotal: jobs.length, phase: "render" });
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(options.runner.concurrency, jobs.length)) }, () => worker().catch((e) => (abort.abort(), Promise.reject(e)))));

    options.onProgress?.({ jobsDone: done, jobsTotal: jobs.length, phase: "join" });
    const list = path.join(workDir, "chunks.txt");
    const videoFiles = jobs.filter((j) => j.kind === "video").map((j) => files.get(j.id)!);
    await writeFile(list, videoFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    const bin = options.ffmpegPath ?? "ffmpeg";
    const args = ["-y", "-f", "concat", "-safe", "0", "-i", list];
    if (hasAudio) args.push("-i", files.get("audio")!, "-map", "0:v:0", "-map", "1:a:0");
    args.push("-c", "copy");
    if (options.format === "mp4") args.push("-movflags", "+faststart");
    args.push(options.out);
    await ffmpeg(bin, args, options.signal);
    return { filePath: path.resolve(options.out), chunks, hasAudio };
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
    if (!options.keepChunks) await rm(workDir, { recursive: true, force: true });
  }
}

// --------------------------------------------------------------------------- runners

export interface LocalRunnerOptions extends CreateExportSessionOptions {
  /** Browsers to keep warm (default 2). Each one exports one chunk at a time. */
  concurrency?: number;
}

/** Chunks on this machine, through a pool of warm export sessions (browsers start on first use). */
export function localRunner(options: LocalRunnerOptions = {}): RenderRunner {
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const idle: ExportSession[] = [];
  const all: Promise<ExportSession>[] = [];
  const waiting: ((s: ExportSession) => void)[] = [];
  const acquire = async (): Promise<ExportSession> => {
    const free = idle.pop();
    if (free) return free;
    if (all.length < concurrency) {
      const s = createExportSession(options);
      all.push(s);
      return s;
    }
    return new Promise((resolve) => waiting.push(resolve));
  };
  const release = (s: ExportSession) => {
    const w = waiting.shift();
    if (w) w(s);
    else idle.push(s);
  };
  return {
    concurrency,
    async run(job, { signal, workDir }) {
      const session = await acquire();
      try {
        const out = path.join(workDir, `${job.id}.${job.options.format}`);
        await session.exportFile(job.doc, { ...job.options, out, ...(signal ? { signal } : {}) });
        return { id: job.id, file: out };
      } finally {
        release(session);
      }
    },
    async close() {
      const sessions = await Promise.allSettled(all);
      await Promise.all(sessions.map((s) => (s.status === "fulfilled" ? s.value.close() : undefined)));
    },
  };
}

export interface HttpRunnerOptions {
  /** Worker endpoint(s) running `createRenderJobHandler` (jobs are spread round-robin). */
  endpoints: string | string[];
  /** Jobs in flight at once (default 8): scale-to-zero platforms start more instances for you. */
  concurrency?: number;
  /** Sent with every job (e.g. an auth header your workers check). */
  headers?: Record<string, string>;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  /** Retries per job on network errors and 5xx (default 2). */
  retries?: number;
}

/** Chunks on remote workers: POST each job as JSON, get the encoded file back. */
export function httpRunner(options: HttpRunnerOptions): RenderRunner {
  const endpoints = Array.isArray(options.endpoints) ? options.endpoints : [options.endpoints];
  const doFetch = options.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init));
  let turn = 0;
  return {
    concurrency: Math.max(1, options.concurrency ?? 8),
    async run(job, { signal }) {
      let lastError: unknown;
      for (let attempt = 0; attempt <= (options.retries ?? 2); attempt++) {
        const endpoint = endpoints[turn++ % endpoints.length]!;
        try {
          const res = await doFetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json", ...options.headers },
            body: JSON.stringify(job),
            ...(signal ? { signal } : {}),
          });
          if (res.ok) return { id: job.id, bytes: new Uint8Array(await res.arrayBuffer()) };
          const text = await res.text().catch(() => "");
          lastError = new Error(`worker ${endpoint} answered ${res.status} for ${job.id}: ${text.slice(0, 300)}`);
          if (res.status < 500) break; // the job itself is bad: don't retry
        } catch (err) {
          if ((err as Error)?.name === "AbortError") throw err;
          lastError = err;
        }
      }
      throw lastError;
    },
  };
}

export interface RenderJobHandlerOptions extends CreateExportSessionOptions {
  /** Reject jobs without this bearer token / header value (recommended on public URLs). */
  token?: string;
  /** Largest output frame accepted (default 3840×2160). */
  maxPixels?: number;
}

/**
 * The worker side of `httpRunner`: a Fetch-API handler that runs one job on a
 * warm export session and answers with the encoded file. Mount it in any
 * Node server (Cloud Run, a Lambda function URL with a web adapter, Fly, a
 * VM). Assets must be reachable from the worker (http(s) URLs, or files
 * under `assetsDir`).
 */
export function createRenderJobHandler(options: RenderJobHandlerOptions = {}) {
  let session: Promise<ExportSession> | undefined;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const handle = async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return json(405, { error: "POST a render job" });
    if (options.token && request.headers.get("authorization") !== `Bearer ${options.token}`) return json(401, { error: "unauthorized" });
    let job: RenderJob;
    try {
      job = (await request.json()) as RenderJob;
    } catch {
      return json(400, { error: "body must be a JSON render job" });
    }
    if (!job?.doc?.settings || !job.options?.format || !/^[\w.-]+$/.test(job.id ?? "")) return json(400, { error: "not a render job" });
    const w = job.options.width ?? job.doc.settings.width;
    const h = job.options.height ?? job.doc.settings.height;
    if (w * h > (options.maxPixels ?? 3840 * 2160)) return json(400, { error: "output frame too large" });
    session ??= createExportSession(options);
    const dir = await mkdtemp(path.join(tmpdir(), "miraiclip-job-"));
    try {
      const out = path.join(dir, `${job.id}.${job.options.format}`);
      await (await session).exportFile(job.doc, { ...job.options, out, signal: request.signal });
      const { readFile } = await import("node:fs/promises");
      const bytes = await readFile(out);
      return new Response(bytes, { status: 200, headers: { "content-type": job.options.format === "mp4" ? "video/mp4" : "video/webm" } });
    } catch (err) {
      return json(500, { error: (err as Error).message });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
  return Object.assign(handle, {
    async close() {
      if (session) await (await session).close();
    },
  });
}
