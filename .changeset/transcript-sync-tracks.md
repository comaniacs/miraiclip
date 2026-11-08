---
"@miraiclip/transcript": minor
---

`syncTracks` option for `cutCommands` (and so `removeWords`, `editByText`, `planCleanup`) and `restoreWords`: every other unlocked track keeps in sync with the cut media, so a voice-over, title or music laid over the speech stays with what it was laid on. After a cut, clips that start after it move left as far as fits; a clip straddling the cut stays and holds its track's later clips back. A restore moves them right again. `{ exclude: [...] }` keeps chosen tracks still. Off by default.
