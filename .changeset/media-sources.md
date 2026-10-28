---
"@miraiclip/media-sources": minor
---

New package: stock photos and video for an editor.

- One `MediaProvider` contract (`search`, `getItem`, `resolve`) with `pexelsProvider` and `pixabayProvider`. Keys stay on your server: adapters take `fetch` and a base URL.
- `searchAll` / `createMediaLibrary` ask every provider that serves a kind in parallel, interleave the results, report providers that failed or timed out, and drop items without a license.
- `getItem` looks an item up again by id, so a server never trusts a client-sent license or file URL.
- `importMedia` adds the asset with source, license and credit line, plus a clip on a video track, in one undo step.
