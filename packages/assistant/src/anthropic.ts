/**
 * Anthropic adapter, over the Messages API with tool use.
 *
 * System messages become the top-level `system` prompt; tool results are
 * grouped into one user turn, as the API expects. When extended thinking is
 * on (`params: { thinking: … }`), the thinking blocks of a tool-using turn
 * ride on the first tool call's `meta` and are sent back on the next request,
 * which the API requires.
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

export interface AnthropicChatModelOptions {
  /** Model id, e.g. "claude-sonnet-5-5". Required: model names change faster than this package. */
  model: string;
  /** Other models the app may pick per request (`ChatRequest.model`). */
  models?: { id: string; label?: string }[];
  /** API key. Keep it server-side (see `createChatHandler`) unless it's the user's own key in their own browser (`browser`). */
  apiKey?: string | undefined;
  /** Default https://api.anthropic.com (requests go to `{baseUrl}/v1/messages`). */
  baseUrl?: string;
  /** `anthropic-version` header (default "2023-06-01"). */
  version?: string;
  /** `anthropic-beta` flags, joined with commas. */
  betas?: string[];
  headers?: Record<string, string>;
  /** Default request fields merged into every call (e.g. `{ thinking: { type: "enabled", budget_tokens: 4000 } }`). */
  params?: Record<string, unknown>;
  /** The API requires an output cap; used when a request sets none (default 8192). */
  maxOutputTokens?: number;
  /** Stream responses (default true). */
  stream?: boolean;
  /** Retries on 429, 5xx and 529 (overloaded), as the server asks. Default 4; 0 disables. */
  maxRetries?: number;
  /**
   * Calling from a browser with the user's own key: sends the header the API
   * needs to allow cross-origin requests. Never ship your own key this way.
   */
  browser?: boolean;
  /** Adapter id / label (default "anthropic" / "Anthropic"). */
  id?: string;
  label?: string;
  fetch?: FetchLike;
}

type ImageBlock = { type: "image"; source: { type: "base64"; media_type: string; data: string } };
type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string | ({ type: "text"; text: string } | ImageBlock)[] }
  | { type: "thinking"; thinking: string; signature: string }
  | { type: "redacted_thinking"; data: string };

export type AnthropicMessage = { role: "user" | "assistant"; content: Block[] };

/** Neutral messages → `{ system, messages }` for the Messages API. */
export function toAnthropicMessages(messages: readonly ChatMessage[]): { system: string; messages: AnthropicMessage[] } {
  const system: string[] = [];
  const out: AnthropicMessage[] = [];
  const push = (role: AnthropicMessage["role"], blocks: Block[]) => {
    if (!blocks.length) return;
    const last = out[out.length - 1];
    // The API wants user/assistant turns to alternate: fold same-role neighbours together.
    if (last && last.role === role) last.content.push(...blocks);
    else out.push({ role, content: blocks });
  };
  for (const m of messages) {
    if (m.role === "system") system.push(m.content);
    else if (m.role === "user") push("user", m.content.trim() ? [{ type: "text", text: m.content }] : []);
    else if (m.role === "tool") {
      const content = m.images?.length
        ? [{ type: "text" as const, text: m.content }, ...m.images.map((i): ImageBlock => ({ type: "image", source: { type: "base64", media_type: i.mimeType, data: i.data } }))]
        : m.content;
      push("user", [{ type: "tool_result", tool_use_id: m.toolCallId, content }]);
    }
    else {
      const thinking = (m.toolCalls?.[0]?.meta?.anthropicThinking as Block[] | undefined) ?? [];
      push("assistant", [
        ...thinking,
        ...(m.content.trim() ? [{ type: "text" as const, text: m.content }] : []),
        ...(m.toolCalls ?? []).map((c): Block => ({ type: "tool_use", id: c.id, name: c.name, input: c.arguments })),
      ]);
    }
  }
  return { system: system.join("\n\n"), messages: out };
}

const FINISH: Record<string, ChatResponse["finish"]> = {
  end_turn: "stop",
  stop_sequence: "stop",
  tool_use: "tool_calls",
  max_tokens: "length",
  model_context_window_exceeded: "length",
  refusal: "content_filter",
};

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

const usageOf = (u: Usage) => {
  const input = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  return {
    ...(u.input_tokens !== undefined ? { inputTokens: input } : {}),
    ...(u.output_tokens !== undefined ? { outputTokens: u.output_tokens } : {}),
  };
};

/** Content blocks → the neutral response (thinking blocks go on the first tool call). */
function fromBlocks(blocks: Block[], stopReason: string | undefined, model: string | undefined, usage: Usage | undefined): ChatResponse {
  const thinking = blocks.filter((b) => b.type === "thinking" || b.type === "redacted_thinking");
  const toolCalls: ToolCall[] = blocks
    .filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use")
    .map((b, i) => ({ id: b.id, name: b.name, arguments: b.input ?? {}, ...(i === 0 && thinking.length ? { meta: { anthropicThinking: thinking } } : {}) }));
  const out: ChatResponse = {
    content: blocks.map((b) => (b.type === "text" ? b.text : "")).join(""),
    toolCalls,
    finish: FINISH[stopReason ?? ""] ?? "other",
  };
  if (model) out.model = model;
  if (usage) out.usage = usageOf(usage);
  return out;
}

