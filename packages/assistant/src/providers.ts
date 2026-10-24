/**
 * Every model provider the assistant can talk to, behind one factory.
 *
 * Three wire formats cover them all: OpenAI Chat Completions (OpenAI and the
 * many servers that copy it: OpenRouter, Groq, Mistral, DeepSeek, xAI,
 * Together, Ollama, LM Studio, your own), Anthropic Messages and Google
 * Gemini. `createChatModel({ provider, apiKey, model })` picks the adapter;
 * `chatModelsFromEnv` builds one for each provider whose key is set;
 * `routedChatModel` serves several behind one model, addressed as
 * "provider/model".
 */
import { anthropicChatModel } from "./anthropic.js";
import { geminiChatModel } from "./gemini.js";
import { openAIChatModel } from "./openai.js";
import { ChatModelError, defineChatModel, type ChatModel, type FetchLike, type ModelEntry } from "./types.js";

export type ProviderApi = "openai" | "anthropic" | "gemini";

export interface AiProviderInfo {
  /** Id used in configs, env names and "provider/model" references. */
  id: string;
  label: string;
  /** Which wire format it speaks. */
  api: ProviderApi;
  /** API root; `openai-compatible` has none (you give it). */
  baseUrl?: string;
  /** Whether calls need an API key (local servers don't). */
  needsKey: boolean;
  /** Runs on the user's machine (Ollama, LM Studio): reachable from that machine only. */
  local?: boolean;
  /** Where a user creates a key. */
  keyUrl?: string;
  /** Env var prefix: `{PREFIX}_API_KEY`, `{PREFIX}_MODEL`, `{PREFIX}_BASE_URL`, `{PREFIX}_MODELS`. */
  env: string;
  /** Used when no model is named. Providers without one need a model picked (env or UI). */
  defaultModel?: string;
  /** A few good picks to show before the live list loads. */
  models?: ModelEntry[];
  /** Accepts calls straight from a browser (CORS) with the user's own key. */
  browser?: boolean;
  /** OpenAI-format servers: the output-cap field and whether `stream_options` is accepted. */
  maxTokensField?: "max_completion_tokens" | "max_tokens";
  streamUsage?: boolean;
}

/**
 * The built-in provider catalog. Model ids are suggestions as of release; the
 * live list comes from each provider (`ChatModel.listModels`).
 */
export const AI_PROVIDERS: readonly AiProviderInfo[] = [
  {
    id: "openai",
    label: "OpenAI",
    api: "openai",
    baseUrl: "https://api.openai.com/v1",
    needsKey: true,
    keyUrl: "https://platform.openai.com/api-keys",
    env: "OPENAI",
    defaultModel: "gpt-5.4-mini",
    models: [{ id: "gpt-5.4-mini" }, { id: "gpt-6-luna" }, { id: "gpt-6.1-sol" }],
    browser: true,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    api: "anthropic",
    baseUrl: "https://api.anthropic.com",
    needsKey: true,
    keyUrl: "https://console.anthropic.com/settings/keys",
    env: "ANTHROPIC",
    defaultModel: "claude-sonnet-5-5",
    models: [
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
    ],
    browser: true,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    api: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    needsKey: true,
    keyUrl: "https://aistudio.google.com/apikey",
    env: "GEMINI",
    defaultModel: "gemini-3.8-flash",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)" },
    ],
    browser: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    api: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
    keyUrl: "https://openrouter.ai/keys",
    env: "OPENROUTER",
    defaultModel: "openrouter/auto",
    models: [{ id: "openrouter/auto", label: "Auto (OpenRouter picks)" }],
    browser: true,
    maxTokensField: "max_tokens",
  },
  { id: "groq", label: "Groq", api: "openai", baseUrl: "https://api.groq.com/openai/v1", needsKey: true, keyUrl: "https://console.groq.com/keys", env: "GROQ", maxTokensField: "max_tokens" },
  {
    id: "mistral",
    label: "Mistral",
    api: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    needsKey: true,
    keyUrl: "https://console.mistral.ai/api-keys",
    env: "MISTRAL",
    defaultModel: "mistral-medium-latest",
    maxTokensField: "max_tokens",
    streamUsage: false,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    api: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    needsKey: true,
    keyUrl: "https://platform.deepseek.com/api_keys",
    env: "DEEPSEEK",
    defaultModel: "deepseek-chat",
    maxTokensField: "max_tokens",
  },
  { id: "xai", label: "xAI", api: "openai", baseUrl: "https://api.x.ai/v1", needsKey: true, keyUrl: "https://console.x.ai", env: "XAI", maxTokensField: "max_tokens" },
  {
    id: "together",
    label: "Together AI",
    api: "openai",
    baseUrl: "https://api.together.xyz/v1",
    needsKey: true,
    keyUrl: "https://api.together.ai/settings/api-keys",
    env: "TOGETHER",
    maxTokensField: "max_tokens",
  },
  { id: "ollama", label: "Ollama (local)", api: "openai", baseUrl: "http://localhost:11434/v1", needsKey: false, local: true, env: "OLLAMA", maxTokensField: "max_tokens" },
  { id: "lmstudio", label: "LM Studio (local)", api: "openai", baseUrl: "http://localhost:1234/v1", needsKey: false, local: true, env: "LMSTUDIO", maxTokensField: "max_tokens" },
  { id: "openai-compatible", label: "OpenAI-compatible", api: "openai", needsKey: false, env: "OPENAI_COMPATIBLE", maxTokensField: "max_tokens" },
];

