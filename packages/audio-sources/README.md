# @miraiclip/audio-sources

Stock and library audio for [Miraiclip](https://comaniacs.github.io/miraiclip/): one `AudioProvider` contract with adapters for Openverse, Freesound, an in-app catalog and your own backend, a one-transaction `importAudio` that records source, license and credit line, and `search_audio` / `add_audio` tool definitions for LLMs.

```sh
npm install @miraiclip/audio-sources @miraiclip/core
```

```ts
import { createAudioLibrary, importAudio, openverseProvider } from "@miraiclip/audio-sources";

const library = createAudioLibrary([openverseProvider()]);
const [{ result }] = await library.searchAll({ query: "calm piano", kind: "music", commercialOnly: true });
const resolved = await library.resolve(result!.items[0]!);
importAudio(project, resolved, { atUs: 0, volume: 0.35 });
```

Docs: https://comaniacs.github.io/miraiclip/docs/audio-sources/ — including licensing notes (Freesound's API is for non-commercial use without an agreement; many Openverse items are NC).
