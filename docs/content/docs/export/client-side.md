---
title: Client side
weight: 1
---

`exportProject` renders a composition offline — the same compositor and decode pipeline preview uses, driven frame-by-frame with decode capped at **2× the output's longest side** (visually lossless for compositing, and what keeps 4K-source exports fast; pass `createDecoder: createWebCodecsDecoder` for uncapped pixel-exact decoding) as fast as decode + encode allow. No realtime clock is involved: a 4-minute composition exports in however long the hardware takes, not 4 minutes. To run the same export from Node on a server, see [Server side](../server-side).

```ts
import { exportProject } from "@miraiclip/renderer";

const bytes = await exportProject(project, {
  format: "mp4",            // "mp4" (H.264 + AAC) or "webm" (VP9 + Opus)
  quality: "standard",      // "draft" | "standard" | "high" | { videoBitrate }
  onProgress: ({ phase, framesDone, totalFrames }) =>
    console.log(phase, `${framesDone}/${totalFrames}`),
});
const file = new Blob([bytes], { type: "video/mp4" });
```

## Options

Every `exportProject` option, with its default:

| Option | Type | Default | What it does |
|---|---|---|---|
| `format` | `"mp4"` \| `"webm"` | — (required) | Container + codecs: MP4 is H.264 + AAC, WebM is VP9 + Opus. |
| `quality` | `"draft"` \| `"standard"` \| `"high"` \| `{ videoBitrate }` | `"standard"` | The encoder's **bitrate budget** — resolution, fps, and codec are unchanged. `draft` is small with visible artifacts (previews), `standard` is streaming-grade, `high` spends several times more bitrate for near-transparent quality (final deliverables). Presets scale with output size; pass `{ videoBitrate }` in bits/s for exact control. Affects file size far more than export time. |
| `fps` | `number` | project fps | Output frame rate. A lower rate cuts frame count — and export time — proportionally (e.g. 30 for a 60 fps project halves it). |
| `width`, `height` | `number` | project size | Output resolution. |
| `range` | `{ startUs, endUs }` | whole composition | Export a section; output timestamps rebase to `startUs`. |
| `target` | `WritableStream` | — (buffer in memory) | **Stream the encoded file out as it is produced** instead of resolving with the bytes — required for long exports, whose output does not fit in memory. See [Streaming to disk](#streaming-to-disk). |
| `audioChunkSeconds` | `number` | `60` | Audio mixes in bounded sequential chunks (~23 MB of PCM per minute at 48 kHz stereo), interleaved with the frame walk — timeline length does not grow mix memory. Use integer seconds. |
| `signal` | `AbortSignal` | — | Cancel cleanly at any point (audio mix included); the export rejects with `ExportAbortedError` and encoders are released. |
| `onProgress` | `(p: ExportProgress) => void` | — | Per-frame during video (`framesDone`/`totalFrames`), live during the audio mix (`audioMixedUs`/`audioTotalUs`), and a `finalizing` phase. |
| `openDemuxer`, `createDecoder`, `openAudio` | adapters | mediabunny + WebCodecs | Injectable media adapters. Pass `createDecoder: createWebCodecsDecoder` for uncapped pixel-exact decoding (the default caps decode at 2× the output's longest side). |

A fully-specified call:

```ts
const controller = new AbortController();
const bytes = await exportProject(project, {
  format: "mp4",
  quality: "high",
  fps: 30,
  width: 1920,
  height: 1080,
  range: { startUs: 5_000_000, endUs: 20_000_000 }, // 0:05 → 0:20
  signal: controller.signal,
  onProgress: ({ phase, framesDone, totalFrames, audioMixedUs, audioTotalUs }) => {
    if (phase === "audio") console.log(`audio ${audioMixedUs}/${audioTotalUs}µs`);
    else console.log(`${phase} ${framesDone}/${totalFrames}`);
  },
});
```

## Streaming to disk

By default the encoded file accumulates in memory and `exportProject` resolves with the bytes — fine for short outputs. For long ones, pass a `target`: each encoded chunk is `{ type: "write", data, position }`, exactly what `FileSystemWritableFileStream.write` accepts, so the user picks a file once and the export writes straight into it:

```ts
const handle = await window.showSaveFilePicker({ suggestedName: "export.webm" });
const writable = await handle.createWritable();

const resolved = await exportProject(project, {
  format: "webm",
  quality: "standard",
  target: writable, // chunks stream to disk; `resolved` is an empty array
});
await writable.close();
```

Positions may seek backwards (containers patch their headers at the end), which file writables handle natively. Backpressure on the stream throttles the encoders, so a slow disk bounds memory instead of growing it. With a `target` set the returned promise resolves with an **empty** `Uint8Array` once the stream has everything.

Combined with chunked audio (on by default), export memory no longer scales with timeline length: the stress suite exports hour-scale timelines with a flat JS heap. Server-side exports stream automatically when given an output path — see [Server side](../server-side).

## Exporting in a worker

`exportProject` runs on the thread that calls it — a long export on the main thread keeps the page busy. Run the same pipeline in a worker instead and the page stays responsive (total CPU is unchanged; the export just stops competing with your UI):

```ts
import { exportProjectInWorker } from "@miraiclip/renderer";

const bytes = await exportProjectInWorker(project, {
  format: "webm",
  quality: "standard",
  onProgress: ({ framesDone, totalFrames }) => { /* same events */ },
});
```

`exportProjectInWorker` spawns the bundled worker entry via `new Worker(new URL("./export.worker.js", import.meta.url), { type: "module" })` — the pattern Vite, webpack, and Rollup all resolve and bundle. Where that pattern can't apply, bring your own worker:

```ts
// Vite example — bundle the entry explicitly:
import ExportWorker from "@miraiclip/renderer/export-worker?worker";
import { exportViaWorker } from "@miraiclip/renderer";

const worker = new ExportWorker();
try {
  const bytes = await exportViaWorker(worker, project, { format: "webm" });
} finally {
  worker.terminate(); // exportViaWorker never terminates a worker you own
}
```

| Works in the worker | Notes |
|---|---|
| `target` streaming | Chunks relay through the main thread into your stream (a `FileSystemWritableFileStream` is not transferable), acked per write so its backpressure reaches the worker's encoders — a `showSaveFilePicker()` writable works directly |
| Audio | Mixed on the main thread (`OfflineAudioContext` is window-only) and fed across as raw PCM — same mix math, same output |
| Fonts, captions, effects, transitions | Load and render inside the worker |
| `range`, `fps`, `width`/`height`, `quality`, `signal`, `onProgress` | Same semantics; progress and abort cross as messages |

Custom clip-kind `factories` cannot cross a thread boundary (they are functions) — worker exports support **built-in kinds only**, the same rule as [server-side export](../server-side). Media `src` values must be reachable from a worker: `http(s)` and `blob:` URLs and `File`/`Blob` objects all are.

## How it works

Every output frame is sampled at its **temporal midpoint** (robust against container timestamp rounding), rendered via `renderFrameAt` — which waits for the exact frame's decoded pixels to arrive, not merely for decode to be scheduled — onto an `OffscreenCanvas` at project resolution, and handed to the muxer. Encoding is **pipelined**: the sink captures the canvas synchronously, so up to `encodeAheadFrames` (default 4) submissions encode in the background while the next frame decodes and composites — the stages overlap instead of running in lockstep. The window bounds memory however fast decode runs. Time moves strictly forward, so the streaming decoders never re-seek.

Audio is mixed offline with `OfflineAudioContext` in bounded sequential chunks (`audioChunkSeconds`, default 60), interleaved with the frame walk — the first chunk lands before frame 0, each later chunk is mixed just before frames reach its window, and silent stretches of an audible timeline occupy real (zero-filled) samples so chunk timestamps stay aligned. The mix uses the **same clip math as live playback** (gains, trims, mute/solo — shared code, so preview and export can never disagree). Compositions with no audible clips produce a file with no audio track.

{{< callout type="info" >}}
Mixing a chunk decodes that window's audio from every contributing asset — on a long timeline the audio work is spread through the export rather than paid up front. `onProgress` reports `audioMixedUs`/`audioTotalUs` as chunks complete, and the abort signal is honored throughout.
{{< /callout >}}

## Codec support

Encoder availability varies by browser — H.264 encode is missing in some Chromium builds. `exportProject` probes support **before** starting and rejects with a clear `UnsupportedMediaError` naming the codec, rather than failing frames deep into an export. WebM/VP9 is the safe universal choice; MP4/H.264 is the mainstream one where available.

## Verified end to end

The e2e suite exports a fixture whose every frame encodes its own index as a color, then verifies the produced file with an **independent decoder** (a native `<video>` element and `decodeAudioData`) — frame accuracy, output resolution, duration, and audio fidelity (unity-gain RMS) are asserted on every CI run.
