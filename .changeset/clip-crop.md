---
"@miraiclip/core": minor
"@miraiclip/renderer": minor
"@miraiclip/server-export": patch
---

Crop for video and image clips. `VideoClip` and `ImageClip` take an optional `crop` (`{ x, y, width, height }`, fractions of the source from its top-left, staying inside the picture), set with `clip/add` or `clip/set-property` (`null` clears it; `crop` on any other clip kind is rejected with `not-media`). A whole-picture crop is not stored, so documents that never crop are unchanged. The preview and the worker/server exports draw only the cropped part, and for video it is the cropped part that is fitted to the frame. Everything else (transform, effects, animation) applies to the cropped clip.
