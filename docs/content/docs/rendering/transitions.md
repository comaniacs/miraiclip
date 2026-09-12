---
title: Transitions
weight: 3
---

Bridge a cut between two adjacent clips on the same track. The window is centered on the cut, and every kind applies an equal-power **audio crossfade** automatically — identical in preview and export.

## Split and bridge (the standard flow)

Both halves of a `clip/split` keep playing the same source, so a fresh split **always has the headroom a transition needs**:

```ts
project.transaction(() => {
  project.dispatch({ type: "clip/split", payload: { clipId: "clip-1", atUs: 4_000_000, newClipId: "clip-1b" } });
  project.dispatch({ type: "transition/add", payload: { kind: "dipToBlack", fromClipId: "clip-1", toClipId: "clip-1b", durationUs: 700_000 } });
});
```

## Between two existing clips

`fromClipId` must end exactly where `toClipId` starts, on the same track:

```ts
project.dispatch({
  type: "transition/add",
  payload: { kind: "crossDissolve", fromClipId: "a", toClipId: "b", durationUs: 800_000 },
});

// Wipe and slide take a direction:
project.dispatch({
  type: "transition/add",
  payload: { kind: "slide", fromClipId: "b", toClipId: "c", durationUs: 600_000, params: { direction: "left" } },
});
```

## Kinds

| Kind | Look | Params |
| --- | --- | --- |
| `crossDissolve` | Incoming blends over outgoing | — |
| `dipToBlack` / `dipToWhite` | Fade out, fade back in | — |
| `wipe` | Incoming revealed by a sweeping edge | `direction`: left/right/up/down |
| `slide` | Incoming pushes in over outgoing | `direction`: left/right/up/down |

## Adjust or remove

```ts
project.dispatch({ type: "transition/update", payload: { transitionId: "t1", durationUs: 1_000_000 } });
project.dispatch({ type: "transition/remove", payload: { transitionId: "t1" } });
```

## Why a transition can be rejected

The window draws from **source headroom** — the outgoing clip keeps rendering past its end, the incoming starts early, each needing half the window of trimmed-off media:

| Rejection | Meaning |
| --- | --- |
| `not-adjacent` | `toClipId` doesn't start exactly where `fromClipId` ends |
| `different-tracks` | The clips are on different tracks |
| `duplicate-boundary` | That cut already has a transition |
| `insufficient-handles` | A clip has no source media past its visible range — trim it, or shorten the transition |

## Good to know

- Two clips of the **same asset** transition fine — each gets its own decode pipeline for the overlap.
- Editing or removing a participating clip drops its transitions (the cut they were built on is gone).
- Full payload schemas: [command catalog](../../command-catalog).
