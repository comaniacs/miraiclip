---
title: Clips
weight: 3
---

Clips are the fundamental building blocks of video compositions — **video**, **audio**, **image**, and **text** elements positioned on the timeline.

All clip operations are performed through [commands](../commands): deterministic, undoable operations that can be batched, synced, and logged.

## Anatomy of a clip

Every clip has:

- **Timeline placement** — `startUs`, `durationUs`: where and how long the clip appears on the timeline.
- **Source trimming** — `trimStartUs`, `trimEndUs`: which portion of the source asset plays.
- **Transform** — position, scale, rotation, opacity.
- **Type-specific properties** — e.g. text content and font for text clips, volume for audio.

## Operations

| Command | Effect |
| --- | --- |
| `clip/add` | Place a new clip on a track |
| `clip/remove` | Delete a clip |
| `clip/move` | Change timeline position and/or track |
| `clip/trim` | Adjust in/out points against the source |
| `clip/split` | Cut one clip into two at a timeline position |
| `clip/duplicate` | Copy a clip |
| `clip/set-property` | Update any clip property |

```ts
project.dispatch({
  type: "clip/split",
  payload: { clipId: "clip-1", atUs: 2_000_000 },
});
```
