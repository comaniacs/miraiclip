---
"@miraiclip/core": minor
"@miraiclip/renderer": minor
"@miraiclip/editor": patch
"@miraiclip/assistant": patch
"@miraiclip/server-export": patch
---

Outline and shadow / glow on text clips. `TextClip` takes the optional `strokeColor`, `strokeWidthFrac`, `shadowColor`, `shadowBlurFrac` and `shadowOffsetFrac` that caption styles already had (new shared `TextDecoration` type): set with `clip/add` or `clip/set-property`, where `null` removes a field; sizes are fractions of the font size and an offset of 0 is a glow. Documents that never use them are unchanged. The preview and the worker and server exports draw them through the same code as captions. `addTextClip` and the `setClipProperty` patch type in `@miraiclip/editor` accept the fields, and the assistant's command reference lists them.