/** A provider from the catalog, or undefined. */
export function aiProvider(id: string): AiProviderInfo | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

export interface CreateChatModelOptions {
  /** A catalog id (`AI_PROVIDERS`): "openai", "anthropic", "gemini", "openrouter", "ollama", "openai-compatible", … */
  provider: string;
  apiKey?: string | undefined;
  /** Model id (default: the provider's `defaultModel`; required for providers without one). */
  model?: string | undefined;
  /** Other models to offer (default: the catalog's suggestions). */
  models?: ModelEntry[];
  /** Override the API root (required for "openai-compatible"). */
  baseUrl?: string | undefined;
  headers?: Record<string, string>;
  /** Default request fields for every call (vendor-specific). */
  params?: Record<string, unknown>;
  stream?: boolean;
  maxRetries?: number;
  /** Calling from the browser with the user's own key (sets what the vendor needs for CORS). */
  browser?: boolean;
  /** Adapter id / label (default: the provider's). */
  id?: string;
  label?: string;
  fetch?: FetchLike;
}

/** One `ChatModel` for any provider in the catalog. */
export function createChatModel(options: CreateChatModelOptions): ChatModel {
  const info = aiProvider(options.provider);
  if (!info) throw new Error(`Unknown AI provider "${options.provider}". Known: ${AI_PROVIDERS.map((p) => p.id).join(", ")}`);
  const model = options.model || info.defaultModel;
  if (!model) throw new ChatModelError(info.id, `pick a model (${info.label} has no default; set ${info.env}_MODEL or choose one)`, 400);
  if (info.needsKey && !options.apiKey) throw new ChatModelError(info.id, `needs an API key${info.keyUrl ? ` (create one at ${info.keyUrl})` : ""}`, 401);
  const baseUrl = options.baseUrl || info.baseUrl;
  if (!baseUrl) throw new ChatModelError(info.id, "needs a base URL (the server's /v1 address)", 400);

  const common = {
    model,
    models: options.models ?? info.models ?? [],
    baseUrl,
    id: options.id ?? info.id,
    label: options.label ?? info.label,
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    ...(options.headers ? { headers: options.headers } : {}),
    ...(options.params ? { params: options.params } : {}),
    ...(options.stream !== undefined ? { stream: options.stream } : {}),
    ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  };
  switch (info.api) {
    case "anthropic":
      return anthropicChatModel({ ...common, ...(options.browser ? { browser: true } : {}) });
    case "gemini":
      return geminiChatModel(common);
    case "openai":
      return openAIChatModel({
        ...common,
        ...(info.maxTokensField ? { maxTokensField: info.maxTokensField } : {}),
        ...(info.streamUsage !== undefined ? { streamUsage: info.streamUsage } : {}),
      });
  }
}

export interface ChatModelsFromEnvOptions {
  /** Only these providers (default: all). */
  providers?: string[];
  /** Told about providers that have a key but couldn't be set up (e.g. no model). */
  onSkip?: (provider: string, reason: string) => void;
  fetch?: FetchLike;
}

/**
 * A model for every provider configured in `env` (`process.env`, Vite's
 * `loadEnv`, a Worker's bindings):
 *
 *   {PREFIX}_API_KEY   enables a hosted provider (GEMINI also reads GOOGLE_API_KEY)
 *   {PREFIX}_MODEL     its default model (required where the catalog has none)
 *   {PREFIX}_MODELS    more models to offer, comma-separated
 *   {PREFIX}_BASE_URL  another API root (a proxy, a gateway, a regional endpoint)
 *
 * Local servers (OLLAMA, LMSTUDIO) are enabled by their _MODEL or _BASE_URL.
 * OPENAI_BASE_URL alone keeps its old meaning: an OpenAI-compatible server
 * (label OPENAI_LABEL), key optional. Order follows the catalog, so the
 * first entry makes a sensible default.
 */
