---
"@miraiclip/audio-sources": patch
---

`staticProvider` search ranks results by how many query words match the title, creator or tags, instead of requiring every word, and ignores words that only name the kind ("music", "sound", "track"). "calm ambient music" now finds a track tagged calm and ambient.

`add_audio` and `generate_audio` take `replaceClipId`: the replaced clip is removed and the new one takes its track, start, length and volume, in one transaction.
