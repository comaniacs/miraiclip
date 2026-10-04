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

Positions and durations are whole **microseconds** (1 second = 1,000,000 µs). A frame rarely lasts a whole number of µs (33,333.3… at 30 fps, 33,366.6… at 29.97), so Miraiclip maps frames to µs with one rule, used everywhere:

- frame *n* starts at the first whole µs inside it: `frameToUs(n, rate)` = ⌈n · 1e6 · den / num⌉
- the frame holding a position is `usToFrame(us, rate)` = ⌊us · num / (1e6 · den)⌋

Every µs belongs to exactly one frame, `usToFrame(frameToUs(n)) === n` for every frame, and each timestamp is computed from its frame index — nothing is added up frame by frame, so an hour of 29.97 doesn't drift. The math is exact integer arithmetic.

**Frame rates are exact ratios.** `settings.fps` is a number; decimal NTSC rates (29.97, 23.976, 59.94) are stored with their exact ratio in `settings.frameRate`, e.g. `{ num: 30000, den: 1001 }`. Read the exact rate with `projectFrameRate(settings)`:

```ts
import { projectFrameRate, frameToUs, usToFrame, frameCount, usToTimecode } from "@miraiclip/core";

project.dispatch({ type: "project/set-settings", payload: { fps: 29.97 } }); // stored as 30000/1001
const rate = projectFrameRate(project.getState().doc.settings);

frameToUs(107_892, rate);            // 3_599_996_400 — exact
frameCount(3_600_000_000, rate);     // 107_893 frames in an hour
usToTimecode(3_599_996_400, rate);   // "00:59:56:12"  non-drop-frame
usToTimecode(3_599_996_400, rate, { dropFrame: true }); // "01:00:00;00"
```

`snapToFrame` snaps a position to the nearest frame start. All helpers accept a number or a `{ num, den }` ratio.

## Serialization

The entire project state serializes to JSON with schema versioning, so project files can be saved, loaded, and migrated across library versions:

```ts
const saved = project.toJSON();
const restored = createProject(saved);
```
