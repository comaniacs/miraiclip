---
"@miraiclip/renderer": minor
---

Sequences: motion graphics as one timeline.

- `registerScriptedLibraries` makes libraries available to scripted html clips through `data-libs`. They're inlined in dependency order, with no network.
- `registerStageKit()` adds the stage kit (on anime.js v4, MIT). It provides:
  - `stage.build((tl, S) => …)` with `tl.to/from/fromTo/set/label/camera`;
  - stage-relative sizes (`S.w/h/min`), `S.split`, `S.rand(seed)` and music beats (`S.beat(n)`);
  - frame-exact seeking, and building after fonts load.
- `lintSequence(template)` checks a sequence before it renders: randomness, the clock, timers, network, infinite loops, viewport units, `position: fixed`, its shape, raw pixels and large blurred layers.
- Motion metrics measure how much rendered frames move: `lumaFrame`, `frameChange`, `changeSeries`, `motionMetrics` (density, median change, holds, jumps), `motionFindings` and `MOTION_TARGETS`.
- `rasterizeHtml({ software: true })` rasterizes on the CPU. It's exact for analysis and small previews, where some GPU rasterizers add tile artifacts to large blurred layers under 3D transforms.
- Scripted frames inject the template's `@font-face` before building, and wait for `__miraiclipReady`.
