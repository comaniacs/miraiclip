---
title: Audio Sources
weight: 10
---

Stock and AI-generated music, sound effects and voiceover for an editor: `@miraiclip/audio-sources` gives every audio source one contract, so the Audio panel, an AI assistant and the MCP server all search and add audio the same way. The package fetches nothing on its own; it calls providers through `fetch`, which you can route through your own backend. Adding a sound is ordinary core commands in one transaction, so undo, history and credits work as usual.

```sh
npm install @miraiclip/audio-sources
```

## Providers

| Adapter | What | Keys | Licenses |
| --- | --- | --- | --- |
| `staticProvider({ id, label, entries })` | Files you ship or host: a curated, cleared catalog (search ranks by matching title, creator and tag words) | none | whatever you set per entry |
| `openverseProvider({ baseUrl?, accessToken?, sources? })` | [Openverse](https://openverse.org): openly licensed audio from Freesound, Jamendo, Wikimedia Commons, ccMixter… | none (anonymous is rate-limited) | per item: CC0, CC BY, BY-SA, **BY-NC**… |
| `freesoundProvider({ token?, baseUrl? })` | [Freesound](https://freesound.org): sound effects and field recordings (MP3 previews) | API key | per item: CC0, CC BY, **BY-NC** |
| `httpProvider({ id, label, endpoint })` | Any service behind your backend, through a small JSON contract | yours | yours |

Every provider implements:

```ts
interface AudioProvider {
  id: string;
  label: string;
  capabilities: { search?: AudioKind[]; generate?: AudioKind[] }; // "music" | "sfx" | "voice"
  notice?: string;                                               // e.g. terms of use, shown in UIs
  search?(query: AudioQuery): Promise<AudioSearchResult>;
  getItem?(id: string): Promise<AudioItem | null>;
  resolve(item: AudioItem): Promise<ResolvedAudio>;              // playable src + source/license/attribution
}
```

An `AudioItem` carries `title`, `kind`, `durationUs`, `creator`, a `previewUrl` that a plain `<audio>` element can play, `landingUrl`, `license` (an `AssetLicense`, or `null` when unknown) and the `attribution` line. `AudioQuery` filters by `kind`, `commercialOnly` and min/max duration. Whatever a provider can't filter on its server is filtered on the page it returns.

## A library and an import

```ts
import { createProject } from "@miraiclip/core";
import { createAudioLibrary, importAudio, openverseProvider, staticProvider } from "@miraiclip/audio-sources";

const library = createAudioLibrary([
  staticProvider({ id: "house", label: "Our library", entries: [/* { id, title, src, kind, durationUs, license } */] }),
  openverseProvider({ baseUrl: "/api/openverse" }), // your proxy to https://api.openverse.org
]);

const { result } = (await library.searchAll({ query: "upbeat acoustic", kind: "music", commercialOnly: true }))[0]!;
const item = result!.items[0]!;
const resolved = await library.resolve(item);

// Copy remote files into your own storage first (stable URL, Range + CORS, no hotlinking):
const src = await myStorage.copyFrom(resolved.src);
importAudio(project, { ...resolved, src }, { atUs: 0, volume: 0.35, fadeInUs: 1_000_000, fadeOutUs: 2_000_000 });
```

`importAudio` dispatches `asset/add` (with `name`, `source`, `license`, `attribution`) and `clip/add` in **one transaction**. It places the clip on the first audio track that's free for its span, or creates one named "Music", "Sound effects" or "Voice". Credits and license checks then come from core: `creditsFor(doc)` and `licenseReport(doc, { commercial })` (see [Clips · Asset provenance](../core-concepts/clips#asset-provenance-and-licensing)).

## Generation

Generation services are `AudioGenerator`s: one vendor-neutral contract, with each service a small adapter. The package ships `elevenLabsGenerator` and an offline `toneGenerator` for tests. OpenAI, Google, ByteDance, a self-hosted open model or your own service are each a single `defineGenerator({...})`.

```ts
type GenerateRequest =
  | { kind: "sfx";   prompt: string; durationS?: number }
  | { kind: "music"; prompt: string; durationS?: number; instrumental?: boolean; lyrics?: string }
  | { kind: "voice"; text: string; voice?: string; language?: string; style?: string };

interface GenerateOptions {
  model?: string; seed?: number; format?: "mp3" | "wav" | "ogg" | "webm";
  params?: Record<string, unknown>;          // vendor-specific, passed through untouched
  signal?: AbortSignal; onProgress?: (p: { progress?: number; message?: string }) => void;
}

interface AudioGenerator {
  id: string; label: string; kinds: AudioKind[];
  models?: { id: string; label: string; kinds: AudioKind[] }[];
  voices?(): Promise<{ id: string; name: string; language?: string; previewUrl?: string }[]>;
  limits?: Partial<Record<AudioKind, { minDurationS?; maxDurationS?; maxPromptChars?; maxTextChars? }>>;
  paramsSchema?: Partial<Record<AudioKind, JSONSchemaObject>>; // the vendor's extra knobs
  terms: { license: AssetLicense; attribution?: string; notice?: string };
  generate(request: GenerateRequest, options: GenerateOptions): Promise<GeneratedAudio>; // bytes or { url }
}
```

The request carries the intent every vendor shares. Anything vendor-specific goes in `params`, and the adapter's `paramsSchema` describes it. UIs build their controls from that schema, and `generate_audio` builds its tool schema from it, so a new vendor knob needs no UI code. Vendors that answer immediately and vendors that run jobs look the same: `generate` polls or streams internally and reports `onProgress`.

```ts
import { createAudioLibrary, defineGenerator, elevenLabsGenerator, importAudio } from "@miraiclip/audio-sources";

const library = createAudioLibrary(providers, { generators: [elevenLabsGenerator({ apiKey, plan: "paid" })] });
const job = library.generate("elevenlabs", { kind: "sfx", prompt: "glass shattering", durationS: 2 }, {
  storeFile: (file, name) => myStorage.put(file, name), // durable URL for the asset
});
job.onChange((j) => console.log(j.status, j.progress));
const { resolved } = await job.result;                  // src, name, kind, durationUs, license, attribution, source
importAudio(project, resolved, { volume: 0.9 });
```

`startGeneration` (or `library.generate`) checks the request against the generator's kinds and limits. It turns any output shape into a stored file and records `source: { provider, id }` with the generator's terms as the license. If the vendor doesn't report a duration, it measures it with Web Audio, where that's available.

### Writing an adapter

```ts
const myTts = defineGenerator({
  id: "my-tts",
  label: "My TTS",
  kinds: ["voice"],
  terms: { license: { id: "MyTTS-Commercial", commercial: true, attributionRequired: false } },
  async generate(request, { model, params, signal }) {
    if (request.kind !== "voice") throw new Error("voice only");
    const res = await fetch("https://api.example.com/tts", {
      method: "POST", signal,
      headers: { Authorization: `Bearer ${process.env.MY_TTS_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: request.text, voice: request.voice, model: model ?? "default", ...params }),
    });
    if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
    return { data: await res.arrayBuffer(), mimeType: "audio/mpeg" };
  },
});
```

### Keys stay on the server

Run the real adapters in your backend and give the browser proxies with the same `AudioGenerator` shape:

```ts
// server (Fetch API: Node 18+, edge, Next, Hono; Express via an adapter)
const handle = createGeneratorHandler([elevenLabsGenerator({ apiKey: process.env.ELEVENLABS_API_KEY })], { basePath: "/api/generate" });
// handle(request: Request) → Promise<Response | null>

