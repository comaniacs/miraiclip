# @miraiclip/core

Headless, command-driven engine for building video editors in the browser (and Node). The core of [Miraiclip](https://github.com/comaniacs/miraiclip): it manages project state, a microsecond-precision timeline, and full command history — rendering is delivered by separate packages.

- **Command-driven** — every mutation is a descriptive, Zod-validated, undoable command
- **AI-native** — `commandCatalog()` exports one JSON Schema per command, ready as LLM tool definitions
- **Time travel** — undo/redo with atomic transactions, backed by inverse patches
- **Collaboration-ready** — changes emitted as RFC-6902 JSON patches; `applyJsonPatches` replays them on a follower
- **Framework agnostic** — a vanilla [Zustand](https://github.com/pmndrs/zustand) store underneath; zero UI dependencies

## Install

```bash
npm install @miraiclip/core
```

## Usage

```ts
import { createProject } from "@miraiclip/core";

const project = createProject({ width: 1920, height: 1080, fps: 30 });

project.dispatch({
  type: "asset/add",
  payload: { id: "intro", kind: "video", src: "/media/intro.mp4", durationUs: 12_000_000 },
});
project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
project.dispatch({
  type: "clip/add",
  payload: { kind: "video", id: "c1", trackId: "v1", assetId: "intro", startUs: 0, durationUs: 5_000_000 },
});

project.transaction(() => {
  project.dispatch({ type: "clip/split", payload: { clipId: "c1", atUs: 2_000_000, newClipId: "c1b" } });
  project.dispatch({ type: "clip/move", payload: { clipId: "c1b", startUs: 3_000_000 } });
});

project.undo();
project.redo();

project.events.on("patches", ({ patches }) => {
  // RFC-6902 ops, e.g. [{ op: "replace", path: "/clips/c1/startUs", value: 1000000 }]
});

const saved = project.toJSON();
```

Full documentation, core concepts, and the command catalog: [github.com/comaniacs/miraiclip](https://github.com/comaniacs/miraiclip).

## License

MIT
