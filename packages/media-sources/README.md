# @miraiclip/media-sources

Stock photos and video for [Miraiclip](https://docs.miraiclip.com/):

- **Search**: one `MediaProvider` contract with Pexels and Pixabay adapters.
- **Mixed results**: `searchAll` / `createMediaLibrary` query every provider in parallel and interleave the answers; a provider that fails is reported, not fatal.
- **Import**: `importMedia` records source, license and credit line in one undoable step.

```sh
npm install @miraiclip/media-sources @miraiclip/core
```

```ts
import { createMediaLibrary, importMedia, pexelsProvider, pixabayProvider } from "@miraiclip/media-sources";

const library = createMediaLibrary([
  pexelsProvider({ apiKey: env.PEXELS_API_KEY }), // server-side
  pixabayProvider({ apiKey: env.PIXABAY_API_KEY }),
]);

const { items, failed } = await library.searchAll({ query: "neon city", kind: "video" });

// On import, look the item up again (never trust a client-sent item), copy the file
// into your own storage (libraries ask you not to hotlink), then add it.
const item = await library.item("pexels", "video", id);
const resolved = await library.get("pexels")!.resolve(item!);
importMedia(project, { ...resolved, src: await myStorage.copyFrom(resolved.src) });
```

Pexels and Pixabay ask you to show where results come from: render each provider's `notice` and `homepage` under the results.
