/**
 * OpenAI adapter, over the Chat Completions API with function calling.
 *
 * Chat Completions is also what most other servers speak (Azure OpenAI,
 * OpenRouter, Groq, Together, vLLM, Ollama, LM Studio…), so `baseUrl` points
 * this one adapter at any of them.
 */
import {
  ChatModelError,
  defaultFetch,
  defineChatModel,
  type ChatMessage,
  type ChatModel,
  type ChatRequest,
  type ChatResponse,
  type FetchLike,
  type ToolCall,
} from "./types.js";

export interface OpenAIChatModelOptions {
  /** Model id, e.g. "gpt-5.4-mini". Required: model names change faster than this package. */
  model: string;
  /** Other models the app may pick per request (`ChatRequest.model`). */
  models?: { id: string; label?: string }[];
  /** API key. Omit for local servers that don't need one. Keep it server-side (see `createChatHandler`). */
  apiKey?: string;
  /** Default https://api.openai.com/v1. Any OpenAI-compatible base URL works. */
  baseUrl?: string;
  organization?: string;
  project?: string;
  headers?: Record<string, string>;
  /** Default request fields merged into every call (e.g. `{ reasoning_effort: "low" }`). */
  params?: Record<string, unknown>;
  /** Stream responses (default true). */
  stream?: boolean;
  /** Adapter id / label (default "openai" / "OpenAI"), e.g. "ollama" when pointing elsewhere. */
  id?: string;
  label?: string;
  fetch?: FetchLike;
}

type OpenAIMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** Neutral messages → Chat Completions messages. */
export function toOpenAIMessages(messages: readonly ChatMessage[]): OpenAIMessage[] {
  return messages.map((m): OpenAIMessage => {
    if (m.role === "assistant") {
      const out: OpenAIMessage = { role: "assistant", content: m.content || null };
      if (m.toolCalls?.length) {
        out.tool_calls = m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.arguments) } }));
      }
      return out;
    }
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    return { role: m.role, content: m.content };
  });
}

/** Parse a tool call's JSON arguments; unparseable JSON is reported to the model as a tool error. */
export function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : { __invalidArguments: raw };
  } catch {
    return { __invalidArguments: raw };
  }
}

const FINISH: Record<string, ChatResponse["finish"]> = {
  stop: "stop",
  tool_calls: "tool_calls",
  function_call: "tool_calls",
  length: "length",
  content_filter: "content_filter",
};

export function openAIChatModel(options: OpenAIChatModelOptions): ChatModel {
  const base = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const id = options.id ?? "openai";
  const doFetch = options.fetch ?? defaultFetch();
  const stream = options.stream ?? true;
  const models = [{ id: options.model }, ...(options.models ?? []).filter((m) => m.id !== options.model)];

  return defineChatModel({
    id,
    label: options.label ?? "OpenAI",
    models,
    async complete(request: ChatRequest, opts = {}): Promise<ChatResponse> {
      const body: Record<string, unknown> = {
        model: request.model ?? options.model,
        messages: toOpenAIMessages(request.messages),
        ...(request.tools?.length
          ? { tools: request.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } })) }
          : {}),
        ...(request.maxOutputTokens ? { max_completion_tokens: request.maxOutputTokens } : {}),
        ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
        ...options.params,
        ...request.params,
      };
      const headers: Record<string, string> = { "Content-Type": "application/json", ...options.headers };
      if (options.apiKey) headers["Authorization"] = `Bearer ${options.apiKey}`;
      if (options.organization) headers["OpenAI-Organization"] = options.organization;
      if (options.project) headers["OpenAI-Project"] = options.project;

      const res = await doFetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new ChatModelError(id, err?.error?.message ?? `HTTP ${res.status}`, res.status);
      }
      if (!stream || !res.body || !(res.headers.get("content-type") ?? "").includes("event-stream")) {
        return fromCompletion(await res.json(), opts.onText);
      }
      return readStream(res.body, opts.onText);
    },
  });
}

interface CompletionJson {
  model?: string;
  choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function fromCompletion(json: CompletionJson, onText?: (delta: string) => void): ChatResponse {
  const choice = json.choices?.[0];
  const content = choice?.message?.content ?? "";
  if (content) onText?.(content);
  const out: ChatResponse = {
    content,
    toolCalls: (choice?.message?.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, arguments: parseToolArguments(c.function.arguments) })),
    finish: FINISH[choice?.finish_reason ?? ""] ?? "other",
  };
  if (json.model) out.model = json.model;
  if (json.usage) out.usage = usage(json.usage);
  return out;
}

const usage = (u: { prompt_tokens?: number; completion_tokens?: number }) => ({
  ...(u.prompt_tokens !== undefined ? { inputTokens: u.prompt_tokens } : {}),
  ...(u.completion_tokens !== undefined ? { outputTokens: u.completion_tokens } : {}),
});

interface ChunkJson {
  model?: string;
  choices?: {
    delta?: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

/** Server-sent events → one response; text deltas stream to `onText`, tool-call fragments are joined by index. */
async function readStream(body: ReadableStream<Uint8Array>, onText?: (delta: string) => void): Promise<ChatResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finish: ChatResponse["finish"] = "other";
  let model: string | undefined;
  let use: ChatResponse["usage"];
  const calls = new Map<number, { id: string; name: string; args: string }>();

  const handle = (data: string) => {
    if (data === "[DONE]") return;
    let chunk: ChunkJson;
    try {
      chunk = JSON.parse(data) as ChunkJson;
    } catch {
      return;
    }
    if (chunk.model) model = chunk.model;
    if (chunk.usage) use = usage(chunk.usage);
    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta;
      if (delta?.content) {
        content += delta.content;
        onText?.(delta.content);
      }
      for (const tc of delta?.tool_calls ?? []) {
        const call = calls.get(tc.index) ?? { id: "", name: "", args: "" };
        if (tc.id) call.id = tc.id;
        if (tc.function?.name) call.name += tc.function.name;
        if (tc.function?.arguments) call.args += tc.function.arguments;
        calls.set(tc.index, call);
      }
      if (choice.finish_reason) finish = FINISH[choice.finish_reason] ?? "other";
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line.startsWith("data:")) handle(line.slice(5).trim());
    }
    if (done) break;
  }
  if (buffer.startsWith("data:")) handle(buffer.slice(5).trim());

  const toolCalls: ToolCall[] = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, c]) => ({ id: c.id || `call_${index}`, name: c.name, arguments: parseToolArguments(c.args) }));
  const out: ChatResponse = { content, toolCalls, finish };
  if (model) out.model = model;
  if (use) out.usage = use;
  return out;
}
