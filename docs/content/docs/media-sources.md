---
title: Media Sources
weight: 11
---

Stock photos and video for an editor: `@miraiclip/media-sources` gives every library one contract, so a media panel, an AI assistant and a server import all search and add stock the same way. The package fetches nothing on its own; adapters call providers through `fetch` and a base URL you can route through your own backend, which keeps API keys server-side. (Stock audio has its own package: [Audio Sources](audio-sources).)

```sh
npm install @miraiclip/media-sources
```

## Providers

| Adapter | What | Notes |
| --- | --- | --- |
| `pexelsProvider({ apiKey })` | [Pexels](https://www.pexels.com) photos and video | Pexels License; imports the largest MP4 up to 1080p |
| `pixabayProvider({ apiKey })` | [Pixabay](https://pixabay.com) photos and video | Pixabay Content License; imports the medium rendition (standard keys: 1280 px photos) |

```ts
interface MediaProvider {
  id: string;
  label: string;
  capabilities: { search: ("photo" | "video")[] };
  notice?: string;   // show under results
  homepage?: string;
  search(query: { query: string; kind; page?; pageSize?; signal? }): Promise<{ items; page; hasMore }>;
  getItem(kind, id): Promise<MediaItem | null>;
  resolve(item): Promise<ResolvedMedia>; // file URL plus provenance
}
```

## Mixed search

`searchAll(providers, query)` (or `createMediaLibrary(providers).searchAll`) asks every provider that serves the kind for the same page, interleaves the lists, and returns `providers` (who answered) and `failed` (who didn't, and why). Each call is limited to 8 seconds by default. Items without a license are dropped.

## Importing

`getItem` looks an item up again by id: a server should import from that, never from an item a client sent. `resolve` returns the provider's file URL; libraries ask you not to hotlink, so copy it into your own storage and import the copy:

```ts
const resolved = await provider.resolve(item);
importMedia(project, { ...resolved, src: storedUrl }, { atUs: 0 });
```

`importMedia` adds the asset with `source`, `license` and `attribution`, then a clip on the first free video track (a new "Stock" track if none is free), in one transaction: one undo step. Photos become 5 second image clips; videos use their own length. Pass `assetOnly: true` to add just the asset.
