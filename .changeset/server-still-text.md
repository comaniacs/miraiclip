---
"@miraiclip/server-export": minor
---

Render sessions can now build vector PDFs. `renderStill` takes `omitClipIds`, which leaves those clips out of the picture. The new `session.describeStillText(doc, { timeUs, width?, height? })` returns the frame's text, laid out by the canvas's own metrics (lines, font, color, transform, and why a text must stay in the picture). The harness bundle now carries renderer 0.19.
