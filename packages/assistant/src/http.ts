/**
 * Keys stay on the server: run the real model adapter in your backend behind
 * `createChatHandler`, and give the browser `remoteChatModel(endpoint)` — a
 * proxy with the same `ChatModel` shape. The agent loop and the tools run in
 * the browser, next to the project; only model calls cross the network.
 *
 *   GET  {base}/       → { id, label, models, providers?, userKeys? }
 *   GET  {base}/models → { models } (live from the vendor when it can list them)
 *   POST {base}/chat   { request: ChatRequest } →
 *        application/x-ndjson, one JSON object per line:
 *        { "type": "text", "delta": "…" }   (as it streams)
 *        { "type": "done", "response": ChatResponse }
 *        { "type": "error", "error": "…", "status": 401 }
 *   errors before streaming → { error } with 400 / 401 / 403 / 404 / 413, or the vendor's status
 *
 * Bring your own key (`userKeys`): a request may carry the user's own
 * provider and key in headers (`x-ai-provider`, `x-ai-key`, optionally
 * `x-ai-base-url`). The handler builds a model for that one request and
 * forgets the key — it's never stored or logged. Use it for plans where
 * customers pay their AI vendor directly.
 *
 * Fetch-API handler (`Request` → `Response`): mounts in Node 18+, edge
 * runtimes, Next, Hono, Express (via an adapter).
 */
import { AI_PROVIDERS, aiProvider, createChatModel, splitModelRef, type AiProviderInfo, type CreateChatModelOptions } from "./providers.js";
import { ChatModelError, defaultFetch, type ChatModel, type ChatRequest, type ChatResponse, type FetchLike, type ModelEntry } from "./types.js";

/** Header names a request uses to bring the user's own key. */
export const USER_KEY_HEADERS = { provider: "x-ai-provider", key: "x-ai-key", baseUrl: "x-ai-base-url" } as const;

/** The user's own provider settings, as the browser sends them. */
export interface UserCredentials {
  provider: string;
  apiKey?: string;
  /** Only honored when the server allows it (`userKeys.allowBaseUrl`). */
  baseUrl?: string;
}

export interface UserKeyOptions {
  /** Providers users may bring a key for (default: every hosted provider in the catalog). */
  providers?: string[];
  /**
   * Let users send their own API root (OpenAI-compatible servers, gateways).
   * Off by default: your server would call whatever URL a user sends.
   */
  allowBaseUrl?: boolean;
  /** Refuse requests without the user's own key, even when the server has a model. */
  required?: boolean;
  /** Build the model for a user's key (default `createChatModel`): add headers, pin params, wrap with limits. */
  create?: (options: CreateChatModelOptions, request: Request) => ChatModel;
  fetch?: FetchLike;
}

export interface ChatHandlerOptions {
  /** Path prefix the handler is mounted at, e.g. "/api/assistant". */
  basePath?: string;
  /** Reject request bodies larger than this (default 2 MB). */
  maxBodyBytes?: number;
  /** Return a Response to refuse a request (auth, rate limits, plan checks); undefined to allow. */
  authorize?: (request: Request) => Promise<Response | undefined> | Response | undefined;
  /** Adjust each request server-side (pin a model, cap tokens, add instructions). */
  prepare?: (request: ChatRequest) => ChatRequest;
  /** Accept the user's own provider key per request (see the module note). Off by default. */
  userKeys?: boolean | UserKeyOptions;
}

/** What `GET {base}/` tells the browser about bring-your-own-key. */
export interface UserKeyInfo {
  providers: Pick<AiProviderInfo, "id" | "label" | "needsKey" | "keyUrl" | "defaultModel" | "models">[];
  allowBaseUrl: boolean;
  required: boolean;
}

const hostedProviders = () => AI_PROVIDERS.filter((p) => !p.local && p.baseUrl).map((p) => p.id);

/**
 * @param model The server's own model (its keys, from env or config), or
 *   `null` when every user brings their own key (`userKeys` must be on).
 */
