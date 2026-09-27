---
"@miraiclip/server-export": patch
---

Harness rebuilt with the typography-aware renderer: server exports, render sessions, and export sessions (and so `@miraiclip/templates` batches and MCP previews) render text and caption `fontWeight`, `fontStyle`, `lineHeight`, `letterSpacing`, and `textAlign`, and load font assets per weight/style face.
