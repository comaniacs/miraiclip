---
"@miraiclip/renderer": patch
"@miraiclip/server-export": patch
---

Fix: a text clip with a Typewriter animation reported a wrong box. While it was typing, `getClipBounds` / `hitTest` covered only the typed part, and before the first character it stretched to about 100,000 px, so the editor's selection box ran off the screen. The box is now always the whole text, and the Typewriter mask sits beside the text in the stage (like the wipe's mask) instead of inside it, which also removes a Pixi deprecation warning. New real-browser test (`pnpm test:browser`) measures the box at several moments.
