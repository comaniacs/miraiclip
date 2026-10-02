---
title: Audio Sources
weight: 10
---

Stock music and sound effects for an editor: `@miraiclip/audio-sources` gives every audio source one contract, so the Audio panel, an AI assistant and the MCP server all search and add audio the same way. The package fetches nothing on its own; it calls providers through `fetch`, which you can route through your own backend. Adding a sound is ordinary core commands in one transaction, so undo, history and credits work as usual.

```sh
npm install @miraiclip/audio-sources
```

## Providers

| Adapter | What | Keys | Licenses |
| --- | --- | --- | --- |
| `staticProvider({ id, label, entries })` | Files you ship or host: a curated, cleared catalog | none | whatever you set per entry |
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
  generate?(request: GenerateAudioRequest): AudioJob;            // generation (coming next)
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

## AI tools

```ts
import { audioToolDefinitions, runAudioTool } from "@miraiclip/audio-sources";

const tools = audioToolDefinitions(library);               // search_audio, add_audio (Anthropic shape; { style: "openai" } too)
const out = await runAudioTool(call.name, call.input, {
  library,
  project,
  store: async (r) => ({ ...r, src: await myStorage.copyFrom(r.src) }),
});
// → { ok: true, result: { items: [{ provider, id, title, kind, durationS, license, commercial }] } }
// → { ok: true, result: { assetId, clipId, trackId, title, license, credit? } }
```

`search_audio` lists the configured providers in its description, so the model knows what it can search. `add_audio` takes the `provider` and `id` from a search result. The library remembers items it has seen and falls back to `getItem`. Results are small JSON objects meant to go straight back to the model.

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
