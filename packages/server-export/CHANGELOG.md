# @miraiclip/server-export

## 0.1.0

### Minor Changes

- 8ba7909: First release: server-side export from Node. `exportProjectFile(doc, options)` and the `miraiclip-export` CLI run the browser's own `exportProject` in headless Chrome — pixel-identical to preview by construction. Self-contained harness bundle (core + renderer baked in), loopback media server with Range support, asset path mapping, progress + AbortSignal across the process boundary, system-Chrome resolution via playwright-core (real Chrome recommended; free Chromium is WebM-only).
