---
title: Export
weight: 5
---

Miraiclip exports the composition through the same compositor and decode
pipeline the preview uses — what you see is what you render, wherever it runs:

- **[Client side](client-side)** — `exportProject` in the user's browser: MP4/WebM via WebCodecs, faster than realtime, progress, cancellation, quality presets.
- **[Server side](server-side)** — `@miraiclip/server-export` runs the identical pipeline in headless Chrome from Node: pass a project document as JSON, get the encoded file. API + CLI.