// browser
for (const g of await remoteGenerators("/api/generate")) library.addGenerator(g);
```

```text
GET  {base}/               → { generators: GeneratorInfo[] }          (kinds, models, limits, paramsSchema, terms)
GET  {base}/{id}/voices    → { voices }
POST {base}/{id}/generate  { request, options } → audio bytes (+ x-generation-id, x-model, x-duration-us, x-license, x-attribution)
```

Switching vendors is then a backend change only; the browser code stays the same.

### ElevenLabs

`elevenLabsGenerator({ apiKey?, baseUrl?, plan?, defaultVoiceId?, outputFormat? })` covers sound effects (`/v1/sound-generation`, 0.5–30 s), music (`/v1/music`, 3–600 s, `instrumental`; lyrics are appended to the prompt) and voice (`/v1/text-to-speech/{voice}`, with `voices()` from `/v2/voices`). Its `paramsSchema` exposes `prompt_influence` and `loop` (sfx) and `stability`, `similarity_boost`, `style` and `speed` (voice, sent as `voice_settings`). Any other ElevenLabs field passes through `params`, for example a music `composition_plan`.

`plan` sets the recorded terms:

- **`"free"`:** non-commercial, with the credit “Audio generated with ElevenLabs (elevenlabs.io)”.
- **`"paid"`:** commercial.

Confirm the current ElevenLabs terms for your use.

## AI tools

```ts
import { audioToolDefinitions, runAudioTool } from "@miraiclip/audio-sources";

const tools = audioToolDefinitions(library);               // search_audio, add_audio, + generate_audio, list_voices when generators exist
const out = await runAudioTool(call.name, call.input, {
  library,
  project,
  store: async (r) => ({ ...r, src: await myStorage.copyFrom(r.src) }), // library files
  storeFile: (file, name) => myStorage.put(file, name),                // generated files
  onGeneration: (job) => showProgress(job),
});
// → { ok: true, result: { items: [{ provider, id, title, kind, durationS, license, commercial }] } }
// → { ok: true, result: { assetId, clipId, trackId, title, license, credit? } }
```

`search_audio` and `generate_audio` list the configured providers and generators in their descriptions, including each generator's models and output license, so the model knows what it can use. `add_audio` takes the `provider` and `id` from a search result. `add_audio` and `generate_audio` take `replaceClipId` for "replace the music with…": the old clip is removed and the new one takes its track, start, length (capped by the new file) and volume, in one undo step. The library remembers items it has seen and falls back to `getItem`. Results are small JSON objects meant to go straight back to the model.

## Backend contract (`httpProvider`)

```text
GET  {endpoint}/search?q=&kind=&commercialOnly=&minDurationS=&maxDurationS=&page=&pageSize=  → AudioSearchResult
GET  {endpoint}/items/{id}                                                                  → AudioItem | 404
POST {endpoint}/resolve   { item }                                                          → ResolvedAudio
```

Use it for a commercial catalog, or for any provider whose keys must stay on the server.

## Licensing

Each item's `license` says what the file allows: `commercial` is false for any NC license, and `attributionRequired` is false only for CC0 and the Public Domain Mark. Two things are separate from an item's license:

- **API terms.** Freesound's API is free for non-commercial use only; a commercial product needs an agreement with Freesound, even for CC0 sounds. Openverse rate-limits anonymous use; register an app for higher limits.
- **Your product's obligations.** For commercial video, filter with `commercialOnly`. Show credits for attribution licenses (`creditsFor`), and check `licenseReport(doc, { commercial: true })` before export. For guaranteed clearance, use a licensed catalog through `httpProvider`.

This is not legal advice; check each source's terms for your use.