export function createChatHandler(model: ChatModel | null, options: ChatHandlerOptions = {}) {
  const base = (options.basePath ?? "").replace(/\/+$/, "");
  const maxBody = options.maxBodyBytes ?? 2_000_000;
  const byok: UserKeyOptions | null = options.userKeys ? (options.userKeys === true ? {} : options.userKeys) : null;
  if (!model && !byok) throw new Error("createChatHandler needs a model, or userKeys so users can bring their own");
  const allowed = new Set(byok?.providers ?? hostedProviders());
  if (byok?.allowBaseUrl) allowed.add("openai-compatible");
  const userKeyInfo: UserKeyInfo | undefined = byok
    ? {
        providers: [...allowed].flatMap((id) => {
          const p = aiProvider(id);
          return p ? [{ id: p.id, label: p.label, needsKey: p.needsKey, ...(p.keyUrl ? { keyUrl: p.keyUrl } : {}), ...(p.defaultModel ? { defaultModel: p.defaultModel } : {}), ...(p.models ? { models: p.models } : {}) }] : [];
        }),
        allowBaseUrl: !!byok.allowBaseUrl,
        required: !!byok.required,
      }
    : undefined;

  /** The user's model for this request, null when they sent no key, or a Response refusing it. */
  const userModel = (request: Request, modelRef: string | undefined): ChatModel | Response | null => {
    if (!byok) return null;
    const provider = request.headers.get(USER_KEY_HEADERS.provider)?.trim();
    if (!provider) return null;
    if (!allowed.has(provider)) return json(403, { error: `bringing your own key isn't enabled for "${provider}" here` });
    const apiKey = request.headers.get(USER_KEY_HEADERS.key)?.trim() || undefined;
    const baseUrl = request.headers.get(USER_KEY_HEADERS.baseUrl)?.trim() || undefined;
    if (baseUrl && !byok.allowBaseUrl) return json(403, { error: "custom API addresses aren't allowed here" });
    const ref = modelRef ? splitModelRef(modelRef, [provider]) : undefined;
    const config: CreateChatModelOptions = {
      provider,
      ...(apiKey ? { apiKey } : {}),
      // Listing models needs no model; the catalog default (or a placeholder) is fine.
      model: ref?.model || aiProvider(provider)?.defaultModel || "default",
      ...(baseUrl ? { baseUrl } : {}),
      ...(byok.fetch ? { fetch: byok.fetch } : {}),
    };
    try {
      return byok.create ? byok.create(config, request) : createChatModel(config);
    } catch (err) {
      const status = err instanceof ChatModelError && err.status ? err.status : 400;
      return json(status, { error: (err as Error).message });
    }
  };

  const noModel = () => json(401, { error: "Add your own API key to use AI here.", needsKey: true });

  return async function handle(request: Request): Promise<Response | null> {
    const path = new URL(request.url).pathname;
    if (base && path !== base && !path.startsWith(`${base}/`)) return null;
    const rest = path.slice(base.length).replace(/\/+$/, "");

    const refused = await options.authorize?.(request);
    if (refused) return refused;

    if (rest === "" && request.method === "GET") {
      return json(200, {
        id: model?.id ?? "byok",
        label: model?.label ?? "Your API key",
        models: model?.models ?? [],
        ...(model?.providers ? { providers: model.providers } : {}),
        ...(userKeyInfo ? { userKeys: userKeyInfo } : {}),
        ...(!model || byok?.required ? { needsKey: true } : {}),
      });
    }

    if (rest === "/models" && request.method === "GET") {
      const mine = userModel(request, undefined);
      if (mine instanceof Response) return mine;
      const target = mine ?? (byok?.required ? null : model);
      if (!target) return noModel();
      try {
        const models: ModelEntry[] = target.listModels ? await target.listModels({ signal: request.signal }) : (target.models ?? []);
        return json(200, { models });
      } catch (err) {
        const status = (err as { status?: number })?.status;
        return json(status && status >= 400 && status < 600 ? status : 502, { error: (err as Error)?.message ?? String(err) });
      }
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

    const mine = userModel(request, chat.model);
    if (mine instanceof Response) return mine;
    const target = mine ?? (byok?.required ? null : model);
    if (!target) return noModel();
    if (mine && chat.model) chat = { ...chat, model: splitModelRef(chat.model, [request.headers.get(USER_KEY_HEADERS.provider)!.trim(), mine.id]).model };

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (value: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
        try {
          const response = await target.complete(chat, { signal: request.signal, onText: (delta) => send({ type: "text", delta }) });
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

/** What the server said about itself (`GET {base}/`). */
export interface RemoteModelInfo {
  id: string;
  label: string;
  models?: ModelEntry[];
  providers?: { id: string; label: string }[];
  userKeys?: UserKeyInfo;
  /** The server has no model of its own (or requires user keys): calls need the user's key. */
  needsKey?: boolean;
}

export interface RemoteChatModelOptions {
  fetch?: FetchLike;
  headers?: Record<string, string>;
  /** Skip the GET for model info (id/label/models default to "remote"). */
  info?: RemoteModelInfo;
  /**
   * The user's own provider key, read on every call (so a settings change
   * applies at once). Return nothing to use the server's model.
   */
  credentials?: () => UserCredentials | null | undefined;
}

/** Headers carrying the user's own key, for any request to a `createChatHandler` server. */
export function userKeyHeaders(credentials: UserCredentials | null | undefined): Record<string, string> {
  if (!credentials?.provider) return {};
  return {
    [USER_KEY_HEADERS.provider]: credentials.provider,
    ...(credentials.apiKey ? { [USER_KEY_HEADERS.key]: credentials.apiKey } : {}),
    ...(credentials.baseUrl ? { [USER_KEY_HEADERS.baseUrl]: credentials.baseUrl } : {}),
  };
}

/** The model a backend serves, as a browser-side `ChatModel` (plus what the server said about itself in `info`). */
export async function remoteChatModel(endpoint: string, options: RemoteChatModelOptions = {}): Promise<ChatModel & { info: RemoteModelInfo }> {
  const doFetch = options.fetch ?? defaultFetch();
  const root = endpoint.replace(/\/+$/, "");
  let info = options.info;
  if (!info) {
    const res = await doFetch(`${root}/`, { headers: { Accept: "application/json", ...options.headers } });
    if (!res.ok) throw new ChatModelError("remote", `HTTP ${res.status}`, res.status);
    info = (await res.json()) as RemoteModelInfo;
  }
  const { id, label, models, providers } = info;
  const headers = (extra: Record<string, string>) => ({ ...extra, ...options.headers, ...userKeyHeaders(options.credentials?.()) });

  return {
    id,
    label,
    info,
    ...(models ? { models } : {}),
    ...(providers ? { providers } : {}),
    async listModels(opts = {}) {
      const res = await doFetch(`${root}/models`, { headers: headers({ Accept: "application/json" }), ...(opts.signal ? { signal: opts.signal } : {}) });
      const body = (await res.json().catch(() => null)) as { models?: ModelEntry[]; error?: string } | null;
      if (!res.ok) throw new ChatModelError(id, body?.error ?? `HTTP ${res.status}`, res.status);
      return body?.models ?? [];
    },
    async complete(request, opts = {}): Promise<ChatResponse> {
      const res = await doFetch(`${root}/chat`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json", Accept: "application/x-ndjson" }),
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
