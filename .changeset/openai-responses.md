---
"@miraiclip/assistant": minor
---

`openAIResponsesModel`: an OpenAI adapter over the Responses API (`/v1/responses`), where OpenAI's reasoning models take function tools together with reasoning (on Chat Completions they refuse: "Function tools with reasoning_effort are not supported"). Stateless (`store: false`); `reasoningEffort` sets the effort and carries the encrypted reasoning across tool calls (on the first call's `meta`); tool pictures follow the outputs as one user message; streams text; `max_output_tokens` cut-offs are `finish: "length"`. The built-in `openai` provider (`createChatModel`, `chatModelsFromEnv`) now uses it (`api: "openai-responses"`); OpenAI-compatible servers keep `openAIChatModel`.
