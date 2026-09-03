---
title: Project State
weight: 2
---

The project state is the single source of truth for your video composition. It's a [Zustand](https://github.com/pmndrs/zustand) (vanilla) store that holds everything from timeline position to clip properties.

## Reading state

Read state directly, or subscribe to slices:

```ts
const { tracks, clips, playheadUs } = project.getState();

project.subscribe(
  (s) => s.playheadUs,
  (playheadUs) => console.log("playhead moved", playheadUs)
);
```

State is never mutated directly — all writes go through the [command dispatcher](../commands).

## Timeline precision

The timeline is microsecond-based: **1 second = 1,000,000 µs**. This guarantees frame-accurate positioning at any frame rate (a frame at 30 fps is exactly 33,333.33… µs — integers in µs avoid floating-point drift that plagues second-based timelines).

Utilities are provided for µs ↔ frame ↔ timecode conversion, snapping, and overlap resolution.

## Serialization

The entire project state serializes to JSON with schema versioning, so project files can be saved, loaded, and migrated across library versions:

```ts
const saved = project.toJSON();
const restored = createProject(saved);
```
