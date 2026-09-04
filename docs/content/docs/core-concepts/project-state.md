---
title: Project State
weight: 2
---

The project state is the single source of truth for your video composition. It's a [Zustand](https://github.com/pmndrs/zustand) (vanilla) store that holds everything from timeline position to clip properties.

## Reading state

Read state directly, or subscribe to slices:

```ts
// The composition document (serialized, undoable) lives under state.doc
const { tracks, clips, trackOrder } = project.getState().doc;

// Ephemeral session state sits beside it at the top level
const { playheadUs, selection } = project.getState();

project.subscribe(
  (s) => s.playheadUs,
  (playheadUs) => console.log("playhead moved", playheadUs)
);
```

State is never mutated directly — the document changes only through the [command dispatcher](../commands), while ephemeral state (playhead, selection) has dedicated setters: `project.setPlayhead(us)` and `project.setSelection(ids)`. Ephemeral changes never create undo steps and are excluded from serialization.

## Timeline precision

The timeline is microsecond-based: **1 second = 1,000,000 µs**. This guarantees frame-accurate positioning at any frame rate (a frame at 30 fps is exactly 33,333.33… µs — integers in µs avoid floating-point drift that plagues second-based timelines).

Utilities are provided for µs ↔ frame ↔ timecode conversion, snapping, and overlap resolution.

## Serialization

The entire project state serializes to JSON with schema versioning, so project files can be saved, loaded, and migrated across library versions:

```ts
const saved = project.toJSON();
const restored = createProject(saved);
```
