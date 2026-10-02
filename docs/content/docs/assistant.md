---
title: Assistant
weight: 9
---

An AI editing assistant for your editor: the user types "add dissolves between the clips and make the title pop in", and the project changes, as **one undo step**. `@miraiclip/assistant` brings the pieces: a vendor-neutral model contract (OpenAI first), an agent loop that edits a copy of the project while the model works, editing tools, and a server handler that keeps the API key off the browser.

```sh
npm install @miraiclip/assistant
```

It builds on what core already ships for agents ([AI Integration](../ai-integration)): commands as tools, machine-readable failures, `describeProject`. Use core directly if you want your own loop.

## Quick start

```ts
import { createAssistant, openAIChatModel } from "@miraiclip/assistant";

const assistant = createAssistant({
  model: openAIChatModel({ apiKey: process.env.OPENAI_API_KEY, model: "gpt-5.4-mini" }),
});

const turn = await assistant.run(project, "add dissolves between the clips and make the title pop in");
turn.reply;   // "Added dissolves on both cuts and a pop-in on the title."
turn.changes; // ["Added crossDissolve at 10s (0.6s)", "Added crossDissolve at 15s (0.6s)", "title: Pop in · Fade out"]
project.undo(); // takes the whole request back
```

In a browser app, run the model behind your backend instead (see [Keys stay on the server](#keys-stay-on-the-server)).

## How a request runs

1. The assistant **forks** the project: a working copy with the same document, playhead and selection.
2. The model gets a system prompt with the project summary (`describeProject`) and your `context`, plus the tools. It calls tools; each runs against the copy. Failures go back to the model with the reason, so it can fix its input and retry.
3. When the model answers without calling a tool, the turn ends. The commands that changed the copy are **replayed onto the real project in one transaction**: one undo step, and nothing half-done when a request fails or is canceled.

```ts
const turn = await assistant.run(project, request, {
  history,                       // the last turn's turn.messages: the conversation continues
  context: "Selected: clip t-1. Playhead: 4.2s.",
  apply: "auto",                 // or "review": nothing changes until turn.apply()
  signal: controller.signal,     // cancel; the project is untouched
  onEvent: (e) => {              // stream to your UI
    if (e.type === "text") appendReply(e.delta);
    if (e.type === "tool-end") showStep(e.call.name, e.ok, e.changes);
  },
});
turn.status; // "applied" | "review" | "no-changes" | "failed" | "canceled"
```

**Review mode** keeps the edit pending: show `turn.changes` (and `turn.preview`, the edited document) and call `turn.apply()` or `turn.discard()`. If the user changed the project in the meantime so that the edit no longer applies, `apply()` returns `{ ok: false, error }` and changes nothing.

Commands whose ids would otherwise be random (`clip/split`, `clip/duplicate`, `effect/add`, `transition/add`) get explicit ids on the copy, so the ids the model saw are the ids the real project gets. For custom commands with optional ids, pass `fork: { ensureIds }`.

## Tools

`editorTools()` is the default set:

| Tool | What it does |
| --- | --- |
| `get_state` | The project summary (optionally the full document JSON). |
| `get_command_schema` | One command's payload schema, looked up on demand to keep prompts small. |
| `apply_commands` | A batch of core commands, all or nothing; failures name the index and reason. |
| `add_transition` | Add, replace or remove a transition on one cut, the cut nearest a time, or every cut. Lengths are capped by the spare footage at each cut; cuts without any are skipped and reported. |
| `animate_clip` | In / loop / out animation presets on a clip (fade, slides, zoom, spin, pop; pulse, float, sway, Ken Burns). Out animations are end-anchored, so they follow trims. |

`add_transition` and `animate_clip` use core's `findCuts` and animation presets (`ANIMATION_PRESETS`, `animationCommands`, `readAnimation`), the same logic an editor's panels use, so "pop in" means the same keyframes whether a person or the model applies it.

Add your own with `defineTool`, or adopt tools that come as definitions plus a runner, such as audio from [`@miraiclip/audio-sources`](../audio-sources):

```ts
import { createAssistant, defineTool, editorTools, toolsFromDefinitions } from "@miraiclip/assistant";
import { audioToolDefinitions, runAudioTool } from "@miraiclip/audio-sources";

const tools = [
  ...editorTools(),
  ...toolsFromDefinitions(audioToolDefinitions(library), (name, input, ctx) =>
    runAudioTool(name, input, { library, project: ctx.project, storeFile }),
  ),
  defineTool({
    name: "find_stock_footage",
    description: "Search our stock library and add a clip.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    async run(input, { project }) {
      // …dispatch commands on `project` (the working copy) …
      return { ok: true, result: { added: 1 }, changes: ["Added stock clip \"beach\""] };
    },
  }),
];
const assistant = createAssistant({ model, tools, instructions: "Keep titles under six words." });
```

A tool gets `{ project, signal }` and returns `{ ok: true, result?, changes? }` or `{ ok: false, error }`. `changes` are the lines your UI lists; `result` goes back to the model as JSON. Tools must edit through `ctx.project`, which is the working copy.

## Models

A `ChatModel` takes neutral messages and tools and returns text plus tool calls, streaming text through `onText`:

```ts
interface ChatModel {
  id: string;
  label: string;
  models?: { id: string; label?: string }[];
  complete(request: ChatRequest, options?: { signal?: AbortSignal; onText?: (delta: string) => void }): Promise<ChatResponse>;
}
```

**OpenAI** ships first, over the Chat Completions API with function calling and streaming:

```ts
openAIChatModel({
  apiKey,
  model: "gpt-5.4-mini",            // required: pick any model your account has
  params: { reasoning_effort: "low" }, // any request field, passed through
});
```

Chat Completions is also what many other servers speak, so the same adapter reaches Azure OpenAI, OpenRouter, Groq, vLLM, Ollama or LM Studio through `baseUrl`:

```ts
openAIChatModel({ id: "ollama", label: "Ollama", baseUrl: "http://localhost:11434/v1", model: "llama3.1" });
```

Other vendors (Claude, Gemini…) are an adapter each: map the messages and tool calls, and nothing else in the package changes. `scriptedChatModel(steps)` answers from a script, for tests, demos and offline development.

## Keys stay on the server

The agent loop and tools run in the browser, next to the project. Only model calls cross the network: mount `createChatHandler` on your backend and give the browser `remoteChatModel`, a proxy with the same shape.

```ts
// Server (Fetch API: Node 18+, edge runtimes, Next, Hono…)
import { createChatHandler, openAIChatModel } from "@miraiclip/assistant";

const handle = createChatHandler(openAIChatModel({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5.4-mini" }), {
  basePath: "/api/assistant",
  authorize: (req) => (isSignedIn(req) ? undefined : new Response("sign in", { status: 401 })),
  prepare: (r) => ({ ...r, maxOutputTokens: 2000 }), // server-side limits
});
// export default { fetch: (req) => handle(req) ?? new Response("not found", { status: 404 }) };

// Browser
import { createAssistant, remoteChatModel } from "@miraiclip/assistant";
const assistant = createAssistant({ model: await remoteChatModel("/api/assistant") });
```

The handler streams NDJSON (`text` deltas, then `done` with the response, or `error` with the vendor's status). It forwards whatever the browser sends to your key, so put `authorize` and rate limits in front of it.

## Good to know

- The system prompt says how to work (units, ids, prefer high-level tools, never invent media URLs) and how to reply; add yours with `instructions`. `DEFAULT_INSTRUCTIONS` is exported.
- `maxSteps` (default 12) caps model round-trips per request; finished work still applies.
- Earlier turns' tool results are trimmed in `history`, and tool calls left unanswered by a canceled turn are closed, so a conversation can continue after an interruption.
- Token usage per turn is in `turn.usage`.
