---
"@miraiclip/renderer": minor
---

Renders the whole effect library as built-ins: data-driven GLSL shaders (uniforms generated from core's catalog params; GLSL ES 1.00-compatible), Pixi color-matrix looks, and seeded film grain. Built-in means registered in every bundle, so all 79 kinds render in preview, browser and worker export, server export and stills. New `renderEffectThumbnails(options)` renders each kind's real filter over a sample image on its own offscreen renderer, for effect pickers.
