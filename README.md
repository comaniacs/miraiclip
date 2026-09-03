# Miraiclip

An open source, framework-agnostic library for building video editors in the browser. Command-driven, AI-native, collaboration-ready.

> ⚠️ Miraiclip is in early development. The API below reflects the design target for `@miraiclip/core` v0.1 — see [PLAN.md](./PLAN.md) for the full roadmap.

## Why Miraiclip?

Miraiclip is not a video editor app — it is the engine you build one with. The core is headless: it manages project state, a microsecond-precision timeline, and a full command history, with rendering delivered as a separate layer. Every mutation flows through a descriptive command, which makes the engine equally usable by a human clicking a UI, an LLM generating an edit sequence, or a sync layer replaying a collaborator's changes.

## Features

- **Command-Driven Architecture** — Instead of calling imperative methods that mutate state directly, you dispatch descriptive commands (`clip/add`, `clip/split`, `clip/move`, `track/reorder`…). Every command is deterministic, validated against a schema, serializable, and invertible — the foundation for undo/redo, collaboration, and AI control.
- **AI-Native** — Commands are plain descriptive data with a published catalog and JSON schemas, so LLMs can reason about the project state and generate valid command sequences. The command catalog doubles as an AI tool definition.
- **Time Travel** — Built-in undo/redo with full history. Commands can be batched into transactions that undo as a unit, and history is exact, replayable, and inspectable.
- **Framework Agnostic** — Zero UI dependencies in the core. Use it with React, Vue, Svelte, or vanilla JS via thin adapter packages; it also runs headless in Node for testing and server-side workflows.
- **Collaboration-Ready** — State changes are emitted as granular JSON patches. Command + patch streams are the substrate for real-time multiplayer editing.
- **Project State as Single Source of Truth** — A [Zustand](https://github.com/pmndrs/zustand) store holds everything from timeline position to clip properties, fully serializable to JSON for save/load.
- **Clips & Tracks** — Video, audio, image, and text clips positioned on a microsecond-based timeline (1 s = 1,000,000 µs), organized into tracks that define layering (z-index). All operations go through commands.
- **Reactive Events** — Subscribe to playback changes and state mutations; changes arrive as granular patches, so subscribers know exactly what changed.

## Packages

| Package | Status | Description |
| --- | --- | --- |
| `@miraiclip/core` | 🚧 in progress | Headless command-driven engine: state, commands, history, events |
| `@miraiclip/renderer` | planned | WebCodecs + WebGL playback and preview |
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
  payload: { id: "intro", src: "/media/intro.mp4", durationUs: 12_000_000 },
});

// Everything is a command — deterministic, undoable, serializable
project.dispatch({ type: "track/add", payload: { id: "video-1", kind: "video" } });
project.dispatch({
  type: "clip/add",
  payload: {
    id: "clip-1",
    trackId: "video-1",
    assetId: "intro",
    startUs: 0,            // timeline position in microseconds
    durationUs: 5_000_000, // 5 seconds
  },
});

// Batch commands into one undoable transaction
project.transaction(() => {
  project.dispatch({ type: "clip/split", payload: { clipId: "clip-1", atUs: 2_000_000 } });
  project.dispatch({ type: "clip/move", payload: { clipId: "clip-1", startUs: 1_000_000 } });
});

// Time travel
project.undo();
project.redo();

// React to changes as granular patches — the substrate for sync & collaboration
project.events.on("patches", ({ patches, inverse }) => {
  console.log(patches); // e.g. [{ op: "replace", path: ["clips", "clip-1", "startUs"], value: 1000000 }]
});

// Serialize the whole project to JSON and load it back
const saved = project.toJSON();
const restored = createProject(saved);
```

### Reading state

```ts
// Read (never mutate) state directly, or subscribe to slices
const { tracks, clips } = project.getState();

project.subscribe(
  (s) => s.playheadUs,
  (playheadUs) => console.log("playhead moved", playheadUs)
);
```

## Roadmap

1. **v1 — Core engine**: commands, state, tracks, clips, undo/redo, patches, events, serialization
2. **v2 — Rendering & playback**: WebCodecs decode + WebGL compositor, frame-accurate playback
3. **v3 — Export**: WebCodecs encode to MP4/WebM, offline faster-than-realtime rendering
4. **v4 — Creative features**: keyframe animations, transitions, effects, captions, chroma key

See [PLAN.md](./PLAN.md) for the detailed plan and architecture.

## License

[MIT](./LICENSE)
