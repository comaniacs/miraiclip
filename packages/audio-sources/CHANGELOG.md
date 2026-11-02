# @miraiclip/audio-sources

## 0.4.2

### Patch Changes

- Updated dependencies [9ac0cee]
  - @miraiclip/core@0.10.0

## 0.4.1

### Patch Changes

- Updated dependencies [5fa8674]
  - @miraiclip/core@0.9.0

## 0.4.0

### Minor Changes

- 63276db: Beat analysis, for timing motion to music:
  
  - `analyzeBeats(audio)` returns the tempo, beat times, downbeats and a confidence. It takes mono samples, several channels or an `AudioBuffer`, in pure TypeScript.
  - `decodeAndAnalyzeBeats(url | ArrayBuffer | Blob)` decodes with Web Audio first (browser only).
  - `beatAlignment(times, beats)` gives the share of times within ±80 ms of a beat, and the ones that miss.
  - `snapToBeat(t, beats)` returns the nearest beat.

### Patch Changes

- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
  - @miraiclip/core@0.8.0

## 0.3.1

### Patch Changes

- 7477fe6: AI that works with any model provider, and with the user's own key.
  
  `@miraiclip/assistant`: native `anthropicChatModel` (Messages API, streaming, tool use, extended-thinking replay) and `geminiChatModel` (`generateContent`, streaming, full JSON Schema tools, thought signatures kept for tool calls) next to `openAIChatModel`. `createChatModel({ provider, apiKey, model })` builds any provider in the new `AI_PROVIDERS` catalog: OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, xAI, Together, Ollama, LM Studio and any OpenAI-compatible server. `chatModelsFromEnv(env)` sets up every provider whose `{PROVIDER}_API_KEY` is set (`_MODEL`, `_MODELS`, `_BASE_URL` too; `OPENAI_BASE_URL` keeps its meaning). `routedChatModel(models)` serves several providers as one model, picked per request as "provider/model". Adapters can list the account's models live (`listModels`). Tool calls carry adapter `meta` so provider-specific state survives the agent loop.
  
  Bring your own key: `createChatHandler(model, { userKeys })` accepts the user's provider and key per request (headers `x-ai-provider`, `x-ai-key`), builds a model for that request only and never stores the key; `providers`, `allowBaseUrl` and `required` control what's allowed, and `createChatHandler(null, { userKeys: true })` runs with no server key at all. The handler adds `GET {base}/models`; `remoteChatModel` takes `credentials` and exposes `listModels` and the server's `info`. `openAIChatModel` gains `maxTokensField` and `streamUsage` for compatible servers. The live evals run against any configured provider (`EVAL_PROVIDER`).
  
  `@miraiclip/core`: `toToolDefinitions` takes `style: "gemini"` (function declarations with `parametersJsonSchema`); new `toolDefinition` helper and `ToolStyle` type. `@miraiclip/templates` (`toFieldToolDefinition`) and `@miraiclip/audio-sources` (`audioToolDefinitions`) take `style: "gemini"` too.
- Updated dependencies [7477fe6]
  - @miraiclip/core@0.7.0

## 0.3.0

### Minor Changes

- fd07ee1: OpenAI speech generator and audio length from WAV/MP3 bytes; ElevenLabs voice clips report their duration.

### Patch Changes

- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
  - @miraiclip/core@0.6.0

## 0.2.1

### Patch Changes

- 51b81c7: `staticProvider` search ranks results by how many query words match the title, creator or tags, instead of requiring every word, and ignores words that only name the kind ("music", "sound", "track"). "calm ambient music" now finds a track tagged calm and ambient.
  
  `add_audio` and `generate_audio` take `replaceClipId`: the replaced clip is removed and the new one takes its track, start, length and volume, in one transaction.

## 0.2.0

### Minor Changes

- a0f5dd4: AI generation with a vendor-neutral contract. `AudioGenerator` (kinds, models, voices, limits, a JSON-Schema `paramsSchema` for vendor-specific settings, output `terms`, and `generate(request, options)` returning bytes or a URL), with `GenerateRequest` for sfx / music / voice and `params` passed through untouched. `defineGenerator`, `startGeneration` / `library.generate` (cancellable `GenerationJob` with progress; output stored via `storeFile` and recorded with source + license), `createGeneratorHandler` (Fetch-API server handler) and `remoteGenerators` (browser proxies) keep keys server-side. Adapters: `elevenLabsGenerator` (sound effects, music, text-to-speech, voices) and an offline `toneGenerator`. New LLM tools `generate_audio` and `list_voices`. `createAudioLibrary(providers, { generators })`. Breaking: the unused placeholder `GenerateAudioRequest` / `AudioJob` types and `AudioProvider.generate` are removed.

## 0.1.0

### Minor Changes

- 451d2d5: New package: stock and library audio for Miraiclip. One `AudioProvider` contract (search, getItem, resolve; generation types for what comes next) with adapters for Openverse, Freesound, a static in-app catalog and any backend (`httpProvider`). `createAudioLibrary` groups providers; `importAudio` adds a file with its source, license and credit line as one undoable step on a free audio track; `audioToolDefinitions` / `runAudioTool` expose `search_audio` and `add_audio` to LLMs. `parseCreativeCommons` maps CC codes, names and deed URLs to `AssetLicense`.
