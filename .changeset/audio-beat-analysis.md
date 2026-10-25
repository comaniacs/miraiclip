---
"@miraiclip/audio-sources": minor
---

Beat analysis, for timing motion to music:

- `analyzeBeats(audio)` returns the tempo, beat times, downbeats and a confidence. It takes mono samples, several channels or an `AudioBuffer`, in pure TypeScript.
- `decodeAndAnalyzeBeats(url | ArrayBuffer | Blob)` decodes with Web Audio first (browser only).
- `beatAlignment(times, beats)` gives the share of times within ±80 ms of a beat, and the ones that miss.
- `snapToBeat(t, beats)` returns the nearest beat.
