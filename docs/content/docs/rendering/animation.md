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

## Edit and remove

```ts
// Setting a keyframe at an existing time updates it in place:
project.dispatch({ type: "keyframe/set", payload: { clipId: "clip-1", property: "opacity", timeUs: 0, value: 0.5 } });

// Remove one (timeUs must match exactly), or clear a property — or everything:
project.dispatch({ type: "keyframe/remove", payload: { clipId: "clip-1", property: "opacity", timeUs: 0 } });
project.dispatch({ type: "keyframe/clear", payload: { clipId: "clip-1", property: "opacity" } });
project.dispatch({ type: "keyframe/clear", payload: { clipId: "clip-1" } });
```

## Good to know

- Keyframes anchor to the clip's visible start; trimming the clip keeps them.
- Full payload schemas: [command catalog](../../command-catalog).