export function anthropicChatModel(options: AnthropicChatModelOptions): ChatModel {
  const base = trimSlash(options.baseUrl ?? "https://api.anthropic.com");
  const id = options.id ?? "anthropic";
  const doFetch = options.fetch ?? defaultFetch();
  const stream = options.stream ?? true;
  const models = modelList(options.model, options.models);

  const headers = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json", "anthropic-version": options.version ?? "2023-06-01", ...options.headers };
    if (options.apiKey) h["x-api-key"] = options.apiKey;
    if (options.betas?.length) h["anthropic-beta"] = options.betas.join(",");
    if (options.browser) h["anthropic-dangerous-direct-browser-access"] = "true";
    return h;
  };

  return defineChatModel({
    id,
    label: options.label ?? "Anthropic",
    models,
    async listModels(opts = {}) {
      const json = (await getJson(id, doFetch, `${base}/v1/models?limit=1000`, headers(), opts.signal)) as { data?: { id: string; display_name?: string }[] };
      return (json.data ?? []).map((m) => ({ id: m.id, ...(m.display_name ? { label: m.display_name } : {}) }));
    },
    async complete(request: ChatRequest, opts = {}): Promise<ChatResponse> {
      const { system, messages } = toAnthropicMessages(request.messages);
      const body: Record<string, unknown> = {
        model: request.model ?? options.model,
        max_tokens: request.maxOutputTokens ?? options.maxOutputTokens ?? 8192,
        messages,
        ...(system ? { system } : {}),
        ...(request.tools?.length ? { tools: request.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })) } : {}),
        ...(stream ? { stream: true } : {}),
        ...options.params,
        ...request.params,
      };
      const res = await sendWithRetry(
        id,
        doFetch,
        `${base}/v1/messages`,
        { method: "POST", headers: headers(), body: JSON.stringify(body) },
        { ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}), ...(opts.signal ? { signal: opts.signal } : {}) },
      );
      if (!stream || !isEventStream(res)) {
        const json = (await res.json()) as { content?: Block[]; stop_reason?: string; model?: string; usage?: Usage };
        const out = fromBlocks(json.content ?? [], json.stop_reason, json.model, json.usage);
        if (out.content) opts.onText?.(out.content);
        return out;
      }
      return readStream(id, res.body!, opts.onText);
    },
  });
}

interface StreamEvent {
  type: string;
  index?: number;
  message?: { model?: string; usage?: Usage };
  content_block?: { type: string; id?: string; name?: string; text?: string; thinking?: string; signature?: string; data?: string };
  delta?: { type?: string; text?: string; partial_json?: string; thinking?: string; signature?: string; stop_reason?: string };
  usage?: Usage;
  error?: { message?: string; type?: string };
}

/** Message stream events → one response; text deltas go to `onText`, tool input JSON is joined per block. */
async function readStream(id: string, body: ReadableStream<Uint8Array>, onText?: (delta: string) => void): Promise<ChatResponse> {
  const blocks = new Map<number, { type: string; id?: string; name?: string; text: string; json: string; signature: string; data?: string }>();
  let model: string | undefined;
  let stopReason: string | undefined;
  const usage: Usage = {};
  let failure: string | undefined;

  await readSse(body, (data) => {
    let event: StreamEvent;
    try {
      event = JSON.parse(data) as StreamEvent;
    } catch {
      return;
    }
    switch (event.type) {
      case "message_start":
        if (event.message?.model) model = event.message.model;
        Object.assign(usage, event.message?.usage ?? {});
        break;
      case "content_block_start": {
        const b = event.content_block!;
        blocks.set(event.index ?? blocks.size, {
          type: b.type,
          ...(b.id ? { id: b.id } : {}),
          ...(b.name ? { name: b.name } : {}),
          text: b.text ?? b.thinking ?? "",
          json: "",
          signature: b.signature ?? "",
          ...(b.data ? { data: b.data } : {}),
        });
        if (b.type === "text" && b.text) onText?.(b.text);
        break;
      }
      case "content_block_delta": {
        const block = blocks.get(event.index ?? 0);
        const d = event.delta ?? {};
        if (!block) break;
        if (d.type === "text_delta" && d.text) {
          block.text += d.text;
          onText?.(d.text);
        } else if (d.type === "input_json_delta" && d.partial_json) block.json += d.partial_json;
        else if (d.type === "thinking_delta" && d.thinking) block.text += d.thinking;
        else if (d.type === "signature_delta" && d.signature) block.signature += d.signature;
        break;
      }
      case "message_delta":
        if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
        Object.assign(usage, Object.fromEntries(Object.entries(event.usage ?? {}).filter(([, v]) => v !== null && v !== undefined)));
        break;
      case "error":
        failure = event.error?.message ?? event.error?.type ?? "stream error";
        break;
    }
  });
  if (failure) throw new ChatModelError(id, failure);

  const ordered = [...blocks.entries()].sort(([a], [b]) => a - b).map(([, b]) => b);
  const out: Block[] = ordered.flatMap((b): Block[] => {
    if (b.type === "text") return [{ type: "text", text: b.text }];
    if (b.type === "tool_use") return [{ type: "tool_use", id: b.id ?? "", name: b.name ?? "", input: parseToolArguments(b.json) }];
    if (b.type === "thinking") return [{ type: "thinking", thinking: b.text, signature: b.signature }];
    if (b.type === "redacted_thinking") return [{ type: "redacted_thinking", data: b.data ?? "" }];
    return [];
  });
  return fromBlocks(out, stopReason, model, Object.keys(usage).length ? usage : undefined);
}
