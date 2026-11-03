---
"@miraiclip/core": minor
"@miraiclip/renderer": minor
"@miraiclip/assistant": minor
"@miraiclip/server-export": patch
---

Blur and Typewriter animations. Keyframes can now animate two more properties: `blur` (a blur over the whole clip, as a fraction of the frame height, 0–0.25, resting at 0) and `reveal` (the share of a text clip's characters that show, 0–1, text clips only, resting at 1). Two animation presets use them: **Blur** (In and Out, on any visual clip: it sharpens as it comes in and softens as it leaves, fading with it) and **Typewriter** (In, text clips only: the characters appear one after another at a steady pace, and the text keeps its final layout while it types). Presets stay plain keyframes, so `readAnimation` recognizes them and the preview and the worker and server exports play them with no extra support; `AnimationPreset` gains `linearOnly` and `kinds`, with `presetAppliesTo(preset, clip)` and `BLUR_ANIMATION_PEAK` exported. The renderer's `Placement` gains optional `blurPx` and `reveal`. Documents that never use them are unchanged. The assistant's animate tool offers both and says plainly when Typewriter is asked of a clip that is not text.
