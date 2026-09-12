---
"@miraiclip/core": minor
---

v4 creative-features model: per-property keyframe animation with cubic-bezier easings and a pure, alloc-free evaluator (`evaluateClipAt`/`evaluateClipInto`); per-clip effect stacks (`effect/add|update|remove|reorder`) with built-in Zod param schemas (colorAdjust, blur, chromaKey); transitions on the adjacent-clips + trim-handles model (`transition/add|update|remove` with adjacency and source-headroom validation; crossDissolve, dipToBlack, dipToWhite, wipe, slide); the `caption` clip kind with word-level timing and style presets; font assets (`kind: "font"`); SRT/VTT and ASR word-timestamp caption import producing plain commands; `registerClipKind`/`registerEffectKind`/`registerTransitionKind` extension seams and exported clip type guards. Existing documents hydrate unchanged (schemaVersion stays 1).
