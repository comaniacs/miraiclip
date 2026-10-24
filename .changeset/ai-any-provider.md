---
"@miraiclip/assistant": minor
"@miraiclip/core": minor
"@miraiclip/templates": patch
"@miraiclip/audio-sources": patch
---

AI that works with any model provider, and with the user's own key.

`@miraiclip/assistant`: native `anthropicChatModel` (Messages API, streaming, tool use, extended-thinking replay) and `geminiChatModel` (`generateContent`, streaming, full JSON Schema tools, thought signatures kept for tool calls) next to `openAIChatModel`. `createChatModel({ provider, apiKey, model })` builds any provider in the new `AI_PROVIDERS` catalog: OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, xAI, Together, Ollama, LM Studio and any OpenAI-compatible server. `chatModelsFromEnv(env)` sets up every provider whose `{PROVIDER}_API_KEY` is set (`_MODEL`, `_MODELS`, `_BASE_URL` too; `OPENAI_BASE_URL` keeps its meaning). `routedChatModel(models)` serves several providers as one model, picked per request as "provider/model". Adapters can list the account's models live (`listModels`). Tool calls carry adapter `meta` so provider-specific state survives the agent loop.

Bring your own key: `createChatHandler(model, { userKeys })` accepts the user's provider and key per request (headers `x-ai-provider`, `x-ai-key`), builds a model for that request only and never stores the key; `providers`, `allowBaseUrl` and `required` control what's allowed, and `createChatHandler(null, { userKeys: true })` runs with no server key at all. The handler adds `GET {base}/models`; `remoteChatModel` takes `credentials` and exposes `listModels` and the server's `info`. `openAIChatModel` gains `maxTokensField` and `streamUsage` for compatible servers. The live evals run against any configured provider (`EVAL_PROVIDER`).

`@miraiclip/core`: `toToolDefinitions` takes `style: "gemini"` (function declarations with `parametersJsonSchema`); new `toolDefinition` helper and `ToolStyle` type. `@miraiclip/templates` (`toFieldToolDefinition`) and `@miraiclip/audio-sources` (`audioToolDefinitions`) take `style: "gemini"` too.
