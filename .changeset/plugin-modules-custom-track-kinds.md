---
"@miraiclip/core": patch
"@miraiclip/renderer": minor
---

Two fixes for hosts with custom clip kinds. `clip/move` and `clip/duplicate` onto another track now check a registered custom kind against its own `trackKinds` (as `clip/add` already did) instead of the built-in table, which rejected every custom kind with `kind-mismatch`. `loadDocumentPlugins` takes `importModule(source, ref)`: a page whose Content Security Policy forbids importing from a `data:` URL (`script-src 'self'`) returns a module it bundled itself, after the SDK has fetched the source and checked its integrity hash.
