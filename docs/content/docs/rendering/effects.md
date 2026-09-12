---
title: Effects
weight: 2
---

Add GPU effects per clip with `effect/add`. The stack renders in array order, and exports inherit every effect. Omitted params take defaults; length params are **fractions of composition height**, never pixels, so preview and export look identical.

## Add an effect

```ts
project.dispatch({
  type: "effect/add",
  payload: { clipId: "clip-1", kind: "colorAdjust", effectId: "grade", params: { contrast: 0.2, saturation: 0.25 } },
});
```

## Key out a green screen

```ts
// Defaults key #00ff00 — one line for standard green screens:
project.dispatch({ type: "effect/add", payload: { clipId: "webcam", kind: "chromaKey" } });
```

## Built-in kinds

**`colorAdjust`**

| Param | Range | Default |
| --- | --- | --- |
| `brightness` / `contrast` / `saturation` | -1..1 | 0 |
| `hue` | -180..180 degrees | 0 |

**`blur`**

| Param | Range | Default |
| --- | --- | --- |
| `amount` | 0..0.25 of composition height | 0.02 |

**`chromaKey`**

| Param | Range | Default |
| --- | --- | --- |
| `color` | hex | `#00ff00` |
| `similarity` | 0..1 | 0.4 |
| `smoothness` | 0..1 | 0.1 |
| `spill` | 0..1 | 0.1 |

## Tweak live, toggle, remove

```ts
// Merges onto current params — wire this straight to a slider
// (updates apply in place; no shader recompiles while dragging):
project.dispatch({ type: "effect/update", payload: { clipId: "clip-1", effectId: "grade", params: { saturation: 0.4 } } });

// Toggle without losing settings; remove; or restack:
project.dispatch({ type: "effect/update", payload: { clipId: "clip-1", effectId: "grade", enabled: false } });
project.dispatch({ type: "effect/remove", payload: { clipId: "clip-1", effectId: "grade" } });
project.dispatch({ type: "effect/reorder", payload: { clipId: "clip-1", effectId: "grade", index: 0 } });
```

## Good to know

- Effects apply pre-transform, in sRGB; stack order = array order.
- Custom effect kinds arrive with the public `registerEffect()` API in v4.x.
- Full payload schemas: [command catalog](../../command-catalog).
