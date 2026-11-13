---
"@miraiclip/core": minor
"@miraiclip/renderer": patch
---

`clip/replace-asset {clipId, assetId, trimStartUs?, crop?}`: point a video, audio or image clip at another asset of the same kind and keep everything else: place on the timeline, transform, crop, keyframes, effects, fades, speed and transitions. New footage starts at its beginning (or `trimStartUs`); a source too short for the clip shortens it. `crop: "reset"` drops the crop. One undo step. The renderer rebuilds the clip's scene node around the new asset and the audio engine reopens its source, so preview follows without a remount.
