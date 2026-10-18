---
title: Server side
weight: 2
---

`@miraiclip/server-export` runs [`exportProject`](../client-side) on a server: pass a project **document as JSON** from Node, and the package launches headless Chrome, hydrates the project in a harness page, and runs the exact same export pipeline the browser uses. That identity is the design — the server cannot render differently from the preview, because it runs the preview's code.

```ts
import { exportProjectFile } from "@miraiclip/server-export";

const { filePath, bytesWritten } = await exportProjectFile(doc, {
  format: "mp4",
  quality: "high",
  out: "render/final.mp4", // streams to disk as it encodes
  assets: { media: "./media/interview.mp4" }, // asset id → local file
  onProgress: (p) => console.log(p.phase, p.framesDone, "/", p.totalFrames),
});
```

Or from the command line:

```sh
miraiclip-export project.json --out final.mp4 --quality high \
  --asset media=./media/interview.mp4
```

## Try it

The repo ships a runnable example — a ready-made `project.json` (the e2e
fixture video plus a text overlay), the CLI invocation, and a Node script:
[`examples/server-export`](https://github.com/comaniacs/miraiclip/tree/main/examples/server-export).

## Warm sessions

`exportProjectFile` launches a browser per call — right for one render, wasteful for many. The session APIs keep ONE headless Chrome + harness page alive across calls, so a call costs its render, not a ~1-2s browser launch. Documents are passed per call (a session outlives edits), calls queue on the page, and a failed call never wedges the session:

```ts
import { createExportSession, createRenderSession } from "@miraiclip/server-export";

// Exports: exportFile takes the same options and returns the same result as
// exportProjectFile — assets/assetsDir/browser move to the session.
const exporter = await createExportSession({ assetsDir: "./media" });
await exporter.exportFile(docA, { format: "mp4", quality: "high", out: "out/a.mp4" });
await exporter.exportFile(docB, { format: "mp4", quality: "high", out: "out/b.mp4" });
await exporter.close();

// Stills: one frame as a PNG, through the exact export pipeline (~100ms warm).
const stills = await createRenderSession({ assetsDir: "./media" });
const png = await stills.renderStill(docA, { timeUs: 2_000_000, width: 640, height: 360 });
await stills.close();
```

`createExportSession` is the batch engine behind [templates](../../templates); `createRenderSession` powers the [MCP server](../../mcp-server)'s `preview_frame`.

## Distributed rendering

Long or urgent exports can be split across many machines. `renderDistributed` cuts the range into frame-aligned video chunks, renders them in parallel through a `RenderRunner`, renders the sound once over the whole range, and joins everything with an `ffmpeg` stream copy (no re-encode). Each chunk runs the same in-browser pipeline as a single export, and the sound is mixed and encoded exactly as a single pass does it, so there are no seams at chunk boundaries. Tests check that the output has the same frame count as a single-pass export, bit-identical audio, and matching pictures.

```ts
import { renderDistributed, localRunner, httpRunner } from "@miraiclip/server-export";

// On one machine, several warm browsers:
await renderDistributed(doc, { format: "mp4", out: "video.mp4", runner: localRunner({ concurrency: 4, assetsDir }) });

// On workers you deploy anywhere (Cloud Run, a Lambda function URL, Fly, VMs):
await renderDistributed(doc, {
  format: "mp4",
  out: "video.mp4",
  chunks: 16,
  runner: httpRunner({ endpoints: "https://render.example.com", headers: { authorization: `Bearer ${token}` }, concurrency: 16 }),
});
```

- **Workers** run `createRenderJobHandler()`, a Fetch-API handler that takes one chunk job (a document plus a range) and answers with the encoded chunk. `examples/render-worker` has a ready server and container image. Jobs are stateless: the document arrives in the request, and assets must be http(s) URLs the workers can reach (signed URLs work). Protect public workers with `token`.
- **The coordinator** needs `ffmpeg` on its PATH (or `ffmpegPath`) to join the chunks. Workers don't.
- `chunks` defaults to the runner's concurrency, and chunks are at least `minChunkUs` (2 s) long. `onProgress` reports jobs done, then the join.
- Write your own runner by implementing `RenderRunner.run(job)`: a queue, a batch service, a different cloud.

## The browser

The package depends on lightweight `playwright-core` and **does not download a browser at install**. It launches, in order: `browser.executablePath` → the `MIRAICLIP_BROWSER` env var → the machine's installed Google Chrome. Real Chrome is the recommended runtime because it ships the proprietary **H.264/AAC encoders MP4 export needs** — free Chromium builds (including Playwright's default download and most Docker images) export **WebM only**; MP4 fails their up-front codec probe with a clear error. On a bare server, `npx playwright install chrome` installs branded Chrome; any Chrome/Chromium path works via `executablePath`. On Linux the page renders WebGL on SwiftShader (software GL) by default — GPU-less servers stall on Chrome's default ANGLE.

