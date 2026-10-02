# @miraiclip/audio-sources

## 0.2.0

### Minor Changes

- a0f5dd4: AI generation with a vendor-neutral contract. `AudioGenerator` (kinds, models, voices, limits, a JSON-Schema `paramsSchema` for vendor-specific settings, output `terms`, and `generate(request, options)` returning bytes or a URL), with `GenerateRequest` for sfx / music / voice and `params` passed through untouched. `defineGenerator`, `startGeneration` / `library.generate` (cancellable `GenerationJob` with progress; output stored via `storeFile` and recorded with source + license), `createGeneratorHandler` (Fetch-API server handler) and `remoteGenerators` (browser proxies) keep keys server-side. Adapters: `elevenLabsGenerator` (sound effects, music, text-to-speech, voices) and an offline `toneGenerator`. New LLM tools `generate_audio` and `list_voices`. `createAudioLibrary(providers, { generators })`. Breaking: the unused placeholder `GenerateAudioRequest` / `AudioJob` types and `AudioProvider.generate` are removed.

## 0.1.0

### Minor Changes

- 451d2d5: New package: stock and library audio for Miraiclip. One `AudioProvider` contract (search, getItem, resolve; generation types for what comes next) with adapters for Openverse, Freesound, a static in-app catalog and any backend (`httpProvider`). `createAudioLibrary` groups providers; `importAudio` adds a file with its source, license and credit line as one undoable step on a free audio track; `audioToolDefinitions` / `runAudioTool` expose `search_audio` and `add_audio` to LLMs. `parseCreativeCommons` maps CC codes, names and deed URLs to `AssetLicense`.
