---
title: Tracks
weight: 4
---

Tracks are ordered containers for clips. They define the **layering (z-index)** of clips and help group related assets — the track order in state is the render order in the compositor.

Like everything else in the core, tracks are managed via [commands](../commands).

## Track types

Track kinds constrain what clips they accept:

- **video** — video, image, and text clips (rendered visually, layered by track order)
- **audio** — audio clips (mixed, not layered)

## Operations

| Command | Effect |
| --- | --- |
| `track/add` | Create a track |
| `track/remove` | Delete a track and its clips |
| `track/reorder` | Change layering order |
| `track/rename` | Rename a track |
| `track/set-property` | Mute, solo, or lock a track |

```ts
project.dispatch({ type: "track/add", payload: { id: "overlay-1", kind: "video" } });
project.dispatch({ type: "track/reorder", payload: { trackId: "overlay-1", index: 0 } });
```
