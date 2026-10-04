---
"@miraiclip/core": patch
---

Exact frame rates and a frame mapping that round-trips. `ProjectSettings.frameRate` stores the rate as a ratio (`{ num: 30000, den: 1001 }` for 29.97); `createProject` and `project/set-settings` store decimal NTSC rates exactly and keep `fps` in sync, and `project/set-settings` takes `frameRate`. `frameToUs` now returns the first whole µs inside the frame (⌈n·1e6·den/num⌉) and `usToFrame` floors, in exact integer math, so `usToFrame(frameToUs(n)) === n` for every frame (before, a third of frames at 30 / 29.97 fps mapped back one early). New: `toFrameRate`, `projectFrameRate`, `formatFrameRate`, `frameCount`, and `usToTimecode(us, rate, { dropFrame: true })`.
