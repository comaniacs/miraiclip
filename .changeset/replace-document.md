---
"@miraiclip/core": minor
"@miraiclip/renderer": patch
---

`project.replaceDocument(document, { history })`: swap in another version of the document (a peer's edits, a server's copy, a rebase) and emit a `patches` event with source `"replace"`, one operation per changed clip, asset, track or transition and one for settings, so the renderer, audio and UI follow it. Setting `project.store` state directly emitted nothing, which left full-frame html clips (and every other node) laid out for the old composition size after a resized document was swapped in. `diffDocuments(from, to)` is exported for hosts that need the same patches. The compositor's `resync()` now also re-reads the composition size.
