---
"@miraiclip/renderer": minor
"@miraiclip/react": minor
---

Transport: loop, speed and reverse live in the SDK. `Player` gains `setLoop` / `loop` (and a `loopchange` event) and `setRate` accepts a negative rate, which plays backwards without sound, stopping at 0 or wrapping to the end when looping; `createPlayer` takes a starting `rate`. `PreviewController` keeps `loop` and `rate` in its state with `setLoop` / `setRate`, so they survive `detach` / `attach` (a rebuilt player) and drive the clock-only fallback too. `usePlayback()` exposes `loop`, `rate`, `setLoop` and `setRate`.