## Assets

The document's asset `src` values must be reachable from the server. Three ways, checked in order per asset: an explicit `assets: { "<asset id>": "<local path>" }` entry; an `http(s)`/`data:` src, fetched as-is; otherwise the src is treated as a local path resolved against `assetsDir` (the CLI defaults it to the project file's directory). Local files are served to the page over a loopback-only static server that answers **Range requests** — media decode seeks by byte range, so a naive server would re-download the file per seek. A missing file fails fast, naming the asset, before any browser launches.

## Plugins

A document that declares [plugins](../../rendering/extensibility#plugins-custom-kinds-everywhere) runs code, so server export refuses it unless you opt in:

```ts
await exportProjectFile(doc, {
  format: "webm",
  out: "out.webm",
  plugins: { allow: ["https://cdn.acme.dev/plugins/"], requireIntegrity: true },
});
```

`allow` takes `true`, a list of URL prefixes, or `(ref) => boolean`. Relative plugin URLs resolve against `plugins.dir` (default: `assetsDir`). Node reads and integrity-checks each module; the page registers it for that one export or still and unloads it after, so a warm `createExportSession` / `createRenderSession` never carries one document's kinds into the next.

## Progress, cancellation, output

`onProgress` receives the same phases as the browser export (`audio` with `audioMixedUs`/`audioTotalUs`, `video` with `framesDone`/`totalFrames`, `finalizing`), forwarded live across the process boundary. An `AbortSignal` cancels cleanly mid-export — the in-page export aborts, encoders are released, and the call rejects with `ServerExportAbortedError` (the CLI wires this to Ctrl-C).

With `out`, the encoded chunks **stream from the browser into the file as they are produced** (directories created; a failed export removes the partial file): peak memory stays flat however long the output is, and the result is `{ filePath, bytesWritten }` — no bytes in memory. Streamed progress events also carry `bytesWritten` (bytes on disk so far — live file size and MB/s; note total output size is the encoder's decision, so `framesDone / totalFrames` is the true completion fraction, and a remaining-bytes *estimate* is `bytesWritten × (totalFrames − framesDone) / framesDone`; output flushes in ~16 MiB chunks, so short exports may read 0 until finalize). Want the bytes in memory too? Read them back: `await readFile(result.filePath)`. Without `out`, the whole file comes back as `{ bytes }`; fine for short outputs, but the in-page → Node hop transiently costs about twice the file size, so give long exports an `out` path. `format`, `quality`, `fps`, `width`/`height`, `range`, and `audioChunkSeconds` pass straight through to [`exportProject`'s options](../client-side#options); audio always mixes in bounded chunks, so timeline length does not grow memory either.

## How it stays honest

The harness bundle is built **from the workspace at publish time** — `@miraiclip/core`, `@miraiclip/renderer`, and their dependencies are baked in, so the package is version-locked to the renderer it shipped with and consumers install nothing browser-side. The integration suite drives a real headless Chromium end to end and verifies the output container with an independent parser: duration, dimensions, exact range lengths, mid-export aborts, and the CLI itself — on every CI run.
