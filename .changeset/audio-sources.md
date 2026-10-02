---
"@miraiclip/audio-sources": minor
---

New package: stock and library audio for Miraiclip. One `AudioProvider` contract (search, getItem, resolve; generation types for what comes next) with adapters for Openverse, Freesound, a static in-app catalog and any backend (`httpProvider`). `createAudioLibrary` groups providers; `importAudio` adds a file with its source, license and credit line as one undoable step on a free audio track; `audioToolDefinitions` / `runAudioTool` expose `search_audio` and `add_audio` to LLMs. `parseCreativeCommons` maps CC codes, names and deed URLs to `AssetLicense`.
