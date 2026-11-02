---
"@miraiclip/core": minor
"@miraiclip/renderer": minor
"@miraiclip/editor": minor
"@miraiclip/server-export": patch
---

Stretch and flip. A clip's `transform` takes optional `scaleX` and `scaleY` (default 1, multiplied with `scale`; negative mirrors the content, 0 is rejected; not animatable). They are set with `clip/add` / `clip/set-property` like the other transform fields, and documents that never use them are unchanged: a value of 1 is not stored. The preview, worker export and server export draw them the same way, `getClipBounds` / `hitTest` follow them (`ClipBounds` and `Placement` gain optional `scaleX` / `scaleY`), and `EvaluatedClip` carries them. `@miraiclip/editor` adds the `stretch-x` and `stretch-y` modes to `beginTransformDrag` for side handles: the pointer's distance along the clip's own axis scales only that axis (pivoting at the origin like `scale`), never flips through the origin, keeps a mirrored clip mirrored, and is one undo step.
