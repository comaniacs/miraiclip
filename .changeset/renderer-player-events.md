---
"@miraiclip/renderer": minor
---

Player transport events and a framework-free preview controller.

- `player.on(type, listener)` with `play`, `pause` (`reason: "pause" | "ended"`), `ended`, `seek`, `ratechange` and `error`. UIs no longer need to poll `player.playing`. New `player.rate`.
- `createPreviewController(project, options)`: the preview half of an editor without a UI framework. It owns the canvas's renderer and player, a fallback clock when WebCodecs or WebGL is unavailable, StrictMode-safe attach/detach, devicePixelRatio output sizing with a per-preview decode cap, monitoring volume and mute, and GPU context loss → `reportMemoryPressure()`. State via `getState()` / `subscribe()`.
- Fix: a seek while paused no longer leaves an unhandled promise rejection when a clip's media fails to open (the failure still reaches `onError`).
