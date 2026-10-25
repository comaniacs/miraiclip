# @miraiclip/audio-sources

Stock and AI-generated audio for [Miraiclip](https://docs.miraiclip.com/):

- **Search** — one `AudioProvider` contract with adapters for Openverse, Freesound, an in-app catalog and your own backend.
- **Generate** — sound effects, music and voiceover through one vendor-neutral `AudioGenerator` contract. Any service is a small adapter; `elevenLabsGenerator` ships first, plus an offline `toneGenerator`. `createGeneratorHandler` / `remoteGenerators` keep API keys on the server.
- **Import** — `importAudio` records source, license and credit line in one undoable step.
- **Beat analysis** — `analyzeBeats` finds the tempo, beats and downbeats of a track, so motion can land on the beat.
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

## Beat analysis

```ts
import { analyzeBeats, beatAlignment, decodeAndAnalyzeBeats } from "@miraiclip/audio-sources";

const grid = await decodeAndAnalyzeBeats(trackUrl); // browser: fetch + Web Audio decode
// or, with samples you decoded yourself: analyzeBeats({ samples, sampleRate })
grid.bpm; // 124
grid.beats; // [0.6, 1.084, 1.568, …] seconds
grid.downbeats; // every 4th beat, from the strongest low-frequency accent
grid.confidence; // 0–1; below about 0.3 the grid is a guess

beatAlignment([0.62, 2.0], grid.beats).share; // share of times within ±80 ms of a beat
```

How it works:

1. An onset envelope from band-wise spectral flux.
2. The tempo from the envelope's autocorrelation over 60–200 BPM, weighted towards 120.
3. Beats by dynamic programming, with the tempo refined from the beat times.

Half or double tempo is decided by the beats themselves. The slower reading wins when the points halfway between its beats are clearly weaker (they are subdivisions, such as eighth-note hi-hats). Otherwise the faster reading wins.

Limitations:

- Downbeats assume 4/4.
- The tempo is assumed steady: gradual drift is followed, but a tempo change mid-track or free rubato is not.
- Beat times sit within about 15 ms of the onsets, usually a few milliseconds early.

Docs: https://docs.miraiclip.com/creative/audio — providers, generators, writing an adapter, the server handler, and licensing notes (Freesound's API is for non-commercial use without an agreement; many Openverse items are NC; ElevenLabs output terms depend on your plan).
