---
"@miraiclip/renderer": minor
---

Public effect and transition registration: `registerEffectRenderer(kind, factory)` (custom effect kind → Pixi filter factory, params updated in place) and `registerTransitionRenderer(kind, renderer)` (custom transition kind → pure per-frame math over progress, composing opacity, directional reveal, pixel offset, and a full-composition overlay). Built-ins are expressed through the same contracts; custom kinds render identically in preview, browser export, and stills. Server and worker export remain built-in-kinds-only (renderers are functions and cannot cross a process/thread boundary).
