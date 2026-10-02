import { describeProject, type Command, type Project, type ProjectDocument } from "@miraiclip/core";
import { commitFork, forkProject, type CommitResult, type ForkOptions } from "./fork.js";
import { editorTools, type AssistantTool } from "./tools.js";
import type { ChatMessage, ChatModel, ChatUsage, ToolCall } from "./types.js";

export interface AssistantOptions {
  model: ChatModel;
  /** Default `editorTools()`. Add your own (audio, captions, stock media…). */
  tools?: AssistantTool[];
  /** Extra system instructions (brand voice, house rules). */
  instructions?: string;
  /** Model round-trips per request (default 12). */
  maxSteps?: number;
  /** Model id when the adapter serves several. */
  modelId?: string;
  maxOutputTokens?: number;
  /** Vendor request fields, passed through. */
  params?: Record<string, unknown>;
  fork?: ForkOptions;
}

export type AssistantEvent =
  | { type: "text"; delta: string }
  | { type: "tool-start"; call: ToolCall }
  | { type: "tool-end"; call: ToolCall; ok: boolean; changes?: string[]; error?: string }
  | { type: "step"; index: number };

export interface TurnOptions {
  /** Earlier messages of this conversation (`turn.messages` from the last turn). */
  history?: readonly ChatMessage[];
  /** What the user is looking at, e.g. "Selected: clip t-1. Playhead: 4.2s." */
  context?: string;
  /** "auto" (default) commits when the request finishes; "review" waits for `turn.apply()`. */
  apply?: "auto" | "review";
  signal?: AbortSignal;
  onEvent?: (event: AssistantEvent) => void;
  /** History label for the undo step (default "Assistant: <request>"). */
  label?: string;
}

export interface AssistantTurn {
  /** The model's final answer to the user. */
  reply: string;
  /** Human-readable list of what the turn changed (empty when nothing). */
  changes: string[];
  /** The commands the turn makes, in order (replayed onto the project on apply). */
  commands: readonly Command[];
  /**
   * applied: committed as one undo step. review: waiting for apply()/discard().
   * no-changes: nothing to apply. failed / canceled: the project wasn't touched.
   */
  status: "applied" | "review" | "no-changes" | "failed" | "canceled";
  error?: string;
  /** The project as the turn left it (for previews in review mode). */
  preview: ProjectDocument;
  /** The conversation so far, without the system prompt: pass back as `history`. */
  messages: ChatMessage[];
  usage: Required<ChatUsage>;
  /** Commit a reviewed turn (no-op once applied). */
  apply(): CommitResult;
  discard(): void;
}

export interface Assistant {
  readonly tools: readonly AssistantTool[];
  run(project: Project, request: string, options?: TurnOptions): Promise<AssistantTurn>;
}

const MAX_TOOL_RESULT = 20_000;
const MAX_OLD_TOOL_RESULT = 2_000;

export const DEFAULT_INSTRUCTIONS = `You are the editing assistant inside a video editor. You change the user's project by calling tools; every change you make lands as ONE undo step when you finish, so act confidently.

How to work:
- The current project is summarized below. Clip, track and asset ids there are what tools expect. Call get_state to re-read it after big changes.
- Prefer the high-level tools when they fit (add_transition, animate_clip, and any audio or media tools). Use apply_commands for everything else, batching related commands; look up a command's payload with get_command_schema the first time you use it.
- Commands use integer microseconds (1 second = 1000000). High-level tools take seconds.
- Positions (transform x, y) are fractions of the frame: 0.5, 0.5 is the center.
- Only reference media that exists in the project or that a tool returned. Never invent file URLs.
- If a tool fails, read the error, fix the input and retry. If something can't be done, say why.
- If the request is ambiguous in a way that matters, ask one short question instead of guessing.

When you're done, reply in one to three short sentences: what you changed, in plain words (times in seconds, names over ids). No markdown headings.`;

