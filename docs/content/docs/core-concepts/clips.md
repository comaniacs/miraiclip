---
title: Clips
weight: 3
---

Clips are the fundamental building blocks of video compositions — **video**, **audio**, **image**, **text**, and **caption** (word-timed karaoke text — see [Rendering · Captions](../../rendering/captions)) elements positioned on the timeline. Custom kinds can be registered with `registerClipKind` (payload under `props`, validated by your schema).

All clip operations are performed through [commands](../commands): deterministic, undoable operations that can be batched, synced, and logged.

## Anatomy of a clip

Every clip has:

- **Timeline placement** — `startUs`, `durationUs`: where and how long the clip appears on the timeline.
- **Source trimming** — `trimStartUs` (video/audio): where in the source asset the clip starts playing; the out point follows from `durationUs`. Media beyond the visible range is *headroom* — what [transitions](../../rendering/transitions) draw from.
- **Transform** — position, scale, rotation, opacity (normalized composition coordinates).
- **Animations** — optional per-property keyframes (`keyframe/set`) on `x`/`y`/`scale`/`rotation`/`opacity`/`volume` — see [Rendering · Animation](../../rendering/animation).
- **Effects** — an ordered stack of GPU effects (`effect/add`): colorAdjust, blur, chromaKey — see [Rendering · Effects](../../rendering/effects).
- **Type-specific properties** — e.g. text content and font for text clips, volume for audio, word timing and style for captions.

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
