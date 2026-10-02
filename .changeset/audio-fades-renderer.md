---
"@miraiclip/renderer": patch
---

Clip fades (`fadeInUs` / `fadeOutUs`) are applied in live playback and in the export mix through the shared gain math, as exact linear ramps. New `computeWaveformPeaks` (streamed max-abs peaks per asset), `peaksForRange` and `accumulatePeaks` for drawing waveforms, plus `clipFades` / `fadeGainAt` for fade handles.
