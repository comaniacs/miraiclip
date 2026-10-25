/**
 * Google Gemini adapter, over the Gemini API's `generateContent` with
 * function calling.
 *
 * Tools are sent as full JSON Schema (`parametersJsonSchema`), so the same
 * schemas the other adapters use work unchanged. Gemini's thought signatures
 * (required when thinking models call tools) ride on each tool call's `meta`
 * and are sent back exactly as received.
 */
import {
  defaultFetch,
  defineChatModel,
  type ChatMessage,
  type ChatModel,
  type ChatRequest,
  type ChatResponse,
  type FetchLike,
  type ToolCall,
} from "./types.js";
import { getJson, isEventStream, modelList, readSse, sendWithRetry, trimSlash } from "./wire.js";

export interface GeminiChatModelOptions {
  /** Model id, e.g. "gemini-3.8-flash". Required: model names change faster than this package. */
  model: string;
  /** Other models the app may pick per request (`ChatRequest.model`). */
  models?: { id: string; label?: string }[];
  /** Gemini API key. Keep it server-side (see `createChatHandler`) unless it's the user's own key in their own browser. */
  apiKey?: string | undefined;
  /** Default https://generativelanguage.googleapis.com/v1beta. */
  baseUrl?: string;
  headers?: Record<string, string>;
  /** Default request fields merged into every call; `generationConfig` is merged key by key (e.g. `{ generationConfig: { temperature: 0.2 } }`). */
  params?: Record<string, unknown>;
  /** Stream responses (default true). */
  stream?: boolean;
  /** Retries on 429 and 5xx, as the server asks. Default 4; 0 disables. */
  maxRetries?: number;
  /** Adapter id / label (default "gemini" / "Google Gemini"). */
  id?: string;
  label?: string;
  fetch?: FetchLike;
}

type Part = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
  inlineData?: { mimeType: string; data: string };
};
export type GeminiContent = { role: "user" | "model"; parts: Part[] };

/** Gemini's documented value for replaying a tool call it didn't sign (e.g. one another model made). */
const UNSIGNED = "skip_thought_signature_validator";

interface GeminiMeta {
  /** The call id Gemini assigned, when it assigned one. */
  id?: string;
  signature?: string;
}

const metaOf = (call: ToolCall): GeminiMeta => (call.meta?.gemini as GeminiMeta | undefined) ?? {};

/** A tool result as the object `functionResponse.response` must be. */
function responseObject(content: string): Record<string, unknown> {
  try {
    const value = JSON.parse(content) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
    return { result: value };
  } catch {
    return { result: content };
  }
}

/** Neutral messages → `{ systemInstruction, contents }` for `generateContent`. */
export function toGeminiContents(messages: readonly ChatMessage[]): { system: string; contents: GeminiContent[] } {
  const system: string[] = [];
  const contents: GeminiContent[] = [];
  const callIds = new Map<string, string | undefined>(); // our tool-call id → Gemini's id (if it gave one)
  const push = (role: GeminiContent["role"], parts: Part[]) => {
    if (!parts.length) return;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else contents.push({ role, parts });
  };
  // Pictures from a run of tool results go after all its function responses, in the same turn.
  let pending: Part[] = [];
  const flush = () => {
    if (pending.length) push("user", [{ text: "Images returned by the tool calls above:" }, ...pending]);
    pending = [];
  };
  for (const m of messages) {
    if (m.role !== "tool") flush();
    if (m.role === "system") system.push(m.content);
    else if (m.role === "user") push("user", m.content ? [{ text: m.content }] : []);
    else if (m.role === "tool") {
      const id = callIds.get(m.toolCallId);
      push("user", [{ functionResponse: { ...(id ? { id } : {}), name: m.name, response: responseObject(m.content) } }]);
      if (m.images?.length) pending.push({ text: `From ${m.name}:` }, ...m.images.map((i): Part => ({ inlineData: { mimeType: i.mimeType, data: i.data } })));
    } else {
      const calls = m.toolCalls ?? [];
      const signed = calls.some((c) => metaOf(c).signature);
      push("model", [
        ...(m.content ? [{ text: m.content }] : []),
        ...calls.map((c, i): Part => {
          const meta = metaOf(c);
          callIds.set(c.id, meta.id);
          const signature = meta.signature ?? (i === 0 && !signed ? UNSIGNED : undefined);
          return { functionCall: { ...(meta.id ? { id: meta.id } : {}), name: c.name, args: c.arguments }, ...(signature ? { thoughtSignature: signature } : {}) };
        }),
      ]);
    }
  }
  flush();
  return { system: system.join("\n\n"), contents };
}

