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
- **Effects** — an ordered stack of GPU effects (`effect/add`): 79 built-in kinds (colorAdjust, blur, chromaKey, film looks, stylize, glitch, distort, …) — see [Rendering · Effects](../../rendering/effects).
- **Type-specific properties** — e.g. text content and font for text clips, volume and fades for audio, word timing and style for captions.
- **Fades** — `fadeInUs` / `fadeOutUs` (video/audio): linear gain ramps from the clip start and to its end, multiplied with `volume` and its keyframes. Fades longer than the clip are scaled so they meet. `clip/split` keeps the fade-in on the left half and the fade-out on the right.

## Asset provenance and licensing

Assets can record where they came from and under what terms — the basis for stock libraries and AI generation:

```ts
project.dispatch({
  type: "asset/add",
  payload: {
    id: "music-1", kind: "audio", src: "https://…/track.mp3", durationUs: 92_000_000,
    name: "Morning Walk",
    source: { provider: "openverse", id: "8f2c…", url: "https://openverse.org/audio/8f2c…" },
    license: { id: "CC-BY-4.0", url: "https://creativecommons.org/licenses/by/4.0/", commercial: true, attributionRequired: true },
    attribution: "“Morning Walk” by Jane Doe, CC BY 4.0",
  },
});
```

Pure helpers read it back:

- `usedAssets(doc)` — assets referenced by at least one clip.
- `creditsFor(doc)` — de-duplicated credit lines for used assets whose license requires attribution (for end cards and descriptions).
- `licenseReport(doc, { commercial: true })` — `LicenseIssue[]` before export: non-commercial assets in a commercial project, missing attribution, and library assets with no license. Uploads and recordings are the user's own and are not flagged.

The core only records and reports; enforcing a policy (block export, warn, add a credits card) is the app's decision. `describeProject` includes names and licenses so an AI agent sees them too.

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
