/**
 * Keys stay on the server: run the real model adapter in your backend behind
 * `createChatHandler`, and give the browser `remoteChatModel(endpoint)` — a
 * proxy with the same `ChatModel` shape. The agent loop and the tools run in
 * the browser, next to the project; only model calls cross the network.
 *
 *   GET  {base}/       → { id, label, models }
 *   POST {base}/chat   { request: ChatRequest } →
 *        application/x-ndjson, one JSON object per line:
 *        { "type": "text", "delta": "…" }   (as it streams)
 *        { "type": "done", "response": ChatResponse }
 *        { "type": "error", "error": "…", "status": 401 }
 *   errors before streaming → { error } with 400 / 404 / 413, or the vendor's status
 *
 * Fetch-API handler (`Request` → `Response`): mounts in Node 18+, edge
 * runtimes, Next, Hono, Express (via an adapter).
 */
import { ChatModelError, defaultFetch, type ChatModel, type ChatRequest, type ChatResponse, type FetchLike } from "./types.js";

export interface ChatHandlerOptions {
  /** Path prefix the handler is mounted at, e.g. "/api/assistant". */
  basePath?: string;
  /** Reject request bodies larger than this (default 2 MB). */
  maxBodyBytes?: number;
  /** Return a Response to refuse a request (auth, rate limits); undefined to allow. */
  authorize?: (request: Request) => Promise<Response | undefined> | Response | undefined;
  /** Adjust each request server-side (pin a model, cap tokens, add instructions). */
  prepare?: (request: ChatRequest) => ChatRequest;
}

export function createChatHandler(model: ChatModel, options: ChatHandlerOptions = {}) {
  const base = (options.basePath ?? "").replace(/\/+$/, "");
  const maxBody = options.maxBodyBytes ?? 2_000_000;

  return async function handle(request: Request): Promise<Response | null> {
    const path = new URL(request.url).pathname;
    if (base && path !== base && !path.startsWith(`${base}/`)) return null;
    const rest = path.slice(base.length).replace(/\/+$/, "");

    const refused = await options.authorize?.(request);
    if (refused) return refused;

    if (rest === "" && request.method === "GET") {
      return json(200, { id: model.id, label: model.label, models: model.models ?? [] });
    }
    if (rest !== "/chat" || request.method !== "POST") return json(404, { error: "not found" });

    const text = await request.text();
    if (text.length > maxBody) return json(413, { error: "request too large" });
    let chat: ChatRequest;
    try {
      chat = (JSON.parse(text) as { request: ChatRequest }).request;
    } catch {
      return json(400, { error: "body must be JSON { request }" });
    }
    if (!chat || !Array.isArray(chat.messages)) return json(400, { error: "request.messages is required" });
    if (options.prepare) chat = options.prepare(chat);

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (value: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
        try {
          const response = await model.complete(chat, { signal: request.signal, onText: (delta) => send({ type: "text", delta }) });
          send({ type: "done", response });
        } catch (err) {
          const status = (err as { status?: number })?.status;
          send({ type: "error", error: (err as Error)?.message ?? String(err), ...(status ? { status } : {}) });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
  };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export interface RemoteChatModelOptions {
  fetch?: FetchLike;
  headers?: Record<string, string>;
  /** Skip the GET for model info (id/label/models default to "remote"). */
  info?: { id: string; label: string; models?: { id: string; label?: string }[] };
}

/** The model a backend serves, as a browser-side `ChatModel`. */
export async function remoteChatModel(endpoint: string, options: RemoteChatModelOptions = {}): Promise<ChatModel> {
  const doFetch = options.fetch ?? defaultFetch();
  const root = endpoint.replace(/\/+$/, "");
  let info = options.info;
  if (!info) {
    const res = await doFetch(`${root}/`, { headers: { Accept: "application/json", ...options.headers } });
    if (!res.ok) throw new ChatModelError("remote", `HTTP ${res.status}`, res.status);
    info = (await res.json()) as NonNullable<RemoteChatModelOptions["info"]>;
  }
  const { id, label, models } = info;

  return {
    id,
    label,
    ...(models ? { models } : {}),
    async complete(request, opts = {}): Promise<ChatResponse> {
      const res = await doFetch(`${root}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", ...options.headers },
        body: JSON.stringify({ request }),
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new ChatModelError(id, err?.error ?? `HTTP ${res.status}`, res.status);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: ChatResponse | undefined;
      const handle = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as { type: string; delta?: string; response?: ChatResponse; error?: string; status?: number };
        if (event.type === "text" && event.delta) opts.onText?.(event.delta);
        else if (event.type === "done") final = event.response;
        else if (event.type === "error") throw new ChatModelError(id, event.error ?? "failed", event.status);
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          handle(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
        if (done) break;
      }
      handle(buffer);
      if (!final) throw new ChatModelError(id, "the server closed the stream without a response");
      return final;
    },
  };
}
