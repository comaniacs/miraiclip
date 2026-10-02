# @miraiclip/audio-sources

Stock and AI-generated audio for [Miraiclip](https://comaniacs.github.io/miraiclip/):

- **Search** — one `AudioProvider` contract with adapters for Openverse, Freesound, an in-app catalog and your own backend.
- **Generate** — sound effects, music and voiceover through one vendor-neutral `AudioGenerator` contract. Any service is a small adapter; `elevenLabsGenerator` ships first, plus an offline `toneGenerator`. `createGeneratorHandler` / `remoteGenerators` keep API keys on the server.
- **Import** — `importAudio` records source, license and credit line in one undoable step.
- **AI tools** — `search_audio`, `add_audio`, `generate_audio`, `list_voices` tool definitions for LLMs.

```sh
npm install @miraiclip/audio-sources @miraiclip/core
```

```ts
import { createAudioLibrary, elevenLabsGenerator, importAudio, openverseProvider } from "@miraiclip/audio-sources";

const library = createAudioLibrary([openverseProvider()], {
  generators: [elevenLabsGenerator({ apiKey: process.env.ELEVENLABS_API_KEY, plan: "paid" })], // server-side
});

// Search…
const [{ result }] = await library.searchAll({ query: "calm piano", kind: "music", commercialOnly: true });
importAudio(project, await library.resolve(result!.items[0]!), { atUs: 0, volume: 0.35 });

// …or generate.
const { resolved } = await library.generate("elevenlabs", { kind: "sfx", prompt: "glass shattering", durationS: 2 }, {
  storeFile: (file, name) => myStorage.put(file, name),
}).result;
importAudio(project, resolved);
```

Docs: https://comaniacs.github.io/miraiclip/docs/audio-sources/ — providers, generators, writing an adapter, the server handler, and licensing notes (Freesound's API is for non-commercial use without an agreement; many Openverse items are NC; ElevenLabs output terms depend on your plan).
