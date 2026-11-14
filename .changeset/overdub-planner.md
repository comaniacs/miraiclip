---
"@miraiclip/transcript": minor
---

Add `overdubSlot` and `planOverdub`: replace spoken words with new speech in place. The old words are muted (the clip is split around them, nothing else moves) and the take goes on its own audio track in their room, sped up by at most `maxSpeedup` and refused with `OverdubPlanError("too_long")` beyond that. Limits, fades and the track are options (`OVERDUB_DEFAULTS`).
