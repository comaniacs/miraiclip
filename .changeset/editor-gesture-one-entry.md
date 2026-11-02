---
"@miraiclip/editor": patch
---

`beginGesture` is one history entry for real. It now rides on core's `project.beginGesture` instead of committing and undoing an entry per update, so a drag no longer fires a `history` commit (and an undo) for every mouse move, and listeners see one `commit` when the gesture ends. New `Gesture.cancel()` reverts everything a gesture changed and leaves no entry (Esc during a drag). If an undo or redo closes the gesture midway, the next update opens a fresh one rather than writing outside any gesture. `beginTransformDrag`, `beginClipDrag` and `useGesture` get this with no change.
