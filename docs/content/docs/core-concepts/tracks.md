---
title: Tracks
weight: 4
---

Tracks are ordered containers for clips. They define the **layering (z-index)** of clips and help group related assets — the track order in state is the render order in the compositor.

Like everything else in the core, tracks are managed via [commands](../commands).

## Track types

Track kinds constrain what clips they accept:

- **video** — video, image, text, caption and html clips (rendered visually, layered by track order)
- **audio** — audio clips (mixed, not layered)

## Operations

| Command | Effect |
| --- | --- |
| `track/add` | Create a track |
| `track/remove` | Delete a track and its clips |
| `track/reorder` | Change layering order |
| `track/rename` | Rename a track |
| `track/set-property` | Mute, solo, lock, or hide a track |

```ts
project.dispatch({ type: "track/add", payload: { id: "overlay-1", kind: "video" } });
project.dispatch({ type: "track/reorder", payload: { trackId: "overlay-1", index: 0 } });
```

## Mute, solo, lock and hide

- `muted` / `solo` gate a track's **sound** (audio clips and the audio of video clips), in playback and export alike.
- `locked` is an editor hint: UIs shouldn't move or edit clips on a locked track (the core doesn't enforce it).
- `hidden` (video tracks) stops the track's clips from being **drawn** in preview, exports and stills, and from hit-testing. Their sound still plays unless the track is muted. `hidden: false` removes the flag, so documents stay minimal.

```ts
project.dispatch({ type: "track/set-property", payload: { trackId: "overlay-1", hidden: true } });
```
