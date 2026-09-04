---
title: Events & Patches
weight: 5
---

Miraiclip provides a reactive event system that notifies you of playback changes and project state mutations. Since the core is command-driven, state changes are emitted as **granular patches** — subscribers learn exactly what changed, not just that "something changed."

## Subscribing

```ts
project.events.on("patches", ({ patches, inverse, source }) => {
  // RFC-6902 JSON Patch ops, paths relative to the document root:
  // e.g. [{ op: "replace", path: "/clips/clip-1/startUs", value: 1000000 }]
  // source: "dispatch" | "undo" | "redo" | "transaction-rollback"
});

project.events.on("history", ({ kind }) => {
  // "commit" | "undo" | "redo"
});

project.events.on("playhead", ({ positionUs }) => {
  // playback position changes
});
```

## Why patches?

Patches are what make the engine collaboration-ready:

- **Sync** — broadcast patches (or the commands that produced them) to other clients and apply them there with `applyJsonPatches(doc, patches)`.
- **Undo/redo** — every patch set comes with its inverse; history is just stacks of patch pairs.
- **Efficient UIs** — renderers and framework adapters can react to exactly the paths they care about instead of re-deriving everything.
- **Audit** — the patch stream is a complete, replayable log of every change to the project.
