---
"@miraiclip/core": minor
"@miraiclip/renderer": minor
"@miraiclip/editor": patch
---

Track volume: `Track.volume` (a gain, 0..4, absent = 1) set with `track/set-property {volume}`. Preview and export multiply it into every clip on the track through the shared gain math, so clip volumes, volume keyframes and fades stay their own. `1` clears it (documents stay minimal). `setTrackProperty` in `@miraiclip/editor` takes `volume`.
