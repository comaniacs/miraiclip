---
"@miraiclip/editor": minor
---

Preview transforms and per-track cuts, with no DOM. `beginTransformDrag(project, bounds, "move" | "scale" | "rotate", start, options)` moves, scales or rotates a clip from where the renderer draws it (`ClipBounds` fits as is): moves snap to the frame's edges and center and return the guides to draw, rotation snaps to right angles (15° steps with Shift), and the whole drag is one undo step. `writeClipTransform` writes keyframes at the playhead for animated properties and static values otherwise; `nudgeClip`, `canTransformClip`, `rotateHandlePosition`, `cornerCursor` and `snapOffset` cover the rest of a transform box. `trackCuts(clips, transitions)` lists one track's cuts and their transitions, for timeline markers.
