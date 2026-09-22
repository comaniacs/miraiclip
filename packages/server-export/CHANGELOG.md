# @miraiclip/server-export

## 0.3.0

### Minor Changes

- fc2827e: Still-frame rendering: `renderProjectStill(project, { timeUs, width?, height? })` in the renderer renders one composition frame to an image through the exact export pipeline, and `createRenderSession()` in server-export keeps one warm headless Chrome across calls so a frame costs a frame, not a browser launch. Also fixes `exportProject`'s `width`/`height` output-size option, which was silently ignored (the compositor resized the canvas back to the composition size): the compositor gained `outputSize` (backends: optional `setOutputSize`), so exports and stills now honor a requested output size while composition coordinates stay unchanged.

## 0.2.1

### Patch Changes

- Updated dependencies [34a0d60]
  - @miraiclip/core@0.3.0

## 0.2.0

### Minor Changes

- e9f8d0a: Streamed output to disk: with `out` set, encoded chunks stream from the browser page to the output file as they are produced, so server memory stays flat for long exports (a failed export removes the partial file). Breaking for `out` callers: the result is now `{ filePath, bytesWritten }` — `bytes` is no longer returned there (read the file back if needed; without `out`, `{ bytes }` is unchanged). Progress events carry a live `bytesWritten`, and `audioChunkSeconds` passes through. The bundled harness inherits renderer 0.4.0 (streaming, chunked audio, pipeline fixes).

## 0.1.1

### Patch Changes

- Updated dependencies [260cf57]
  - @miraiclip/core@0.2.0

## 0.1.0

### Minor Changes

- 8ba7909: First release: server-side export from Node. `exportProjectFile(doc, options)` and the `miraiclip-export` CLI run the browser's own `exportProject` in headless Chrome — pixel-identical to preview by construction. Self-contained harness bundle (core + renderer baked in), loopback media server with Range support, asset path mapping, progress + AbortSignal across the process boundary, system-Chrome resolution via playwright-core (real Chrome recommended; free Chromium is WebM-only).
