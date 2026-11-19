/**
 * OpenAI adapter over the Responses API (`/v1/responses`) with function calling.
 *
 * OpenAI's reasoning models only take function tools together with reasoning
 * here: on Chat Completions they refuse tools unless reasoning is off ("Function
 * tools with reasoning_effort are not supported … use /v1/responses"). Use this
 * adapter for OpenAI itself; `openAIChatModel` stays the one for the many
 * OpenAI-compatible servers that only speak Chat Completions.
 *
 * Requests are stateless (`store: false`): the whole conversation goes every
 * time. The model's reasoning comes back encrypted (`reasoning.encrypted_content`)
 * and rides on the first tool call's `meta`, so the next request hands it back
 * and the model keeps its train of thought across tool calls, the way the
 * Anthropic adapter keeps thinking blocks.
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
import { getJson, isEventStream, modelList, parseToolArguments, readSse, sendWithRetry, trimSlash } from "./wire.js";

export type OpenAIReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface OpenAIResponsesModelOptions {
  /** Model id, e.g. "gpt-6.2-luna". Required: model names change faster than this package. */
  model: string;
  /** Other models the app may pick per request (`ChatRequest.model`). */
  models?: { id: string; label?: string }[];
  /** API key. Keep it server-side (see `createChatHandler`). */
  apiKey?: string | undefined;
  /** Default https://api.openai.com/v1 (Azure OpenAI and proxies that speak Responses work too). */
  baseUrl?: string;
  organization?: string;
  project?: string;
  headers?: Record<string, string>;
  /**
   * How hard the model thinks before answering. Set it for reasoning models:
   * it also asks for their (encrypted) reasoning back, so it carries across
   * tool calls. Leave it out for models without reasoning (gpt-4.1 and older
   * refuse both the setting and the reasoning they'd be handed back).
   */
  reasoningEffort?: OpenAIReasoningEffort;
  /** Default request fields merged into every call (e.g. `{ text: { verbosity: "low" } }`). */
  params?: Record<string, unknown>;
  /** Stream responses (default true). */
  stream?: boolean;
  /** Retries on rate limits and server errors, as `openAIChatModel` (default 4; 0 disables). */
  maxRetries?: number;
  /** Adapter id / label (default "openai" / "OpenAI"). */
  id?: string;
  label?: string;
  fetch?: FetchLike;
}

type InputContent = { type: "input_text"; text: string } | { type: "input_image"; image_url: string };
/** An output item as the API sends it; only the fields we read or hand back. */
interface OutputItem {
  type: string;
  id?: string;
  // reasoning
  encrypted_content?: string | null;
  summary?: unknown[];
  // function_call
  call_id?: string;
  name?: string;
  arguments?: string;
  // message
  role?: string;
  content?: { type: string; text?: string; refusal?: string }[];
}
type InputItem =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "user"; content: InputContent[] }
  | { type: "function_call"; call_id: string; name: string; arguments: string; id?: string }
  | { type: "function_call_output"; call_id: string; output: string }
  | OutputItem;

/** The meta key the reasoning items ride under (on the first tool call of a turn). */
const REASONING = "openaiReasoning";
/** The meta key for a function call's own item id. */
const ITEM_ID = "openaiItemId";

/** Neutral messages → Responses input items (system messages become the `instructions`). */
export function toResponsesInput(
  messages: readonly ChatMessage[],
  options: { reasoning?: boolean } = {},
): { instructions?: string; input: InputItem[] } {
  const keepReasoning = options.reasoning ?? true;
  const system: string[] = [];
  const input: InputItem[] = [];
  // Function outputs carry text only: the pictures from a run of tool results
  // follow it as one user message, as in the Chat Completions adapter.
  let pending: InputContent[] = [];
  const flush = () => {
    if (!pending.length) return;
    input.push({ role: "user", content: [{ type: "input_text", text: "Images returned by the tool calls above:" }, ...pending] });
    pending = [];
  };
  for (const m of messages) {
    if (m.role !== "tool") flush();
    if (m.role === "system") {
      system.push(m.content);
    } else if (m.role === "user") {
      input.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const reasoning = keepReasoning ? ((m.toolCalls?.[0]?.meta?.[REASONING] as OutputItem[] | undefined) ?? []) : [];
      // A reasoning item must come straight before the calls it led to.
      input.push(...reasoning);
      if (m.content) input.push({ role: "assistant", content: m.content });
      for (const c of m.toolCalls ?? []) {
        const id = c.meta?.[ITEM_ID];
        input.push({
          type: "function_call",
          call_id: c.id,
          name: c.name,
          arguments: JSON.stringify(c.arguments),
          ...(typeof id === "string" && reasoning.length ? { id } : {}),
        });
      }
    } else {
      input.push({ type: "function_call_output", call_id: m.toolCallId, output: m.content });
      if (m.images?.length) {
        pending.push(
          { type: "input_text", text: `From ${m.name} (${m.toolCallId}):` },
          ...m.images.map((i): InputContent => ({ type: "input_image", image_url: `data:${i.mimeType};base64,${i.data}` })),
        );
      }
    }
  }
  flush();
  return { ...(system.length ? { instructions: system.join("\n\n") } : {}), input };
}

