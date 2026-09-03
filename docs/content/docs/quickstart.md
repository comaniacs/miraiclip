---
title: Quickstart
weight: 2
---

{{< callout type="warning" >}}
Miraiclip is in early development. The API below is the design target for `@miraiclip/core` v0.1 and is not yet published to npm.
{{< /callout >}}

## Installation

```bash
npm install @miraiclip/core
```

## Create a project

The project state is a Zustand store — the single source of truth for your composition.

```ts
import { createProject } from "@miraiclip/core";

const project = createProject({ width: 1920, height: 1080, fps: 30 });
```

## Add media, tracks, and clips

Everything is a command — deterministic, undoable, serializable.

```ts
// Register a media asset (metadata only; core does no decoding)
project.dispatch({
  type: "asset/add",
  payload: { id: "intro", src: "/media/intro.mp4", durationUs: 12_000_000 },
});

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
```

## Transactions and time travel

Batch commands into one undoable history entry:

```ts
project.transaction(() => {
  project.dispatch({ type: "clip/split", payload: { clipId: "clip-1", atUs: 2_000_000 } });
  project.dispatch({ type: "clip/move", payload: { clipId: "clip-1", startUs: 1_000_000 } });
});

project.undo();
project.redo();
```

## React to changes

State changes are emitted as granular patches — the substrate for sync and collaboration:

```ts
project.events.on("patches", ({ patches, inverse }) => {
  console.log(patches);
  // e.g. [{ op: "replace", path: ["clips", "clip-1", "startUs"], value: 1000000 }]
});
```

## Save and load

```ts
const saved = project.toJSON();
const restored = createProject(saved);
```
