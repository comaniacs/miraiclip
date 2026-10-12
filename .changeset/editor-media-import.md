---
"@miraiclip/editor": patch
---

Browser helpers for media import: `probeMediaFile(file)` reads a picked or dropped file's kind, duration, size and a thumbnail (with an object URL as `src`), and `isSourceReachable(src)` tells whether a saved project's media can still be fetched. Both touch the DOM only when called; the rest of the package still runs without one.