export function createAssistant(options: AssistantOptions): Assistant {
  const tools = options.tools ?? editorTools();
  const byName = new Map(tools.map((t) => [t.name, t]));
  const specs = tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  const maxSteps = options.maxSteps ?? 12;

  return {
    tools,
    async run(project, request, turn = {}) {
      const fork = forkProject(project, options.fork);
      const emit = turn.onEvent ?? (() => {});
      const usage = { inputTokens: 0, outputTokens: 0 };
      const changes: string[] = [];
      const history = trimHistory(turn.history ?? []);
      const added: ChatMessage[] = [{ role: "user", content: request }];
      const system = [
        DEFAULT_INSTRUCTIONS,
        options.instructions?.trim(),
        `Current project:\n${describeProject(fork.toJSON())}`,
        turn.context?.trim() ? `What the user is looking at: ${turn.context.trim()}` : undefined,
      ]
        .filter(Boolean)
        .join("\n\n");

      let reply = "";
      let status: AssistantTurn["status"] = "no-changes";
      let error: string | undefined;

      try {
        for (let step = 0; ; step++) {
          if (step >= maxSteps) {
            reply = (reply ? `${reply}\n\n` : "") + `I stopped after ${maxSteps} steps; what I finished is applied. Ask me to continue if there's more.`;
            break;
          }
          emit({ type: "step", index: step });
          const response = await options.model.complete(
            {
              messages: [{ role: "system", content: system }, ...history, ...added],
              tools: specs,
              ...(options.modelId ? { model: options.modelId } : {}),
              ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
              ...(options.params ? { params: options.params } : {}),
            },
            { ...(turn.signal ? { signal: turn.signal } : {}), onText: (delta) => emit({ type: "text", delta }) },
          );
          usage.inputTokens += response.usage?.inputTokens ?? 0;
          usage.outputTokens += response.usage?.outputTokens ?? 0;
          added.push({ role: "assistant", content: response.content, ...(response.toolCalls.length ? { toolCalls: response.toolCalls } : {}) });
          if (response.toolCalls.length === 0) {
            reply = response.content.trim();
            break;
          }
          for (const call of response.toolCalls) {
            if (turn.signal?.aborted) throw abortError();
            emit({ type: "tool-start", call });
            const out = await runTool(byName.get(call.name), call, fork, turn.signal);
            if (out.ok && out.changes?.length) changes.push(...out.changes);
            emit({
              type: "tool-end",
              call,
              ok: out.ok,
              ...(out.ok && out.changes?.length ? { changes: out.changes } : {}),
              ...(!out.ok ? { error: short(out.error) } : {}),
            });
            added.push({ role: "tool", toolCallId: call.id, name: call.name, content: cap(out.ok ? out.result ?? { ok: true } : { ok: false, error: out.error }, MAX_TOOL_RESULT) });
          }
        }
        status = fork.recorded.length === 0 ? "no-changes" : turn.apply === "review" ? "review" : "applied";
      } catch (err) {
        status = turn.signal?.aborted || (err as Error)?.name === "AbortError" ? "canceled" : "failed";
        error = (err as Error)?.message ?? String(err);
      }

      let committed = false;
      let discarded = false;
      const label = turn.label ?? `Assistant: ${request.length > 40 ? `${request.slice(0, 39)}…` : request}`;
      const apply = (): CommitResult => {
        if (committed) return { ok: true, applied: 0 };
        if (discarded) return { ok: false, error: "This edit was discarded." };
        if (status === "failed" || status === "canceled") return { ok: false, error: error ?? status };
        const result = commitFork(project, fork, label);
        if (result.ok) committed = true;
        return result;
      };
      if (status === "applied") {
        const result = apply();
        if (!result.ok) {
          status = "failed";
          error = result.error;
        }
      }

      return {
        reply,
        changes,
        commands: fork.recorded,
        status,
        ...(error !== undefined ? { error } : {}),
        preview: fork.toJSON(),
        messages: [...history, ...added],
        usage,
        apply,
        discard() {
          if (!committed) discarded = true;
        },
      };
    },
  };
}

async function runTool(tool: AssistantTool | undefined, call: ToolCall, project: Project, signal?: AbortSignal) {
  if (!tool) return { ok: false as const, error: `unknown tool "${call.name}"` };
  if ("__invalidArguments" in call.arguments) return { ok: false as const, error: "the tool arguments weren't valid JSON; send a JSON object" };
  try {
    return await tool.run(call.arguments, { project, ...(signal ? { signal } : {}) });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { ok: false as const, error: (err as Error)?.message ?? String(err) };
  }
}

function cap(value: unknown, max: number): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}… [truncated ${text.length - max} chars]` : text;
}

const short = (e: unknown) => {
  const text = typeof e === "string" ? e : JSON.stringify(e);
  return text.length > 300 ? `${text.slice(0, 299)}…` : text;
};

/**
 * Earlier turns keep their shape but not their bulky tool output. A turn cut
 * short (canceled, failed) can leave tool calls without results, which
 * vendors reject: those get a "not run" result.
 */
function trimHistory(history: readonly ChatMessage[]): ChatMessage[] {
  const answered = new Set(history.flatMap((m) => (m.role === "tool" ? [m.toolCallId] : [])));
  const out: ChatMessage[] = [];
  for (const m of history) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      out.push(m.content.length > MAX_OLD_TOOL_RESULT ? { ...m, content: `${m.content.slice(0, MAX_OLD_TOOL_RESULT)}… [truncated]` } : m);
      continue;
    }
    out.push(m);
    if (m.role === "assistant") {
      for (const call of m.toolCalls ?? []) {
        if (!answered.has(call.id)) out.push({ role: "tool", toolCallId: call.id, name: call.name, content: '{"ok":false,"error":"not run: the request was interrupted"}' });
      }
    }
  }
  return out;
}

function abortError() {
  const err = new Error("canceled");
  err.name = "AbortError";
  return err;
}
