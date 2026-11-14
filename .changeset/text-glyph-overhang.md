---
"@miraiclip/renderer": patch
---

Fix: script and display fonts were cut off at the edge of a text clip. Pixi sizes the text canvas from the font's nominal box, and faces like Passions Conflict draw outside it (a swash left of the origin, a tail past the advance, a descender below the line), so the left of an "A" and the tail of a "g" were clipped. A text clip now measures how far its real glyphs reach past that box (the 2D canvas's actual bounding boxes) and adds that much padding. Fonts that stay inside their box measure 0, so their layout, bounds and golden frames are unchanged; a face with overhang gets a selection box that is that much larger. New real-browser test draws Passions Conflict and compares the ink with the same text on a 2D canvas.
