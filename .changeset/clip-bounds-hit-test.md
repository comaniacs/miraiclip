---
"@miraiclip/renderer": patch
---

Add `getClipBounds` and `hitTest` to the Compositor and the Player: where a clip is drawn (rotated content box in composition pixels, keyframes evaluated) and which clip is topmost under a point. This is the geometry an editor's on-canvas interaction layer needs — selection boxes, move/scale/rotate handles, click-to-select. Html clips report their painted content, not the transparent raster box. New optional `SceneNode.getLocalBounds` for custom backends.
