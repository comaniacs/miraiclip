---
"@miraiclip/renderer": minor
"@miraiclip/assistant": minor
---

3D in scripted sequences. `three` is now a registered scripted library: `data-libs="stage three"` gives a sequence a global `THREE` (three.js 0.170 with `RoundedBoxGeometry`, `RoomEnvironment` and `mergeGeometries`), bundled so it renders with no network. Draw the scene inside `tl.frame((t) => …)`; `tl.frame(fn, { motion })` reports how far the picture moves between two times so motion blur can size its samples. A template can ask for slower frames with `data-frame-timeout="<seconds>"` on its root (raises the 10 s per-frame limit, up to 10 minutes; `frameTimeoutMs` is exported). `lintSequence` adds `three-clock` (no `setAnimationLoop`, `THREE.Clock` or `getDelta`). The renderer exports `THREE_SOURCE` and `THREE_VERSION` from `@miraiclip/renderer/stage`.