const FINISH: Record<string, ChatResponse["finish"]> = {
  STOP: "stop",
  MAX_TOKENS: "length",
  SAFETY: "content_filter",
  RECITATION: "content_filter",
  BLOCKLIST: "content_filter",
  PROHIBITED_CONTENT: "content_filter",
  SPII: "content_filter",
  IMAGE_SAFETY: "content_filter",
};

interface ResponseJson {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  modelVersion?: string;
}

/** Collects parts across one response or many stream chunks. */
function collector(onText?: (delta: string) => void) {
  let content = "";
  let finishReason: string | undefined;
  let blocked = false;
  let model: string | undefined;
  let usage: ChatResponse["usage"];
  const toolCalls: ToolCall[] = [];
  const batch = Math.random().toString(36).slice(2, 10);
  return {
    add(json: ResponseJson) {
      if (json.modelVersion) model = json.modelVersion;
      if (json.promptFeedback?.blockReason) blocked = true;
      const u = json.usageMetadata;
      if (u) {
        usage = {
          ...(u.promptTokenCount !== undefined ? { inputTokens: u.promptTokenCount } : {}),
          ...(u.candidatesTokenCount !== undefined || u.thoughtsTokenCount !== undefined ? { outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) } : {}),
        };
      }
      const candidate = json.candidates?.[0];
      if (candidate?.finishReason) finishReason = candidate.finishReason;
      for (const part of candidate?.content?.parts ?? []) {
        if (part.functionCall) {
          const gemini: GeminiMeta = { ...(part.functionCall.id ? { id: part.functionCall.id } : {}), ...(part.thoughtSignature ? { signature: part.thoughtSignature } : {}) };
          toolCalls.push({
            // Gemini often gives no id; ours must still be unique across the conversation.
            id: part.functionCall.id ?? `call_${batch}_${toolCalls.length}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args ?? {},
            ...(Object.keys(gemini).length ? { meta: { gemini } } : {}),
          });
        } else if (part.text && !part.thought) {
          content += part.text;
          onText?.(part.text);
        }
      }
    },
    result(): ChatResponse {
      const finish: ChatResponse["finish"] = blocked
        ? "content_filter"
        : toolCalls.length && (finishReason === "STOP" || finishReason === undefined)
          ? "tool_calls"
          : (FINISH[finishReason ?? ""] ?? "other");
      return { content, toolCalls, finish, ...(model ? { model } : {}), ...(usage ? { usage } : {}) };
    },
  };
}

const bareModel = (model: string) => model.replace(/^models\//, "");

export function geminiChatModel(options: GeminiChatModelOptions): ChatModel {
  const base = trimSlash(options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta");
  const id = options.id ?? "gemini";
  const doFetch = options.fetch ?? defaultFetch();
  const stream = options.stream ?? true;
  const models = modelList(bareModel(options.model), options.models?.map((m) => ({ ...m, id: bareModel(m.id) })));

  const headers = (): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(options.apiKey ? { "x-goog-api-key": options.apiKey } : {}),
    ...options.headers,
  });

  return defineChatModel({
    id,
    label: options.label ?? "Google Gemini",
    models,
    async listModels(opts = {}) {
      const json = (await getJson(id, doFetch, `${base}/models?pageSize=1000`, headers(), opts.signal)) as {
        models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
      };
      return (json.models ?? [])
        .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent"))
        .map((m) => ({ id: bareModel(m.name), ...(m.displayName ? { label: m.displayName } : {}) }));
    },
    async complete(request: ChatRequest, opts = {}): Promise<ChatResponse> {
      const { system, contents } = toGeminiContents(request.messages);
      const params = { ...options.params, ...request.params };
      const generationConfig = {
        ...(request.maxOutputTokens ? { maxOutputTokens: request.maxOutputTokens } : {}),
        ...(options.params?.generationConfig as object | undefined),
        ...(request.params?.generationConfig as object | undefined),
      };
      const body: Record<string, unknown> = {
        ...params,
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        ...(request.tools?.length
          ? { tools: [{ functionDeclarations: request.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.inputSchema })) }] }
          : {}),
        ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
      };
      const model = bareModel(request.model ?? options.model);
      const url = `${base}/models/${encodeURIComponent(model)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
      const res = await sendWithRetry(
        id,
        doFetch,
        url,
        { method: "POST", headers: headers(), body: JSON.stringify(body) },
        { ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}), ...(opts.signal ? { signal: opts.signal } : {}) },
      );
      const collect = collector(opts.onText);
      if (!stream || !isEventStream(res)) collect.add((await res.json()) as ResponseJson);
      else {
        await readSse(res.body!, (data) => {
          try {
            collect.add(JSON.parse(data) as ResponseJson);
          } catch {
            /* keep-alive or partial line */
          }
        });
      }
      const out = collect.result();
      out.model ??= model;
      return out;
    },
  });
}
