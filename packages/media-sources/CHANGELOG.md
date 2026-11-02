# @miraiclip/media-sources

## 0.1.2

### Patch Changes

- Updated dependencies [9ac0cee]
  - @miraiclip/core@0.10.0

## 0.1.1

### Patch Changes

- Updated dependencies [5fa8674]
  - @miraiclip/core@0.9.0

## 0.1.0

### Minor Changes

- f4fc6a1: New package: stock photos and video for an editor.
  
  - One `MediaProvider` contract (`search`, `getItem`, `resolve`) with `pexelsProvider` and `pixabayProvider`. Keys stay on your server: adapters take `fetch` and a base URL.
  - `searchAll` / `createMediaLibrary` ask every provider that serves a kind in parallel, interleave the results, report providers that failed or timed out, and drop items without a license.
  - `getItem` looks an item up again by id, so a server never trusts a client-sent license or file URL.
  - `importMedia` adds the asset with source, license and credit line, plus a clip on a video track, in one undo step.

### Patch Changes

- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
  - @miraiclip/core@0.8.0
