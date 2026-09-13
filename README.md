# Miraiclip

An open source, framework-agnostic library for building video editors in the browser. Command-driven, AI-native, collaboration-ready.

📖 **[Documentation](https://comaniacs.github.io/miraiclip/)** · 🎬 **[Live examples](https://comaniacs.github.io/miraiclip/examples/)** · 📦 **[`@miraiclip/core` on npm](https://www.npmjs.com/package/@miraiclip/core)**

> ⚠️ Miraiclip is in early development (pre-1.0: expect API changes between minor versions). See [PLAN.md](./PLAN.md) for the roadmap and [CHANGELOG.md](./CHANGELOG.md) for what's new.

## Why Miraiclip?

Miraiclip is not a video editor app — it is the engine you build one with. The core is headless: it manages project state, a microsecond-precision timeline, and a full command history, with rendering delivered as a separate layer. Every mutation flows through a descriptive command, which makes the engine equally usable by a human clicking a UI, an LLM generating an edit sequence, or a sync layer replaying a collaborator's changes.

## Features

- **Command-Driven Architecture** — Instead of calling imperative methods that mutate state directly, you dispatch descriptive commands (`clip/add`, `clip/split`, `clip/move`, `track/reorder`…). Every command is deterministic, validated against a schema, serializable, and invertible — the foundation for undo/redo, collaboration, and AI control.
- **AI-Native** — Commands are plain descriptive data with a published catalog and JSON schemas, so LLMs can reason about the project state and generate valid command sequences. The command catalog doubles as an AI tool definition.
- **Time Travel** — Built-in undo/redo with full history. Commands can be batched into transactions that undo as a unit, and history is exact, replayable, and inspectable.
- **Framework Agnostic** — Zero UI dependencies in the core. Use it with React, Vue, Svelte, or vanilla JS via thin adapter packages; it also runs headless in Node for testing and server-side workflows.
- **Collaboration-Ready** — State changes are emitted as granular JSON patches. Command + patch streams are the substrate for real-time multiplayer editing.
- **Project State as Single Source of Truth** — A [Zustand](https://github.com/pmndrs/zustand) store holds everything from timeline position to clip properties, fully serializable to JSON for save/load.
- **Clips & Tracks** — Video, audio, image, text, and karaoke-caption clips positioned on a microsecond-based timeline (1 s = 1,000,000 µs), organized into tracks that define layering (z-index). All operations go through commands.
- **Reactive Events** — Subscribe to playback changes and state mutations; changes arrive as granular patches, so subscribers know exactly what changed.
- **Frame-Accurate Playback** — A WebCodecs decode pipeline and WebGL (PixiJS) compositor with an audio-master clock: paused seeks land on the exact frame, playback tracks the clock, and preview renders at proxy resolution while exports stay full-res.
- **Creative Features** — Keyframe animations (cubic-bézier easings) on transform/opacity/volume, shader effects (color adjust, blur, chroma key), transitions (cross dissolve, dips, wipe, slide) with equal-power audio crossfades, and reels-style karaoke captions with SRT/VTT and ASR word-timestamp import. [See them run live.](https://comaniacs.github.io/miraiclip/examples/)
- **Export, in the browser and on the server** — The same compositor renders exports (preview/export parity by construction), faster than realtime, to MP4 or WebM. Output can [stream straight to disk](https://comaniacs.github.io/miraiclip/docs/export/client-side/#streaming-to-disk) and audio mixes in bounded chunks, so export memory doesn't grow with timeline length. [`@miraiclip/server-export`](https://www.npmjs.com/package/@miraiclip/server-export) runs the identical pipeline in headless Chrome from Node — plus a `miraiclip-export` CLI.
- **Tested like an engine** — Golden-frame e2e (every fixture frame encodes its own index as a color), closed-loop export verification by independent decoders, and a nightly [stress tier](https://comaniacs.github.io/miraiclip/docs/production-readiness/) for long timelines, long exports, and decoder churn — with measured numbers published honestly.

## Packages

| Package | Status | Description |
| --- | --- | --- |
| [`@miraiclip/core`](https://www.npmjs.com/package/@miraiclip/core) | ✅ v0.2.0 on npm | Headless command-driven engine: state, commands, history, events |
| [`@miraiclip/renderer`](https://www.npmjs.com/package/@miraiclip/renderer) | ✅ v0.3.0 on npm | WebCodecs + WebGL playback, preview, and export — animations, effects, transitions, captions |
| [`@miraiclip/server-export`](https://www.npmjs.com/package/@miraiclip/server-export) | ✅ v0.1.1 on npm | Server-side export: the browser pipeline in headless Chrome, from Node |
| `@miraiclip/react` | planned | React hooks and selectors |

## Quick start

```bash
npm install @miraiclip/core
```

```ts
import { createProject } from "@miraiclip/core";

// Project state is a Zustand store — the single source of truth
const project = createProject({ width: 1920, height: 1080, fps: 30 });

// Register a media asset (metadata only; core does no decoding)
project.dispatch({
  type: "asset/add",
  payload: { id: "intro", kind: "video", src: "/media/intro.mp4", durationUs: 12_000_000 },
});

// Everything is a command — deterministic, undoable, serializable
project.dispatch({ type: "track/add", payload: { id: "video-1", kind: "video" } });
project.dispatch({
  type: "clip/add",
  payload: {
    kind: "video",
    id: "clip-1",
    trackId: "video-1",
    assetId: "intro",
    startUs: 0,            // timeline position in microseconds
    durationUs: 5_000_000, // 5 seconds
  },
});

// Batch commands into one undoable transaction
project.transaction(() => {
  project.dispatch({
    type: "clip/split",
    payload: { clipId: "clip-1", atUs: 2_000_000, newClipId: "clip-1b" },
  });
  project.dispatch({ type: "clip/move", payload: { clipId: "clip-1", startUs: 1_000_000 } });
});

// Time travel
project.undo();
project.redo();

// React to changes as granular patches — the substrate for sync & collaboration
project.events.on("patches", ({ patches, inverse }) => {
  console.log(patches); // e.g. [{ op: "replace", path: "/clips/clip-1/startUs", value: 1000000 }]
});

// Serialize the whole project to JSON and load it back
const saved = project.toJSON();
const restored = createProject(saved);
```

### Reading state

```ts
// The composition document lives under state.doc; read it, never mutate it
const { tracks, clips, trackOrder } = project.getState().doc;

// Ephemeral session state (playhead, selection) sits beside it — not undoable
project.setPlayhead(1_500_000);

project.subscribe(
  (s) => s.playheadUs,
  (playheadUs) => console.log("playhead moved", playheadUs)
);
```

### Play and export it

```ts
import {
  createPixiBackend, createPlayer, exportProject,
  openMediabunnyDemuxer, createWebCodecsDecoderFactory,
  createWebAudioOutput, openMediabunnyAudio,
} from "@miraiclip/renderer";

// Frame-accurate playback on a canvas — same compositor as export
const backend = await createPixiBackend({ canvas, width: 1280, height: 720 });
const player = createPlayer(project, {
  backend,
  openDemuxer: openMediabunnyDemuxer,
  createDecoder: createWebCodecsDecoderFactory({ maxOutputDimensionPx: 1920 }), // proxy preview
  audioOutput: createWebAudioOutput(),
  openAudio: openMediabunnyAudio,
});
player.play();

// Offline export, faster than realtime; same pixels as preview by construction
const bytes = await exportProject(project, { format: "mp4", quality: "high" });
```

Or from Node, with [`@miraiclip/server-export`](https://www.npmjs.com/package/@miraiclip/server-export):

```sh
miraiclip-export project.json --out final.mp4 --quality high
```

## Roadmap

1. **v1 — Core engine** ✅: commands, state, tracks, clips, undo/redo, patches, events, serialization (`@miraiclip/core`)
2. **v2 — Rendering & playback** ✅: WebCodecs decode + WebGL compositor, frame-accurate playback (`@miraiclip/renderer`)
3. **v3 — Export** ✅: WebCodecs encode to MP4/WebM, offline faster-than-realtime rendering, plus server-side export from Node (`@miraiclip/server-export`)
4. **v4 — Creative features** ✅: keyframe animations, transitions, effects, chroma key, karaoke captions
5. **v4.x — Production readiness** (in progress): stress suite + [measured numbers](https://comaniacs.github.io/miraiclip/docs/production-readiness/), streaming exports, chunked audio, hour-scale timelines
6. **v5 — Ecosystem** (exploring): `@miraiclip/react` + example editor app, templates, programmatic clip kinds

See the [roadmap](https://comaniacs.github.io/miraiclip/docs/roadmap/) and [PLAN.md](./PLAN.md) for the detailed plan and architecture.

## License

[MIT](./LICENSE)
