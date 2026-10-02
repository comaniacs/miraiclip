---
"@miraiclip/audio-sources": minor
---

AI generation with a vendor-neutral contract. `AudioGenerator` (kinds, models, voices, limits, a JSON-Schema `paramsSchema` for vendor-specific settings, output `terms`, and `generate(request, options)` returning bytes or a URL), with `GenerateRequest` for sfx / music / voice and `params` passed through untouched. `defineGenerator`, `startGeneration` / `library.generate` (cancellable `GenerationJob` with progress; output stored via `storeFile` and recorded with source + license), `createGeneratorHandler` (Fetch-API server handler) and `remoteGenerators` (browser proxies) keep keys server-side. Adapters: `elevenLabsGenerator` (sound effects, music, text-to-speech, voices) and an offline `toneGenerator`. New LLM tools `generate_audio` and `list_voices`. `createAudioLibrary(providers, { generators })`. Breaking: the unused placeholder `GenerateAudioRequest` / `AudioJob` types and `AudioProvider.generate` are removed.
