---
"@miraiclip/renderer": patch
---

Fix exports stalling (and drawing stale frames) at cuts between two clips of the same video. In the last second before the cut, the lookahead warmed the upcoming clip on the pipeline the on-screen clip was reading, so the two fought over one decoder's seek position: about 2s per frame with the CPU pegged. Upcoming clips no longer warm up on a shared pipeline that is in use; the cut now costs a single re-seek.
