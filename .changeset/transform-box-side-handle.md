---
"@miraiclip/editor": minor
"@miraiclip/react": minor
---

Side handles for the transform box. `<TransformBox.SideHandle side="top|right|bottom|left" />` sits in the middle of a side and stretches only that axis of the clip (left and right its width, top and bottom its height, pivoting at the origin like the corner handles; one undo step; a mirrored clip stays mirrored). `@miraiclip/editor` exports the pieces for custom handles: `sideHandlePosition`, `sideDragMode`, `sideCursor` and the `TransformSide` type.
