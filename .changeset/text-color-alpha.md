---
"@miraiclip/renderer": patch
"@miraiclip/server-export": patch
---

A `#rrggbbaa` or `#rgba` outline or shadow / glow color on text clips and captions now draws with its alpha (it was drawn opaque: Pixi takes the alpha separately). Opaque colors draw as before, so existing documents only change where a translucent color was already written, such as the `#000000cc` caption shadows in the registry presets, which now look as written.
