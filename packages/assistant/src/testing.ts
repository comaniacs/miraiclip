import { defineChatModel, type ChatModel, type ChatRequest, type ChatResponse, type ToolCall } from "./types.js";

export type ScriptStep =
  | string
  | { text?: string; toolCalls?: (Omit<ToolCall, "id"> & { id?: string })[] }
  | ((request: ChatRequest, index: number) => ScriptStep);

/**
 * A model that answers from a script: for tests, demos and offline
 * development. Each `complete` call takes the next step; a string is a final
 * text answer, an object can call tools. Requests are kept in `requests`.
 */
export function scriptedChatModel(steps: ScriptStep[], options: { id?: string } = {}): ChatModel & { requests: ChatRequest[] } {
  const requests: ChatRequest[] = [];
  let i = 0;
  const model = defineChatModel({
    id: options.id ?? "scripted",
    label: "Scripted model",
    async complete(request: ChatRequest, opts: { onText?: (delta: string) => void } = {}): Promise<ChatResponse> {
      requests.push(structuredClone(request));
      let step: ScriptStep = steps[Math.min(i, steps.length - 1)] ?? "Done.";
      while (typeof step === "function") step = step(request, i);
      i++;
      const s = typeof step === "string" ? { text: step } : step;
      if (s.text) opts.onText?.(s.text);
      const toolCalls = (s.toolCalls ?? []).map((c, n) => ({ id: c.id ?? `call_${i}_${n}`, name: c.name, arguments: c.arguments }));
      return { content: s.text ?? "", toolCalls, finish: toolCalls.length ? "tool_calls" : "stop", usage: { inputTokens: 10, outputTokens: 5 } };
    },
  });
  return Object.assign(model, { requests });
}
