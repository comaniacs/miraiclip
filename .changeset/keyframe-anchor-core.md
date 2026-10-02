---
"@miraiclip/core": patch
---

End-anchored keyframes: `keyframe/set` and `keyframe/remove` accept `anchor: "end"`, measuring `timeUs` back from the clip's visible end so exit animations follow trims. Adds `resolveKeyframes` and `keyframeTimeUs`; `evaluateKeyframes` takes an optional clip duration (`evaluateClipAt`/`evaluateClipInto` pass it). `clip/split` keeps end-anchored keyframes on the right half only. `describeProject` marks properties with end-anchored keyframes.
