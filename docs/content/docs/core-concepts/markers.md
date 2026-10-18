---
title: Markers
weight: 4
---

Markers are named points or spans on the timeline: chapters for a player, steps in a tutorial, sections of a written guide, notes for a reviewer. They don't render. They are part of the document, so they undo, serialize and sync like everything else.

```ts
project.dispatch({ type: "marker/add", payload: { id: "intro", timeUs: 0, label: "Intro" } });
project.dispatch({
  type: "marker/add",
  payload: { id: "step-1", timeUs: 4_000_000, durationUs: 3_000_000, label: "Open settings", data: { kind: "step" } },
});
project.dispatch({ type: "marker/update", payload: { markerId: "step-1", label: "Open Settings → Billing" } });
project.dispatch({ type: "marker/remove", payload: { markerId: "intro" } });
```

A marker is `{ id, timeUs, label, durationUs?, data? }`. `data` is free-form JSON for whoever placed the marker — a planner, an importer or your UI. Documents carry no `markers` key until the first marker is added, and lose it again when the last one goes.

## Reading markers

- `listMarkers(doc)` — every marker in time order.
- `markersInRange(doc, fromUs, toUs)` — markers whose point or span touches the range.
- `markerChapters(doc)` — markers as chapters: each runs for its own `durationUs`, or until the next marker (the last one until the end of the composition).

`describeProject` lists markers, so an AI agent sees them too.
