/**
 * Assistant tab: @miraiclip/assistant before publishing.
 *
 * The model runs on the dev server (vite.config.ts → /api/assistant) when
 * OPENAI_API_KEY is set; the browser talks to it through remoteChatModel, so
 * the key never reaches the page. Without a key, an offline scripted model
 * exercises the same loop (dissolves on every cut, a pop-in on the first text).
 * The agent loop and its tools run here, against a copy of the project; each
 * request lands as one undo step (or waits for Apply in review mode).
 */
import type { Project } from "@miraiclip/core";
import { audioToolDefinitions, runAudioTool } from "@miraiclip/audio-sources";
import {
  createAssistant,
  editorTools,
  remoteChatModel,
  scriptedChatModel,
  toolsFromDefinitions,
  type AssistantTurn,
  type ChatMessage,
  type ChatModel,
} from "@miraiclip/assistant";
import { library } from "./audio-panel.js";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

/** Offline stand-in: a fixed plan through the real tools. */
function offlineModel(): ChatModel {
  return scriptedChatModel([
    { text: "Looking at the timeline… ", toolCalls: [{ name: "add_transition", arguments: { kind: "crossDissolve", allCuts: true, durationSeconds: 0.6 } }] },
    (request) => {
      const state = String(request.messages.find((m) => m.role === "system")?.content ?? "");
      const text = /(\S+): text/.exec(state)?.[1];
      return text ? { toolCalls: [{ name: "animate_clip", arguments: { clipId: text, in: "pop", out: "fade" } }] } : "Added dissolves on every cut I could.";
    },
    "Added dissolves on the cuts and a pop-in on the first title. (Offline demo: set OPENAI_API_KEY for a real model.)",
  ], { id: "offline" });
}

const modelReady: Promise<ChatModel> = remoteChatModel("/api/assistant").catch(() => offlineModel());

const tools = [
  ...editorTools(),
  ...toolsFromDefinitions(
    audioToolDefinitions(library),
    (name, input, ctx) =>
      runAudioTool(name, input, {
        library,
        project: ctx.project,
        store: async (r) => (/^https?:\/\//.test(r.src) ? { ...r, src: `/api/fetch?url=${encodeURIComponent(r.src)}` } : r),
        ...(ctx.signal ? { signal: ctx.signal } : {}),
      }),
    { changes: (name, _input, result) => (name === "add_audio" || name === "generate_audio" ? [`Added audio "${(result as { title?: string })?.title ?? "clip"}"`] : undefined) },
  ),
];

export function renderAssistantPanel(body: HTMLElement, getProject: () => Project | undefined): () => void {
  const project = getProject();
  if (!project) {
    body.append(el("p", { className: "panel-note", textContent: "Load a video first." }));
    return () => {};
  }
  let history: ChatMessage[] = [];
  let controller: AbortController | null = null;

  const status = el("p", { className: "panel-note as-model", textContent: "connecting…" });
  const log = el("div", { className: "as-log" });
  const input = el("textarea", { className: "as-input", rows: 3, placeholder: "e.g. add dissolves between the clips and make the title pop in" });
  const review = el("input", { type: "checkbox", className: "as-review" });
  const send = el("button", { className: "as-send", textContent: "Send" });
  const stop = el("button", { className: "as-stop", textContent: "Stop", disabled: true });
  const clear = el("button", { textContent: "New chat" });

  void modelReady.then((m) => {
    status.textContent = m.id === "offline" ? "Offline demo model (set OPENAI_API_KEY and restart for OpenAI)" : `${m.label} · ${m.models?.[0]?.id ?? ""}`;
  });

  const ask = async () => {
    const text = input.value.trim();
    if (!text || controller) return;
    input.value = "";
    log.append(el("div", { className: "as-msg as-user", textContent: text }));
    const reply = el("div", { className: "as-msg as-bot" });
    const steps = el("ul", { className: "as-steps" });
    log.append(steps, reply);
    controller = new AbortController();
    send.disabled = true;
    stop.disabled = false;

    const model = await modelReady;
    const assistant = createAssistant({ model, tools });
    const { playheadUs, selection } = project.getState();
    let turn: AssistantTurn;
    try {
      turn = await assistant.run(project, text, {
        history,
        apply: review.checked ? "review" : "auto",
        context: `Playhead: ${(playheadUs / 1e6).toFixed(1)}s.${selection.length ? ` Selected: ${selection.join(", ")}.` : ""}`,
        signal: controller.signal,
        onEvent: (e) => {
          if (e.type === "text") reply.textContent += e.delta;
          else if (e.type === "tool-start") {
            const li = el("li", { textContent: `${e.call.name}…` });
            li.dataset["id"] = e.call.id;
            steps.append(li);
          }
          else if (e.type === "tool-end") {
            const li = [...steps.children].find((n) => (n as HTMLElement).dataset["id"] === e.call.id);
            if (li) li.textContent = `${e.ok ? "✓" : "✗"} ${e.call.name}${e.error ? `: ${e.error}` : ""}`;
          }
        },
      });
    } finally {
      controller = null;
      send.disabled = false;
      stop.disabled = true;
    }
    history = turn.messages;
    reply.textContent = turn.reply || reply.textContent;
    if (turn.error) reply.append(el("div", { className: "as-error", textContent: turn.error }));
    if (turn.changes.length) {
      const list = el("ul", { className: "as-changes" }, ...turn.changes.map((c) => el("li", { textContent: c })));
      log.append(list);
    }
    if (turn.status === "review") {
      const apply = el("button", { textContent: `Apply ${turn.commands.length} change(s)` });
      const discard = el("button", { textContent: "Discard" });
      const row = el("div", { className: "panel-footer" }, apply, discard);
      apply.onclick = () => {
        const r = turn.apply();
        row.replaceWith(el("p", { className: "panel-note", textContent: r.ok ? "Applied (one undo step)." : r.error }));
      };
      discard.onclick = () => {
        turn.discard();
        row.replaceWith(el("p", { className: "panel-note", textContent: "Discarded." }));
      };
      log.append(row);
    } else if (turn.status === "applied") {
      const undo = el("button", { textContent: "Undo" });
      undo.onclick = () => {
        project.undo();
        undo.disabled = true;
        undo.textContent = "Undone";
      };
      log.append(el("div", { className: "panel-footer" }, undo));
    }
    log.append(el("p", { className: "panel-note as-usage", textContent: `${turn.status} · ${turn.usage.inputTokens} in / ${turn.usage.outputTokens} out tokens` }));
    log.scrollTop = log.scrollHeight;
  };

  send.onclick = () => void ask();
  stop.onclick = () => controller?.abort();
  clear.onclick = () => {
    history = [];
    log.innerHTML = "";
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void ask();
  });

  body.append(
    status,
    log,
    input,
    el("label", { className: "panel-note" }, review, " Review before applying"),
    el("div", { className: "panel-footer" }, send, stop, clear),
  );
  return () => controller?.abort();
}
