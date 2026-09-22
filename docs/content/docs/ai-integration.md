---
title: AI Integration
weight: 8
---

Drive Miraiclip with an LLM. Every edit is already a validated, descriptive command, so an agent needs exactly three things: the commands as **tool definitions**, a **dispatch that returns machine-readable failures** it can correct from, and the **project state as a compact prompt**. `@miraiclip/core` ships all three — no extra package, no new dependencies.

```ts
import {
  applyCommands,
  commandTypeForTool,
  createProject,
  describeProject,
  toToolDefinitions,
  tryDispatch,
} from "@miraiclip/core";
```

## Hand the commands to the model as tools

`toToolDefinitions` turns `project.commandCatalog()` — every built-in command plus anything you registered with `registerCommand` — into ready-to-send tool definitions. Command types contain `/` (which tool-name rules forbid), so tools are named `clip_add`, `keyframe_set`, and so on.

```ts
// Anthropic tool_use shape (default): { name, description, input_schema }
const tools = toToolDefinitions(project.commandCatalog());

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 2048,
  tools,
  messages: [{ role: "user", content: prompt }],
});
```

```ts
// OpenAI function-calling shape: { type: "function", function: { ... } }
const tools = toToolDefinitions(project.commandCatalog(), { style: "openai" });
```

For hosts where ~25 tools is too many (MCP servers, tool-count-limited models), collapse the catalog into **one** `miraiclip_dispatch` tool taking `{ type, payload }`, with every valid type in an enum:

```ts
const tools = toToolDefinitions(project.commandCatalog(), { mode: "dispatch" });
```

In dispatch mode the payload schema isn't inlined per command — hand the agent the catalog (or the [command catalog page](../command-catalog)) alongside it.

Custom commands get a generated description; override or extend with `descriptions: { "myapp/watermark": "…" }`.

## Execute what the model calls

`tryDispatch` runs one command and returns a structured result instead of throwing — the failure says *what kind* of error, *which* command, and *what would be valid*, so the agent can fix its own call. Feed the failure back as the tool result:

```ts
for (const block of response.content) {
  if (block.type !== "tool_use") continue;

  const type = commandTypeForTool(block.name, Object.keys(project.commandCatalog()));
  const result = tryDispatch(project, { type: type!, payload: block.input });

  toolResults.push({
    type: "tool_result",
    tool_use_id: block.id,
    content: JSON.stringify(result),
    is_error: !result.ok,
  });
}
```

The three failure kinds:

| `error.kind` | When | What the agent gets |
| --- | --- | --- |
| `unknown-command` | The type isn't in the catalog | `validTypes` — every accepted type |
| `invalid-payload` | Zod validation failed | `issues` — one `{ path, message }` per violation |
| `rejected` | Valid shape, impossible edit (unknown clip, non-adjacent transition, …) | `code` — the engine's rejection code |

Anything that isn't a command failure — an actual bug — still throws.

## Apply a plan atomically

When the model emits a multi-command plan, apply it as one transaction with `applyCommands`: all-or-nothing (a failure rolls back everything already applied), **one undo step** on success, and the failing index reported so the agent can repair exactly the command that broke.

```ts
const result = applyCommands(project, plan, { label: "AI edit" });

if (!result.ok) {
  // result.failedIndex — which command broke; result.error — the same
  // structured failure tryDispatch returns. The document is unchanged.
}

project.undo(); // the user's escape hatch: one step reverts the whole edit
```

## Put the project in the prompt

Raw `project.toJSON()` wastes context. `describeProject` is a compact, deterministic summary with everything an agent needs to place commands — ids, kinds, and time ranges in the same microseconds commands take:

```ts
const state = describeProject(project.toJSON());
```

```text
Miraiclip project — 1920x1080 @ 30fps. Composition length: 8000000us (8.00s). All command times are MICROSECONDS (1 second = 1000000us).
assets:
- intro: video, 12000000us, src "/media/intro.mp4"
tracks (bottom to top):
- video-1 (video), 2 clips:
  - clip-1: video[intro] at 0us..5000000us [keyframes: opacity]
  - clip-2: video[intro] trim 1000000us at 5000000us..8000000us
transitions:
- t1: crossDissolve between clip-1 -> clip-2, 500000us
```

Very long tracks elide their middle (`maxClipsPerTrack`, default 50), so the summary stays bounded on any document.

## The whole loop

Ask → dispatch → feed failures back → the model self-corrects. A minimal agent:

```ts
const messages = [{
  role: "user",
  content: `${describeProject(project.toJSON())}\n\n${userRequest}`,
}];
const tools = toToolDefinitions(project.commandCatalog());
const types = Object.keys(project.commandCatalog());

while (true) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5", max_tokens: 2048, tools, messages,
  });
  const toolUses = response.content.filter((b) => b.type === "tool_use");
  if (toolUses.length === 0) break; // done — the model answered in text

  messages.push({ role: "assistant", content: response.content });
  messages.push({
    role: "user",
    content: toolUses.map((block) => {
      const type = commandTypeForTool(block.name, types);
      const result = type
        ? tryDispatch(project, { type, payload: block.input })
        : { ok: false, error: { kind: "unknown-command", validTypes: types } };
      return {
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
        is_error: !result.ok,
      };
    }),
  });
}
```

Because every change flows through the same commands a human UI dispatches, the AI's edits are **undoable, replayable, and emitted as patches** like any other — an agent is just another editor at the table.

Don't want to build the loop yourself? The [MCP Server](mcp-server) packages all of this — plus frame previews and export — behind `npx @miraiclip/mcp`, for Claude, Codex, and any other MCP client.
