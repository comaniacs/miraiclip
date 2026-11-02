# @miraiclip/templates

## 0.1.10

### Patch Changes

- Updated dependencies [8399f44]
  - @miraiclip/core@0.11.0
  - @miraiclip/server-export@0.7.3

## 0.1.9

### Patch Changes

- Updated dependencies [9ac0cee]
  - @miraiclip/core@0.10.0
  - @miraiclip/server-export@0.7.2

## 0.1.8

### Patch Changes

- Updated dependencies [5fa8674]
  - @miraiclip/core@0.9.0
  - @miraiclip/server-export@0.7.1

## 0.1.7

### Patch Changes

- Updated dependencies [dedf3d8]
  - @miraiclip/server-export@0.7.0

## 0.1.6

### Patch Changes

- Updated dependencies [1240743]
- Updated dependencies [02fa701]
- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
  - @miraiclip/server-export@0.6.0
  - @miraiclip/core@0.8.0

## 0.1.5

### Patch Changes

- 7477fe6: AI that works with any model provider, and with the user's own key.
  
  `@miraiclip/assistant`: native `anthropicChatModel` (Messages API, streaming, tool use, extended-thinking replay) and `geminiChatModel` (`generateContent`, streaming, full JSON Schema tools, thought signatures kept for tool calls) next to `openAIChatModel`. `createChatModel({ provider, apiKey, model })` builds any provider in the new `AI_PROVIDERS` catalog: OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, xAI, Together, Ollama, LM Studio and any OpenAI-compatible server. `chatModelsFromEnv(env)` sets up every provider whose `{PROVIDER}_API_KEY` is set (`_MODEL`, `_MODELS`, `_BASE_URL` too; `OPENAI_BASE_URL` keeps its meaning). `routedChatModel(models)` serves several providers as one model, picked per request as "provider/model". Adapters can list the account's models live (`listModels`). Tool calls carry adapter `meta` so provider-specific state survives the agent loop.
  
  Bring your own key: `createChatHandler(model, { userKeys })` accepts the user's provider and key per request (headers `x-ai-provider`, `x-ai-key`), builds a model for that request only and never stores the key; `providers`, `allowBaseUrl` and `required` control what's allowed, and `createChatHandler(null, { userKeys: true })` runs with no server key at all. The handler adds `GET {base}/models`; `remoteChatModel` takes `credentials` and exposes `listModels` and the server's `info`. `openAIChatModel` gains `maxTokensField` and `streamUsage` for compatible servers. The live evals run against any configured provider (`EVAL_PROVIDER`).
  
  `@miraiclip/core`: `toToolDefinitions` takes `style: "gemini"` (function declarations with `parametersJsonSchema`); new `toolDefinition` helper and `ToolStyle` type. `@miraiclip/templates` (`toFieldToolDefinition`) and `@miraiclip/audio-sources` (`audioToolDefinitions`) take `style: "gemini"` too.
- Updated dependencies [7477fe6]
  - @miraiclip/core@0.7.0
  - @miraiclip/server-export@0.5.1

## 0.1.4

### Patch Changes

- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
  - @miraiclip/core@0.6.0
  - @miraiclip/server-export@0.5.0

## 0.1.3

### Patch Changes

- 1ff5fe5: Html clips that draw media inside their markup (`asset:<id>`) now survive insertion: `insertCommands`/`insertDocument` rewrite those references when an asset is renamed or reused, and `suggestTemplateFields` offers media used only that way as a slot.
- @miraiclip/server-export@0.4.3

## 0.1.2

### Patch Changes

- ee1db76: Templates for editors: `suggestTemplateFields` lists what in a finished project could stay editable (texts, html-clip params with colors detected, media used by clips), and `templateFromDocument` turns the chosen ones into optional fields defaulting to their current values ("Save as template"). `insertDocument` / `insertCommands` add a hydrated template to an existing project at a time, as one undo step: new tracks on top, every id remapped, keyframes, effects and transitions carried over, matching media and fonts reused. `fitClipsToMedia` shortens clips that would overrun shorter swapped-in media and fits transitions to the footage left around each cut. Templates take optional `category`, `tags` and `thumbnail`; fields take an optional `label`.

## 0.1.1

### Patch Changes

- Updated dependencies [880ad42]
  - @miraiclip/core@0.5.0
  - @miraiclip/server-export@0.4.1

## 0.1.0

### Minor Changes

- 399ef67: New package — parameterized videos: a template project + a data payload → a hydrated document → export. `defineTemplate`/`parseTemplate` (declared fields + `{{placeholder}}` binding into text clips, caption words, and html-clip params; asset slots swap an asset's src; coherence checked up front), pure deterministic `hydrate`/`tryHydrate` with machine-readable failures, `extractFields`, `describeTemplate`, and `toFieldToolDefinition` (the field schema as an Anthropic/OpenAI tool an agent fills). Batch rendering at `@miraiclip/templates/render` (`renderTemplateBatch` over warm export sessions, per-row results, `{field}` output naming, concurrency) and a `miraiclip-templates` CLI taking JSON/NDJSON/CSV rows.

### Patch Changes

- Updated dependencies [399ef67]
  - @miraiclip/server-export@0.4.0