export function chatModelsFromEnv(env: Record<string, string | undefined>, options: ChatModelsFromEnvOptions = {}): ChatModel[] {
  const out: ChatModel[] = [];
  const wanted = options.providers ? new Set(options.providers) : null;
  for (const info of AI_PROVIDERS) {
    if (wanted && !wanted.has(info.id)) continue;
    const p = info.env;
    let apiKey = env[`${p}_API_KEY`] || (info.id === "gemini" ? env.GOOGLE_API_KEY : undefined);
    let baseUrl = env[`${p}_BASE_URL`];
    let label: string | undefined;
    if (info.id === "openai" && env.OPENAI_BASE_URL) continue; // served as openai-compatible below
    if (info.id === "openai-compatible" && !baseUrl && env.OPENAI_BASE_URL) {
      baseUrl = env.OPENAI_BASE_URL;
      apiKey ||= env.OPENAI_API_KEY;
      label = env.OPENAI_LABEL || undefined;
    }
    const model = env[`${p}_MODEL`] || (info.id === "openai-compatible" ? env.OPENAI_MODEL : undefined);
    const enabled = info.needsKey ? !!apiKey : info.local ? !!(model || baseUrl) : !!baseUrl;
    if (!enabled) continue;
    const models = (env[`${p}_MODELS`] || (info.id === "openai-compatible" && env.OPENAI_BASE_URL ? env.OPENAI_MODELS : "") || "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .map((m) => ({ id: m }));
    try {
      out.push(
        createChatModel({
          provider: info.id,
          ...(apiKey ? { apiKey } : {}),
          ...(model ? { model } : {}),
          ...(models.length ? { models } : {}),
          ...(baseUrl ? { baseUrl } : {}),
          ...(label ? { label } : {}),
          ...(options.fetch ? { fetch: options.fetch } : {}),
        }),
      );
    } catch (err) {
      options.onSkip?.(info.id, (err as Error).message);
    }
  }
  return out;
}

/** "anthropic/claude-sonnet-5-5" → { provider: "anthropic", model: "claude-sonnet-5-5" } when the prefix is a known id. */
export function splitModelRef(ref: string, providerIds: Iterable<string>): { provider?: string; model: string } {
  const slash = ref.indexOf("/");
  if (slash > 0) {
    const provider = ref.slice(0, slash);
    for (const id of providerIds) if (id === provider) return { provider, model: ref.slice(slash + 1) };
  }
  return { model: ref };
}

export interface RoutedChatModelOptions {
  id?: string;
  label?: string;
  /** Adapter id used when a request names no provider (default: the first). */
  default?: string;
}

/**
 * Several providers as one `ChatModel`. Its models are "provider/model"
 * (`anthropic/claude-sonnet-5-5`, `openrouter/meta-llama/…`); a request's
 * `model` picks the adapter and the model. A bare model id goes to the
 * adapter that lists it, else to the default adapter; no model → the default
 * adapter's default model.
 */
export function routedChatModel(models: readonly ChatModel[], options: RoutedChatModelOptions = {}): ChatModel {
  if (!models.length) throw new Error("routedChatModel needs at least one model");
  const byId = new Map(models.map((m) => [m.id, m]));
  if (byId.size !== models.length) throw new Error("routedChatModel: adapter ids must be unique");
  const fallback = (options.default && byId.get(options.default)) || models[0]!;
  const ordered = [fallback, ...models.filter((m) => m !== fallback)];
  const prefixed = (m: ChatModel, list: ModelEntry[]) => list.map((e) => ({ id: `${m.id}/${e.id}`, label: `${m.label} · ${e.label ?? e.id}` }));

  const resolve = (ref: string | undefined): { adapter: ChatModel; model?: string } => {
    if (!ref) return { adapter: fallback };
    const { provider, model } = splitModelRef(ref, byId.keys());
    if (provider) return { adapter: byId.get(provider)!, model };
    const lister = ordered.find((m) => m.models?.some((e) => e.id === ref));
    return { adapter: lister ?? fallback, model: ref };
  };

  return defineChatModel({
    id: options.id ?? "router",
    label: options.label ?? (models.length === 1 ? fallback.label : "AI models"),
    models: ordered.flatMap((m) => prefixed(m, m.models ?? [])),
    providers: ordered.map((m) => ({ id: m.id, label: m.label })),
    async complete(request, opts) {
      const { adapter, model } = resolve(request.model);
      const { model: _drop, ...rest } = request;
      return adapter.complete(model ? { ...rest, model } : rest, opts);
    },
    async listModels(opts) {
      const lists = await Promise.allSettled(ordered.map(async (m) => prefixed(m, m.listModels ? await m.listModels(opts) : (m.models ?? []))));
      return lists.flatMap((r, i) => (r.status === "fulfilled" ? r.value : prefixed(ordered[i]!, ordered[i]!.models ?? [])));
    },
  });
}
