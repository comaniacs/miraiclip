---
title: Server side
weight: 2
---

`@miraiclip/server-export` runs [`exportProject`](../client-side) on a server: pass a project **document as JSON** from Node, and the package launches headless Chrome, hydrates the project in a harness page, and runs the exact same export pipeline the browser uses. That identity is the design — the server cannot render differently from the preview, because it runs the preview's code.

```ts
import { exportProjectFile } from "@miraiclip/server-export";

const { bytes, filePath } = await exportProjectFile(doc, {
  format: "mp4",
  quality: "high",
  out: "render/final.mp4",
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

## The browser

The package depends on lightweight `playwright-core` and **does not download a browser at install**. It launches, in order: `browser.executablePath` → the `MIRAICLIP_BROWSER` env var → the machine's installed Google Chrome. Real Chrome is the recommended runtime because it ships the proprietary **H.264/AAC encoders MP4 export needs** — free Chromium builds (including Playwright's default download and most Docker images) export **WebM only**; MP4 fails their up-front codec probe with a clear error. On a bare server, `npx playwright install chrome` installs branded Chrome; any Chrome/Chromium path works via `executablePath`. On Linux the page renders WebGL on SwiftShader (software GL) by default — GPU-less servers stall on Chrome's default ANGLE.

## Assets

The document's asset `src` values must be reachable from the server. Three ways, checked in order per asset: an explicit `assets: { "<asset id>": "<local path>" }` entry; an `http(s)`/`data:` src, fetched as-is; otherwise the src is treated as a local path resolved against `assetsDir` (the CLI defaults it to the project file's directory). Local files are served to the page over a loopback-only static server that answers **Range requests** — media decode seeks by byte range, so a naive server would re-download the file per seek. A missing file fails fast, naming the asset, before any browser launches.

## Progress, cancellation, output

`onProgress` receives the same phases as the browser export (`audio` with `audioMixedUs`/`audioTotalUs`, `video` with `framesDone`/`totalFrames`, `finalizing`), forwarded live across the process boundary. An `AbortSignal` cancels cleanly mid-export — the in-page export aborts, encoders are released, and the call rejects with `ServerExportAbortedError` (the CLI wires this to Ctrl-C). `out` writes the file (directories created) and the bytes are always returned. `format`, `quality`, `fps`, `width`/`height`, and `range` pass straight through to [`exportProject`'s options](../client-side#options).

## How it stays honest

The harness bundle is built **from the workspace at publish time** — `@miraiclip/core`, `@miraiclip/renderer`, and their dependencies are baked in, so the package is version-locked to the renderer it shipped with and consumers install nothing browser-side. The integration suite drives a real headless Chromium end to end and verifies the output container with an independent parser: duration, dimensions, exact range lengths, mid-export aborts, and the CLI itself — on every CI run.
