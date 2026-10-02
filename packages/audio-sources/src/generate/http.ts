/**
 * Keys stay on the server: run real generators in your backend behind
 * `createGeneratorHandler`, and give the browser `remoteGenerators(endpoint)`
 * — proxies with the same `AudioGenerator` shape. Switching vendors is then a
 * backend change; the UI and AI tools don't move.
 *
 *   GET  {base}/                → { generators: GeneratorInfo[] }
 *   GET  {base}/{id}/voices     → { voices: GeneratorVoice[] }
 *   POST {base}/{id}/generate   { request, options: { model?, seed?, format?, params? } }
 *                               → audio bytes; headers x-generation-id, x-model,
 *                                 x-duration-us, x-license (JSON), x-attribution
 *   errors                      → { error } with 400 (bad request), 404, or the
 *                                 vendor's status (401/402/429…), else 502
 *
 * The handler speaks the Fetch API (`Request` → `Response`), so it mounts in
 * Node 18+ servers, edge runtimes, Next/Hono/Express (via an adapter) alike.
 */
import { AudioSourceError, defaultFetch, joinUrl } from "../common.js";
import type { FetchLike } from "../types.js";
import { describeGenerator, validateRequest } from "./run.js";
import type { AudioGenerator, GenerateOptions, GenerateRequest, GeneratedAudio, GeneratorInfo, GeneratorVoice } from "./types.js";

export interface GeneratorHandlerOptions {
  /** Path prefix the handler is mounted at, e.g. "/api/generate". */
  basePath?: string;
}

/** Returns a Fetch-API handler; resolves `null` for paths it doesn't own. */
export function createGeneratorHandler(generators: AudioGenerator[], options: GeneratorHandlerOptions = {}) {
  const base = (options.basePath ?? "").replace(/\/+$/, "");
  const byId = new Map(generators.map((g) => [g.id, g]));

  return async function handle(request: Request): Promise<Response | null> {
    const path = new URL(request.url).pathname;
    if (base && path !== base && !path.startsWith(`${base}/`)) return null;
    const parts = path.slice(base.length).split("/").filter(Boolean);

    if (parts.length === 0 && request.method === "GET") {
      return json(200, { generators: generators.map(describeGenerator) });
    }
    const generator = parts[0] ? byId.get(decodeURIComponent(parts[0])) : undefined;
    if (!generator) return json(404, { error: "unknown generator" });

    if (parts[1] === "voices" && request.method === "GET") {
      if (!generator.voices) return json(404, { error: "this generator has no voices" });
      try {
        return json(200, { voices: await generator.voices({ signal: request.signal }) });
      } catch (err) {
        return failure(err);
      }
    }

    if (parts[1] === "generate" && request.method === "POST") {
      let body: { request?: GenerateRequest; options?: Pick<GenerateOptions, "model" | "seed" | "format" | "params"> };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json(400, { error: "body must be JSON { request, options }" });
      }
      const genRequest = body.request;
      if (!genRequest || typeof genRequest !== "object") return json(400, { error: "request is required" });
      const invalid = validateRequest(generator, genRequest);
      if (invalid) return json(400, { error: invalid });
      try {
        const { model, seed, format, params } = body.options ?? {};
        const out = await generator.generate(genRequest, {
          signal: request.signal,
          ...(model ? { model } : {}),
          ...(seed !== undefined ? { seed } : {}),
          ...(format ? { format } : {}),
          ...(params ? { params } : {}),
        });
        return await audioResponse(out);
      } catch (err) {
        return failure(err);
      }
    }
    return json(404, { error: "not found" });
  };
}

async function audioResponse(out: GeneratedAudio): Promise<Response> {
  const data = isUrl(out.data) ? await (await fetch(out.data.url)).arrayBuffer() : out.data;
  const headers: Record<string, string> = { "content-type": out.mimeType, "cache-control": "no-store" };
  if (out.id) headers["x-generation-id"] = out.id;
  if (out.model) headers["x-model"] = out.model;
  if (out.durationUs) headers["x-duration-us"] = String(out.durationUs);
  if (out.license) headers["x-license"] = JSON.stringify(out.license);
  if (out.attribution) headers["x-attribution"] = encodeURIComponent(out.attribution);
  return new Response(data as BodyInit, { status: 200, headers });
}

function failure(err: unknown): Response {
  if ((err as Error)?.name === "AbortError") return json(499, { error: "canceled" });
  const status = (err as { status?: number })?.status;
  const passthrough = status && status >= 400 && status < 500 ? status : 502;
  return json(passthrough, { error: (err as Error)?.message ?? String(err) });
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const isUrl = (d: GeneratedAudio["data"]): d is { url: string } =>
  typeof d === "object" && d !== null && !(d instanceof Blob) && !(d instanceof ArrayBuffer) && !ArrayBuffer.isView(d) && "url" in d;

export interface RemoteGeneratorsOptions {
  fetch?: FetchLike;
  headers?: Record<string, string>;
}

/** The generators a backend serves, as browser-side `AudioGenerator`s. */
export async function remoteGenerators(endpoint: string, options: RemoteGeneratorsOptions = {}): Promise<AudioGenerator[]> {
  const doFetch = options.fetch ?? defaultFetch();
  const res = await doFetch(joinUrl(endpoint, "/"), { headers: { Accept: "application/json", ...options.headers } });
  if (!res.ok) throw new AudioSourceError("generators", `HTTP ${res.status}`, res.status);
  const { generators } = (await res.json()) as { generators: GeneratorInfo[] };
  return generators.map((info) => remoteGenerator(endpoint, info, options));
}

/** One remote generator from its advertised info. */
export function remoteGenerator(endpoint: string, info: GeneratorInfo, options: RemoteGeneratorsOptions = {}): AudioGenerator {
  const doFetch = options.fetch ?? defaultFetch();
  const root = joinUrl(endpoint, `/${encodeURIComponent(info.id)}`);
  const fail = async (res: Response) => {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return new AudioSourceError(info.id, body?.error ?? `HTTP ${res.status}`, res.status);
  };
  const { hasVoices, ...rest } = info;
  const generator: AudioGenerator = {
    ...rest,
    async generate(request, opts) {
      opts.onProgress?.({ message: `Generating with ${info.label}…` });
      const res = await doFetch(`${root}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...options.headers },
        body: JSON.stringify({
          request,
          options: {
            ...(opts.model ? { model: opts.model } : {}),
            ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
            ...(opts.format ? { format: opts.format } : {}),
            ...(opts.params ? { params: opts.params } : {}),
          },
        }),
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
      if (!res.ok) throw await fail(res);
      const out: GeneratedAudio = {
        data: await res.arrayBuffer(),
        mimeType: res.headers.get("content-type")?.split(";")[0] ?? "audio/mpeg",
      };
      const id = res.headers.get("x-generation-id");
      const model = res.headers.get("x-model");
      const duration = Number(res.headers.get("x-duration-us"));
      const license = res.headers.get("x-license");
      const attribution = res.headers.get("x-attribution");
      if (id) out.id = id;
      if (model) out.model = model;
      if (duration > 0) out.durationUs = duration;
      if (license) out.license = JSON.parse(license);
      if (attribution) out.attribution = decodeURIComponent(attribution);
      return out;
    },
  };
  if (hasVoices) {
    generator.voices = async (opts) => {
      const res = await doFetch(`${root}/voices`, { headers: { Accept: "application/json", ...options.headers }, ...(opts?.signal ? { signal: opts.signal } : {}) });
      if (!res.ok) throw await fail(res);
      return ((await res.json()) as { voices: GeneratorVoice[] }).voices;
    };
  }
  return generator;
}
