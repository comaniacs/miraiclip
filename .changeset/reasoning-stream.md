---
"@miraiclip/assistant": minor
---

Show what the model is thinking. `ChatOptions.onReasoning` streams the model's reasoning:
- **Anthropic:** thinking deltas.
- **OpenAI Responses:** reasoning summaries, now requested with reasoning on via `reasoningSummary`, default `"auto"`. An organization that may not have them gets answered without them.

The server handler forwards it as NDJSON `reasoning` events, and `remoteChatModel` passes them on.

The loop emits `{ type: "reasoning", delta, index }`, and `tool-end` events now carry the tool's `result`, so apps can show a step's outcome. `scriptedChatModel` steps take `reasoning`.