export function openAIResponsesModel(options: OpenAIResponsesModelOptions): ChatModel {
  const base = trimSlash(options.baseUrl ?? "https://api.openai.com/v1");
  const id = options.id ?? "openai";
  const doFetch = options.fetch ?? defaultFetch();
  const stream = options.stream ?? true;
  const models = modelList(options.model, options.models);

  const headers = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json", ...options.headers };
    if (options.apiKey) h["Authorization"] = `Bearer ${options.apiKey}`;
    if (options.organization) h["OpenAI-Organization"] = options.organization;
    if (options.project) h["OpenAI-Project"] = options.project;
    return h;
  };

  return defineChatModel({
    id,
    label: options.label ?? "OpenAI",
    models,
    async listModels(opts = {}) {
      const json = (await getJson(id, doFetch, `${base}/models`, headers(), opts.signal)) as { data?: { id: string }[] };
      return (json.data ?? []).map((m) => ({ id: m.id })).sort((a, b) => a.id.localeCompare(b.id));
    },
    async complete(request: ChatRequest, opts = {}): Promise<ChatResponse> {
      const reasons = !!options.reasoningEffort && options.reasoningEffort !== "none";
      const { instructions, input } = toResponsesInput(request.messages, { reasoning: reasons });
      const body: Record<string, unknown> = {
        model: request.model ?? options.model,
        input,
        ...(instructions ? { instructions } : {}),
        ...(request.tools?.length
          ? { tools: request.tools.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.inputSchema, strict: false })) }
          : {}),
        ...(request.maxOutputTokens ? { max_output_tokens: request.maxOutputTokens } : {}),
        ...(options.reasoningEffort ? { reasoning: { effort: options.reasoningEffort } } : {}),
        // Stateless: nothing kept at OpenAI; the reasoning comes back to us, encrypted.
        store: false,
        ...(reasons ? { include: ["reasoning.encrypted_content"] } : {}),
        ...(stream ? { stream: true } : {}),
        ...options.params,
        ...request.params,
      };
      const res = await sendWithRetry(
        id,
        doFetch,
        `${base}/responses`,
        { method: "POST", headers: headers(), body: JSON.stringify(body) },
        { ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}), ...(opts.signal ? { signal: opts.signal } : {}) },
      );
      if (!stream || !isEventStream(res)) {
        const out = fromResponse(id, (await res.json()) as ResponseJson);
        if (out.content) opts.onText?.(out.content);
        return out;
      }
      return readStream(id, res.body!, opts.onText);
    },
  });
}

interface ResponseJson {
  model?: string;
  status?: string;
  output?: OutputItem[];
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string; code?: string } | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** A finished (or cut-off) response → the neutral response. */
export function fromResponse(provider: string, json: ResponseJson, streamedItems: OutputItem[] = []): ChatResponse {
  if (json.status === "failed" || (json.error && json.status !== "completed")) {
    throw new ChatModelError(provider, json.error?.message ?? "the response failed");
  }
  const items = json.output?.length ? json.output : streamedItems;
  const reasoning = items.filter((i) => i.type === "reasoning" && i.encrypted_content);
  let content = "";
  const toolCalls: ToolCall[] = [];
  for (const item of items) {
    if (item.type === "message") {
      for (const part of item.content ?? []) if (part.type === "output_text" && part.text) content += part.text;
    } else if (item.type === "function_call") {
      const first = toolCalls.length === 0;
      toolCalls.push({
        id: item.call_id ?? item.id ?? `call_${toolCalls.length}`,
        name: item.name ?? "",
        arguments: parseToolArguments(item.arguments ?? ""),
        meta: {
          ...(item.id ? { [ITEM_ID]: item.id } : {}),
          ...(first && reasoning.length ? { [REASONING]: reasoning.map(({ type, id, encrypted_content, summary }) => ({ type, id, encrypted_content, summary: summary ?? [] })) } : {}),
        },
      });
    }
  }
  const reason = json.incomplete_details?.reason;
  const finish: ChatResponse["finish"] =
    json.status === "incomplete"
      ? reason === "max_output_tokens"
        ? "length"
        : reason === "content_filter"
          ? "content_filter"
          : "other"
      : toolCalls.length
        ? "tool_calls"
        : "stop";
  const out: ChatResponse = { content, toolCalls, finish };
  if (json.model) out.model = json.model;
  if (json.usage) {
    out.usage = {
      ...(json.usage.input_tokens !== undefined ? { inputTokens: json.usage.input_tokens } : {}),
      ...(json.usage.output_tokens !== undefined ? { outputTokens: json.usage.output_tokens } : {}),
    };
  }
  return out;
}

interface StreamEvent {
  type?: string;
  delta?: string;
  item?: OutputItem;
  response?: ResponseJson;
  message?: string;
  code?: string;
}

/**
 * The event stream → one response. Text deltas stream to `onText`; the final
 * `response.completed` (or `.incomplete` / `.failed`) carries the whole output.
 * Items finished along the way are kept in case that final event leaves it out.
 */
async function readStream(provider: string, body: ReadableStream<Uint8Array>, onText?: (delta: string) => void): Promise<ChatResponse> {
  let final: ResponseJson | undefined;
  let failure: string | undefined;
  const items: OutputItem[] = [];
  await readSse(body, (data) => {
    if (data === "[DONE]") return;
    let ev: StreamEvent;
    try {
      ev = JSON.parse(data) as StreamEvent;
    } catch {
      return;
    }
    switch (ev.type) {
      case "response.output_text.delta":
        if (ev.delta) onText?.(ev.delta);
        break;
      case "response.output_item.done":
        if (ev.item) items.push(ev.item);
        break;
      case "response.completed":
      case "response.incomplete":
      case "response.failed":
        final = ev.response;
        break;
      case "error":
        failure = ev.message ?? ev.code ?? "stream error";
        break;
    }
  });
  if (failure && !final) throw new ChatModelError(provider, failure);
  if (!final) {
    if (!items.length) throw new ChatModelError(provider, "the stream ended without a response");
    final = { status: "completed", output: items };
  }
  return fromResponse(provider, final, items);
}
