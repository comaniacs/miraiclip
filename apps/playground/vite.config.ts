import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { defineConfig, loadEnv, type Connect, type Plugin } from "vite";
// Relative source imports (bundled into the config): these modules only use
// fetch + type imports, so they run in Node without building the package.
import { createGeneratorHandler } from "../../packages/audio-sources/src/generate/http";
import { elevenLabsGenerator } from "../../packages/audio-sources/src/generate/elevenlabs";
import { toneGenerator } from "../../packages/audio-sources/src/generate/tone";
import type { AudioGenerator } from "../../packages/audio-sources/src/generate/types";
import { createChatHandler } from "../../packages/assistant/src/http";
import { openAIChatModel } from "../../packages/assistant/src/openai";

/**
 * Audio-sources testing helpers (dev + preview):
 * - /api/openverse → https://api.openverse.org (search without CORS concerns);
 * - GET /api/fetch?url=https://… streams a remote media file same-origin,
 *   forwarding Range, so library results decode without the host's CORS.
 *   Public https hosts only — a local test aid, not a production proxy.
 */
function remoteFetch(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith("/api/fetch?")) return next();
    void proxy(req, res);
  };
  return {
    name: "playground-remote-fetch",
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

async function proxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const target = new URL(req.url!, "http://local").searchParams.get("url") ?? "";
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    res.statusCode = 400;
    return void res.end("bad url");
  }
  if (url.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) {
    res.statusCode = 400;
    return void res.end("public https only");
  }
  try {
    const upstream = await fetch(url, { headers: req.headers.range ? { range: String(req.headers.range) } : {}, redirect: "follow" });
    res.statusCode = upstream.status;
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    if (!upstream.body || req.method === "HEAD") return void res.end();
    Readable.fromWeb(upstream.body as never).pipe(res);
  } catch {
    res.statusCode = 502;
    res.end("upstream failed");
  }
}

/**
 * AI generation on the dev/preview server: /api/generate/* runs the real
 * adapters here, so keys never reach the browser. Offline test tones are
 * always on; ElevenLabs joins when ELEVENLABS_API_KEY is set (shell or
 * .env.local; ELEVENLABS_PLAN=paid records commercial terms).
 */
function generation(env: Record<string, string | undefined>): Plugin {
  const generators: AudioGenerator[] = [toneGenerator({ latencyMs: 600 })];
  if (env.ELEVENLABS_API_KEY) {
    generators.unshift(elevenLabsGenerator({ apiKey: env.ELEVENLABS_API_KEY, plan: env.ELEVENLABS_PLAN === "paid" ? "paid" : "free" }));
  }
  const handle = createGeneratorHandler(generators, { basePath: "/api/generate" });
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith("/api/generate")) return next();
    void (async () => {
      const controller = new AbortController();
      res.on("close", () => controller.abort());
      const hasBody = req.method !== "GET" && req.method !== "HEAD";
      const request = new Request(new URL(req.url!, "http://localhost"), {
        method: req.method,
        headers: req.headers as Record<string, string>,
        signal: controller.signal,
        ...(hasBody ? { body: Readable.toWeb(req) as never, duplex: "half" } : {}),
      } as RequestInit);
      const response = await handle(request);
      if (!response) return next();
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    })().catch((err) => {
      res.statusCode = 500;
      res.end(String(err));
    });
  };
  return {
    name: "playground-generation",
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

/**
 * The assistant's model on the dev/preview server: /api/assistant/* runs
 * OpenAI here when OPENAI_API_KEY is set (OPENAI_MODEL, default gpt-5.4-mini;
 * OPENAI_BASE_URL for any OpenAI-compatible server). Without a key the route
 * isn't mounted and the page falls back to its offline scripted model.
 * Responses stream (NDJSON) straight through.
 */
function assistant(env: Record<string, string | undefined>): Plugin {
  const key = env.OPENAI_API_KEY;
  const handle =
    key || env.OPENAI_BASE_URL
      ? createChatHandler(
          openAIChatModel({
            ...(key ? { apiKey: key } : {}),
            model: env.OPENAI_MODEL || "gpt-5.4-mini",
            ...(env.OPENAI_BASE_URL ? { baseUrl: env.OPENAI_BASE_URL } : {}),
          }),
          { basePath: "/api/assistant" },
        )
      : null;
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (!handle || !req.url?.startsWith("/api/assistant")) return next();
    void (async () => {
      const controller = new AbortController();
      res.on("close", () => controller.abort());
      const hasBody = req.method !== "GET" && req.method !== "HEAD";
      const request = new Request(new URL(req.url!, "http://localhost"), {
        method: req.method,
        headers: req.headers as Record<string, string>,
        signal: controller.signal,
        ...(hasBody ? { body: Readable.toWeb(req) as never, duplex: "half" } : {}),
      } as RequestInit);
      const response = await handle(request);
      if (!response) return next();
      res.statusCode = response.status;
      response.headers.forEach((value, k) => res.setHeader(k, value));
      if (!response.body) return void res.end();
      Readable.fromWeb(response.body as never).pipe(res);
    })().catch((err) => {
      res.statusCode = 500;
      res.end(String(err));
    });
  };
  return {
    name: "playground-assistant",
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

const apiProxy = {
  "/api/openverse": {
    target: "https://api.openverse.org",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/openverse/, ""),
  },
};

// Workspace packages resolve to their TypeScript source via their dev
// `exports` (see each package.json; publishConfig swaps in dist on publish),
// so no aliases are needed and edits in packages/* hot-reload directly.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
  plugins: [remoteFetch(), generation(env), assistant(env)],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  worker: {
    // The export worker bundles pixi + the renderer; ES format keeps
    // code-splitting legal inside the worker build (iife forbids it).
    format: "es",
  },
  };
});
