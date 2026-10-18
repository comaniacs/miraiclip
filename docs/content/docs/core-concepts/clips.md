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

## Speed and freeze frames

Video and audio clips play their source at a constant `speed` (absent = 1). `2` shows twice as much footage in the same time, `0.5` plays at half speed, and `0` is a **freeze frame**: every frame shows the source frame at `trimStartUs`, and the clip is silent. Speeds run from 1/16× to 16×; audio pitch follows speed.

```ts
// Same footage, twice as fast: the clip becomes half as long, and later clips close the gap.
project.dispatch({ type: "clip/set-speed", payload: { clipId: "intro", speed: 2, ripple: true } });

// Keep the clip's length and play less footage at 0.5×.
project.dispatch({ type: "clip/set-speed", payload: { clipId: "demo", speed: 0.5, keepDuration: true } });

// Hold the frame at 4 s for 1.5 s: the clip splits there and the rest of the track moves back.
project.dispatch({
  type: "clip/freeze",
  payload: { clipId: "demo", atUs: 4_000_000, durationUs: 1_500_000 },
});
```

`clip/freeze` at the clip's exact end holds its last frame without splitting; `ripple: false` lays the freeze over what follows instead of pushing it back. `clip/split`, trims, transitions and their headroom all account for speed — a 2× clip's spare second of footage is half a second of transition.

Map times yourself with the pure helpers every renderer path uses: `toSourceUs(clip, timelineUs)`, `toTimelineUs(clip, sourceUs)` (undefined for a freeze frame), `sourceSpanUs(clip)`, `sourceEndUs(clip)`, `clipSpeed(clip)` and `isFrozenClip(clip)`.

## Custom clip props

A custom kind's payload lives under `props`. Edit it with `clip/set-property`: `props` merges in, `unsetProps` drops keys, and the result is re-validated against the kind's schema (so defaults apply and bad values reject with `invalid-props`).

```ts
project.dispatch({ type: "clip/set-property", payload: { clipId: "counter-1", props: { to: 250 } } });
```

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
| `clip/set-property` | Update any clip property (custom kinds: `props`) |
| `clip/set-speed` | Play a video/audio clip faster or slower |
| `clip/freeze` | Hold one frame of a video clip |

```ts
project.dispatch({
  type: "clip/split",
  payload: { clipId: "clip-1", atUs: 2_000_000 },
});
```
