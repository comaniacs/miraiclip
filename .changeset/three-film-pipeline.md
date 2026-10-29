---
"@miraiclip/renderer": minor
"@miraiclip/server-export": minor
"@miraiclip/assistant": patch
---

Faster, checkable 3D films.

- **ThreeKit**: a new scripted library, `three-kit` (`data-libs="stage three three-kit"`), defines a global `ThreeKit`. It includes constant-pixel-width lines that can be drawn to a moving head, glow sprites, GLSL simplex noise, `ThreeKit.shots` (one camera blended from several shots, on position and look-at point), `ThreeKit.place`, overlay helpers, and `ThreeKit.motionOf` / `ThreeKit.subjectOf` for the checks below. `THREE_KIT_SOURCE` is exported from `@miraiclip/renderer/stage`.
- **`tl.subject(name, fn, { from, to, minPx })`**: declares a painted subject the shot check keeps in frame. It reports when the subject leaves the frame or shrinks below `minPx`.
- **`tl.frame(fn, { hold: true })`**: the painter is called with the time at the start of the output frame (`data-fps`, default 30), so motion-blur samples of one frame agree, and type and counters no longer ghost.
- **`tl.rest`**: also fails when a `tl.frame` motion function reports movement inside the rest (`allow: ["frame"]` exempts it). The shot check warns (`rest-unverified`) when a painter has no motion function.
- **`miraiclip-export stills <project> --at 1,9.5,15 [--sheet]`**: frames from one warm browser.
- **`miraiclip-export check <project>`**: the continuous-shot check without the MCP server.
- **`miraiclip-export doctor`**: browser, ffmpeg and, inside the monorepo, stale generated bundles.
- **Export flags**: `--workers N` renders parallel chunks; `--motion-blur` turns on the default shutter.
- **`renderDistributed` takes `motionBlur`**: it applies to every video chunk.
