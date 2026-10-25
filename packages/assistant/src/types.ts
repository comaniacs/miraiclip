/**
 * The vendor-neutral model contract. An adapter turns these neutral messages
 * and tools into one vendor's API and back; nothing else in the package knows
 * which vendor is on the other end.
 */

/** A tool call the model made. `arguments` is already parsed JSON. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /**
   * Opaque data the adapter that produced the call needs back when the
   * conversation is replayed (Gemini thought signatures, Anthropic thinking
   * blocks). Keep it with the call; other adapters ignore it.
   */
  meta?: Record<string, unknown>;
}

/** An image the model looks at (a rendered preview a tool returns): base64 bytes and their type. */
export interface ChatImage {
  mimeType: string;
  /** Base64, no `data:` prefix. */
  data: string;
}

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  /** `images`: pictures that come with the result (e.g. rendered frames), for models that can see. */
  | { role: "tool"; toolCallId: string; name: string; content: string; images?: ChatImage[] };

/** A tool as the model sees it: name, description and a JSON Schema for its input. */
export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolSpec[];
  /** Model id, when the adapter serves several. */
  model?: string;
  maxOutputTokens?: number;
  /** Vendor-specific request fields, passed through untouched (e.g. `{ reasoning_effort: "low" }`). */
  params?: Record<string, unknown>;
}

export interface ChatUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  /** Why the model stopped. */
  finish: "stop" | "tool_calls" | "length" | "content_filter" | "other";
  model?: string;
  usage?: ChatUsage;
}

export interface ChatOptions {
  signal?: AbortSignal;
  /** Streaming text, as it arrives (adapters that can't stream call it once). */
  onText?: (delta: string) => void;
}

export interface ModelEntry {
  id: string;
  label?: string;
}

export interface ChatModelInfo {
  /** Adapter id, e.g. "openai". Alphanumeric with - or _. */
  id: string;
  label: string;
  /** Models this adapter serves; the first is the default. */
  models?: ModelEntry[];
  /** For a model that routes to several providers (`routedChatModel`): which ones. */
  providers?: { id: string; label: string }[];
}

export interface ChatModel extends ChatModelInfo {
  complete(request: ChatRequest, options?: ChatOptions): Promise<ChatResponse>;
  /** Every model the account behind this adapter can use, live from the vendor (for model pickers). */
  listModels?(options?: { signal?: AbortSignal }): Promise<ModelEntry[]>;
}

/** An error from a model vendor, carrying its HTTP status when there was one. */
export class ChatModelError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${provider}: ${message}`);
    this.name = "ChatModelError";
  }
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export function defaultFetch(): FetchLike {
  if (typeof fetch !== "function") throw new Error("No global fetch: pass `fetch` explicitly");
  return (url, init) => fetch(url, init);
}

/** Check an adapter's shape once, at registration. */
export function defineChatModel<M extends ChatModel>(model: M): M {
  if (!model.id || !/^[a-z0-9][a-z0-9_-]*$/i.test(model.id)) {
    throw new Error(`Chat model id must be alphanumeric with - or _ (got "${model.id}")`);
  }
  if (typeof model.complete !== "function") throw new Error(`Chat model "${model.id}" has no complete()`);
  return model;
}
