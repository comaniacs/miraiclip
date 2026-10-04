---
"@miraiclip/renderer": patch
---

Export frames follow the core frame rule. `exportComposition` / `exportProject` take `fps` as a number or an exact `{ num, den }` (default: the project's exact rate via `projectFrameRate`), and compute every frame's start, duration and count with core's `frameToUs` / `frameCount` — the same mapping in the main-thread, worker and headless (server-export) paths. Frame starts move by at most 1 µs (frame 1 at 30 fps is 33,334 µs). `StepClock.step` now derives the next frame start from the frame index instead of adding a rounded frame length (which drifted ~1 frame per hour at 30 fps). New: `exportFrameWindow(n, startUs, endUs, fps)`. Requires @miraiclip/core 0.5.8.
