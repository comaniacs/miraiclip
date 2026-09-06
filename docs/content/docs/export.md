---
title: Export
weight: 5
---

`exportProject` renders a composition offline — the same compositor and decode pipeline preview uses, driven frame-by-frame with decode capped at **2× the output's longest side** (visually lossless for compositing, and what keeps 4K-source exports fast; pass `createDecoder: createWebCodecsDecoder` for uncapped pixel-exact decoding) as fast as decode + encode allow. No realtime clock is involved: a 4-minute composition exports in however long the hardware takes, not 4 minutes.

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

## How it works

Every output frame is sampled at its **temporal midpoint** (robust against container timestamp rounding), rendered via `renderFrameAt` — which waits for the exact frame's decoded pixels to arrive, not merely for decode to be scheduled — onto an `OffscreenCanvas` at project resolution, and handed to the muxer. Encoding is **pipelined**: the sink captures the canvas synchronously, so up to `encodeAheadFrames` (default 4) submissions encode in the background while the next frame decodes and composites — the stages overlap instead of running in lockstep. The window bounds memory however fast decode runs. Time moves strictly forward, so the streaming decoders never re-seek.

Audio is mixed offline in one non-realtime pass with `OfflineAudioContext`, using the **same clip math as live playback** (gains, trims, mute/solo — shared code, so preview and export can never disagree), then encoded into the container. Compositions with no audible clips produce a file with no audio track.

{{< callout type="info" >}}
The audio phase decodes the **entire audio track** of every contributing asset before frames start — on a long timeline this takes real time. `onProgress` reports `audioMixedUs`/`audioTotalUs` during it, and the abort signal is honored between chunks.
{{< /callout >}}

## Codec support

Encoder availability varies by browser — H.264 encode is missing in some Chromium builds. `exportProject` probes support **before** starting and rejects with a clear `UnsupportedMediaError` naming the codec, rather than failing frames deep into an export. WebM/VP9 is the safe universal choice; MP4/H.264 is the mainstream one where available.

## Verified end to end

The e2e suite exports a fixture whose every frame encodes its own index as a color, then verifies the produced file with an **independent decoder** (a native `<video>` element and `decodeAudioData`) — frame accuracy, output resolution, duration, and audio fidelity (unity-gain RMS) are asserted on every CI run.
