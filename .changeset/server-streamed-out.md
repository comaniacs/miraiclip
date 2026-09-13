---
"@miraiclip/server-export": minor
---

Streamed output to disk: with `out` set, encoded chunks stream from the browser page to the output file as they are produced, so server memory stays flat for long exports (a failed export removes the partial file). Breaking for `out` callers: the result is now `{ filePath, bytesWritten }` — `bytes` is no longer returned there (read the file back if needed; without `out`, `{ bytes }` is unchanged). Progress events carry a live `bytesWritten`, and `audioChunkSeconds` passes through. The bundled harness inherits renderer 0.4.0 (streaming, chunked audio, pipeline fixes).
