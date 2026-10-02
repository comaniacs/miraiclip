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
2. The model gets a system prompt with the project summary (`describeForAssistant`: core's `describeProject` plus each clip's position, size, text style, volume, effects and animation, so relative requests like "bigger" start from real values) and your `context`, plus the tools. It calls tools; each runs against the copy. Failures go back to the model with the reason, so it can fix its input and retry.
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
| `apply_commands` | A batch of core commands, all or nothing; failures name the index and reason. Fields a command would silently ignore (e.g. `clip/move { at }`, or html `params` no `{{placeholder}}` uses) are errors, and commands that changed nothing are reported, so the model can't claim an edit that didn't happen. Common rejections come with a hint (audio fades on a text clip → `animate_clip`). |
| `add_transition` | Add, replace or remove a transition on one cut, the cut nearest a time, or every cut. Lengths are capped by the spare footage at each cut; cuts without any are skipped and reported. |
| `animate_clip` | In / loop / out animation presets on a clip (fade, slides, zoom, spin, pop; pulse, float, sway, Ken Burns). Slides also take the edge (`from-right`, `to-left`…), which models get right more often than motion names. Out animations are end-anchored, so they follow trims. |
| `add_effect` / `remove_effects` | Effects from core's catalog on one or more clips; the description lists every kind with its params, so the model doesn't guess names. |
| `set_effects_enabled` | Turns effects off or back on without deleting them. |
| `trim_clip` | Edge trims in seconds: off the start (end stays put, source advances), off the end, to a length, or edges at timeline times (`startSeconds` / `endSeconds`); `ripple` moves later clips. |
| `set_background` | A solid color behind everything (an html clip on a bottom Background track): add, recolor, re-time or remove. |
| `set_keyframes` | One property's keyframes at timeline seconds (x, y, scale, rotation, opacity, volume): spins, pans, ducking, audio ramps between two times. Refuses constant values and points to `clip/set-property`. |
| `close_gaps` | Packs a track's clips back to back. |

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

Rate limits (429) and server errors (5xx) are retried up to `maxRetries` times (default 4), waiting as long as the server asks (`Retry-After`, or "try again in 1.2s") and otherwise backing off. To stay under a tokens- or requests-per-minute budget in the first place, wrap any model:

```ts
import { rateLimitedChatModel } from "@miraiclip/assistant";
const model = rateLimitedChatModel(openAIChatModel({ apiKey, model: "gpt-5.4-mini" }), { tokensPerMinute: 150_000, requestsPerMinute: 400 });
```

It estimates each request's tokens before sending, waits when the rolling minute is full, then counts the usage the server reports. Use it in batch jobs and scripts; on a server shared by many users, rate-limit per user in front of `createChatHandler` instead.

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

## Testing the assistant

The package ships 200+ editing cases (`evals/cases.ts`): a plain-language request, the project it starts from, a reference solution and a check on the resulting project. They cover transitions, animation, text, clip and track edits, effects, audio, captions, project settings, colors, backgrounds, size and position, typography, assets, keyframes, compound requests, questions that shouldn't change anything, and requests the editor can't do. Checks judge the outcome, not the route, with a little slack where a person would allow it ("about 5 seconds").

- **`pnpm test`** runs every case through a scripted model replaying its reference solution. No key, runs in CI. It proves the tools produce what each check expects, that the loop recovers from scripted mistakes (a wrong id, a bad payload, an unknown tool), and that each request is one undo step back to the start. Each check also runs against an assistant that does nothing, to show it can fail.
- **`pnpm eval`** sends the same prompts to a real model and runs the same checks:

  ```sh
  OPENAI_API_KEY=sk-… pnpm --filter @miraiclip/assistant eval
  # OPENAI_MODEL=gpt-5.4-mini · OPENAI_BASE_URL=… (any OpenAI-compatible server)
  # EVAL_FILTER=transitions,an-title · EVAL_CONCURRENCY=2 · EVAL_MIN_PASS=0.85
  ```

  The key and these settings can also live in `.env` or `.env.local` (repo root or the package); the shell wins.

  It writes `evals/results/latest.md`: the pass rate per category, token use, and each failure with the model's reply and tool calls. The run fails below `EVAL_MIN_PASS`. Use it to compare models and to catch regressions when you change instructions or tools.

  **Staying under rate limits.** A full run sends ~200 multi-step conversations, which can exceed an account's tokens-per-minute limit. The eval throttles itself: `EVAL_TPM` (default 150000; `0` turns it off) and `EVAL_RPM` cap what it sends per rolling minute. Set `EVAL_TPM` to about 75% of your account's limit, since other traffic on the key counts too. Requests that still hit a 429 or a 5xx are retried, waiting as long as the server asks. Cases that end on an infrastructure error (rate limit, network, 5xx) are marked **errored**, listed separately and left out of the pass rate, so a throttled run doesn't read as a bad model. When the account runs out of credits or quota, the remaining cases aren't sent (they're marked errored too), and the adapter doesn't retry those errors. Rerun just those, and the report merges them with the previous run:

  ```sh
  EVAL_TPM=150000 EVAL_CONCURRENCY=2 pnpm --filter @miraiclip/assistant eval
  EVAL_RERUN=errored pnpm --filter @miraiclip/assistant eval   # or EVAL_RERUN=failed
  ```

  For a low limit, run in batches with `EVAL_FILTER` (by category or case id) and `EVAL_CONCURRENCY=1`.

Add a case for every bug report: reproduce it in `setup`, write the check, and keep it.

## Good to know

- The system prompt says how to work (units, ids, prefer high-level tools, never invent media URLs) and how to reply; add yours with `instructions`. `DEFAULT_INSTRUCTIONS` is exported.
- `maxSteps` (default 12) caps model round-trips per request; finished work still applies.
- Earlier turns' tool results are trimmed in `history`, and tool calls left unanswered by a canceled turn are closed, so a conversation can continue after an interruption.
- Token usage per turn is in `turn.usage`.
