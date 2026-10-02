---
title: Animation
weight: 1
---

Keyframe any of `x`, `y`, `scale`, `rotation`, `opacity`, `volume` per clip. Times are **clip-relative microseconds**. Plays in preview and bakes into every export automatically.

## Fade a clip in

```ts
project.dispatch({ type: "keyframe/set", payload: { clipId: "clip-1", property: "opacity", timeUs: 0, value: 0, easing: "easeOut" } });
project.dispatch({ type: "keyframe/set", payload: { clipId: "clip-1", property: "opacity", timeUs: 1_000_000, value: 1 } });
```

## Slow push-in

```ts
project.dispatch({ type: "keyframe/set", payload: { clipId: "clip-1", property: "scale", timeUs: 0, value: 1 } });
project.dispatch({ type: "keyframe/set", payload: { clipId: "clip-1", property: "scale", timeUs: 5_000_000, value: 1.15 } });
```

## Duck the audio under a voiceover

```ts
project.dispatch({ type: "keyframe/set", payload: { clipId: "music", property: "volume", timeUs: 2_000_000, value: 1 } });
project.dispatch({ type: "keyframe/set", payload: { clipId: "music", property: "volume", timeUs: 2_400_000, value: 0.2 } });
```

Volume animates as smooth gain ramps (no stepping/zipper noise), identically in preview and export.

## Easings

The easing on a keyframe shapes the segment **to the next keyframe**. Default: `linear`.

| Easing | Effect |
| --- | --- |
| `linear` | Constant rate |
| `easeIn` / `easeOut` / `easeInOut` | Accelerate / decelerate / both |
| `hold` | Keep the value, jump at the next keyframe |
| `{ kind: "bezier", x1, y1, x2, y2 }` | Custom cubic bézier (presets are sugar for these) |

Every preset is stored as its bézier control points, so a custom curve is a first-class citizen — no registration needed:

```ts
project.dispatch({
  type: "keyframe/set",
  payload: { clipId: "clip-1", property: "y", timeUs: 0, value: 0.6,
             easing: { kind: "bezier", x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 } }, // overshoot/bounce
});
```

## Animate out from the end

Exit animations should stay glued to the clip's end. Give those keyframes `anchor: "end"`: their `timeUs` is measured **back from the clip's visible end** (0 = the last instant), so trimming or resizing the clip moves them with it.

```ts
// Fade out over the last 0.5 s, however long the clip becomes.
project.dispatch({ type: "keyframe/set", payload: { clipId: "clip-1", property: "opacity", timeUs: 500_000, anchor: "end", value: 1 } });
project.dispatch({ type: "keyframe/set", payload: { clipId: "clip-1", property: "opacity", timeUs: 0, anchor: "end", value: 0 } });
```

Start- and end-anchored keyframes mix freely on one property. If a clip gets shorter than its In plus Out animations, the keyframes interleave by time. On `clip/split`, the left half drops end-anchored keyframes (like a fade-out, they belong to the outer end). Code that evaluates keyframes itself can call `resolveKeyframes(keyframes, clip.durationUs)` (returns start-relative, sorted times) or pass the clip's duration to `evaluateKeyframes`. `evaluateClipAt` / `evaluateClipInto` handle it for you.

## Presets

Core ships the presets an editor's Animate panel offers, as plain keyframes: **in** and **out** (fade, slide up / down / left / right, zoom, spin, pop) with duration and easing (smooth, linear, snappy), and **loops** between them (pulse, float, sway, Ken Burns). A clip's animation is a recipe of up to three slots:

```ts
import { animationCommands, applyCommands, readAnimation, describeAnimation } from "@miraiclip/core";

const clip = project.getState().doc.clips["title"];
applyCommands(project, animationCommands(clip, {
  in: { preset: "in:pop", durationUs: 600_000, easing: "smooth" },
  loop: { preset: "loop:float", durationUs: 0, easing: "linear" },
  out: { preset: "out:fade", durationUs: 400_000, easing: "smooth" },
})); // one undo step; out keyframes are end-anchored

describeAnimation(readAnimation(project.getState().doc.clips["title"]).recipe); // "Pop in · Float · Fade out"
```

`readAnimation` recognizes the recipe from the keyframes (presets are deterministic), so a panel can show it after a reload or an undo. It reports `custom: true` for hand-made keyframes, and `stale: true` when a trim left a loop's spacing behind (apply the recipe again to refresh). `animationCommands(clip, {})` removes the animation; volume keyframes are never touched.

## Edit and remove

```ts
// Setting a keyframe at an existing time updates it in place:
project.dispatch({ type: "keyframe/set", payload: { clipId: "clip-1", property: "opacity", timeUs: 0, value: 0.5 } });

// Remove one (timeUs and anchor must match exactly), or clear a property — or everything:
project.dispatch({ type: "keyframe/remove", payload: { clipId: "clip-1", property: "opacity", timeUs: 0 } });
project.dispatch({ type: "keyframe/clear", payload: { clipId: "clip-1", property: "opacity" } });
project.dispatch({ type: "keyframe/clear", payload: { clipId: "clip-1" } });
```

## Good to know

- Keyframes anchor to the clip's visible start by default; trimming the clip keeps them. Use `anchor: "end"` for ones that should follow the end.
- Full payload schemas: [command catalog](../../command-catalog).
