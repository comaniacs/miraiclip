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

## Effect library

79 built-in kinds across seven categories. Every one validates in core, renders in preview, browser and **worker** export, server export and stills, and is listed in the AI command catalog.

```ts
// Any kind, defaults filled in:
project.dispatch({ type: "effect/add", payload: { clipId: "clip-1", kind: "vignette" } });
// Stack them — array order is render order:
project.dispatch({ type: "effect/add", payload: { clipId: "clip-1", kind: "tealOrange", params: { intensity: 0.7 } } });
project.dispatch({ type: "effect/add", payload: { clipId: "clip-1", kind: "glitch", params: { intensity: 0.4, seed: 12 } } });
```

## Build an effect picker

`EFFECT_CATALOG` (core) is plain data — label, category, and per-param type, range, step, default and display format — so a property panel needs no hard-coded effect list. `renderEffectThumbnails` (renderer) previews each kind's real filter.

```ts
import { EFFECT_CATALOG, EFFECT_CATEGORIES, defaultEffectParams, getEffectInfo } from "@miraiclip/core";
import { renderEffectThumbnails } from "@miraiclip/renderer";

const byCategory = EFFECT_CATEGORIES.map((c) => ({ ...c, kinds: EFFECT_CATALOG.filter((e) => e.category === c.id) }));

// Real previews on an OFFSCREEN renderer (never pass your preview canvas):
await renderEffectThumbnails({
  size: 144,
  onThumbnail: (kind, dataUrl) => tiles.get(kind)!.style.backgroundImage = `url(${dataUrl})`,
});

// Sliders straight from the catalog:
for (const p of getEffectInfo("tiltShift")!.params) {
  if (p.type === "number") slider(p.label, { min: p.min, max: p.max, step: p.step, value: p.default });
  else colorPicker(p.label, p.default);
}
```

| `EffectParamInfo` field | Meaning |
| --- | --- |
| `type` | `"number"` or `"color"` (`#rrggbb`) |
| `min` / `max` / `step` / `default` | slider range — the kind's schema enforces `min`/`max` |
| `format` | display hint: `percent`, `int`, `deg`, `stops`, `decimal` |
| `length` | `true` = fraction of composition height |

| `renderEffectThumbnails` option | Default |
| --- | --- |
| `kinds` | every catalog kind (custom kinds work too) |
| `size` | 144 |
| `sample` | built-in sample scene; pass any `CanvasImageSource` |
| `lengthScale` | 3 — magnifies length params so dots/blurs read at thumbnail size |
| `type` / `quality` | `"image/jpeg"` / 0.85 |
| `onThumbnail(kind, dataUrl)` / `signal` | progressive fill / cancel |

## Built-in kinds

**Color**

| Kind | Params (range = default) |
| --- | --- |
| `colorAdjust` — Color Adjust | `brightness` -1..1 = 0<br>`contrast` -1..1 = 0<br>`saturation` -1..1 = 0<br>`hue` -180..180 = 0° |
| `mono` — Black & White | `intensity` 0..1 = 1 |
| `invert` — Invert | `intensity` 0..1 = 1 |
| `warm` — Warm | `intensity` 0..1 = 1 |
| `cool` — Cool | `intensity` 0..1 = 1 |
| `hueShift` — Hue Shift | `hue` -180..180 = 90° |
| `vibrance` — Vibrance | `amount` 0..1 = 0.5 |
| `exposure` — Exposure | `stops` -2..2 = 0.5 |
| `contrastCurve` — Contrast Curve | `intensity` 0..1 = 0.7 |
| `gamma` — Gamma | `gamma` 0.3..3 = 1.4 |
| `channelSwap` — Channel Swap | `intensity` 0..1 = 1 |
| `duotone` — Duotone | `intensity` 0..1 = 1<br>`shadow` #1e1b4b<br>`highlight` #f472b6 |
| `gradientMap` — Gradient Map | `intensity` 0..1 = 1<br>`dark` #0f172a<br>`mid` #e11d48<br>`light` #fde68a |
| `colorPop` — Color Pop | `intensity` 0..1 = 1<br>`color` #ef4444<br>`tolerance` 0.01..0.5 = 0.08 |
| `solarize` — Solarize | `intensity` 0..1 = 1<br>`threshold` 0..1 = 0.5 |
| `threshold` — Threshold | `threshold` 0..1 = 0.5 |
| `posterize` — Posterize | `levels` 2..12 = 4 |

**Film**

| Kind | Params (range = default) |
| --- | --- |
| `sepia` — Sepia | `intensity` 0..1 = 1 |
| `vintage` — Vintage | `intensity` 0..1 = 0.8 |
| `polaroid` — Polaroid | `intensity` 0..1 = 1 |
| `kodachrome` — Kodachrome | `intensity` 0..1 = 1 |
| `technicolor` — Technicolor | `intensity` 0..1 = 1 |
| `thermal` — Thermal | `intensity` 0..1 = 1 |
| `grain` — Film Grain | `intensity` 0..1 = 0.3 |
| `tealOrange` — Teal & Orange | `intensity` 0..1 = 1 |
| `noir` — Noir | `intensity` 0..1 = 1 |
| `bleachBypass` — Bleach Bypass | `intensity` 0..1 = 1 |
| `crossProcess` — Cross Process | `intensity` 0..1 = 1 |
| `faded` — Faded | `intensity` 0..1 = 1 |
| `matte` — Matte | `intensity` 0..1 = 1 |
| `goldenHour` — Golden Hour | `intensity` 0..1 = 1 |
| `moonlight` — Moonlight | `intensity` 0..1 = 1 |
| `cyberpunk` — Cyberpunk | `intensity` 0..1 = 1 |
| `vaporwave` — Vaporwave | `intensity` 0..1 = 1 |
| `cyanotype` — Cyanotype | `intensity` 0..1 = 1 |
| `infrared` — Infrared | `intensity` 0..1 = 1 |
| `lomo` — Lomo | `intensity` 0..1 = 1 |
| `nightVision` — Night Vision | `intensity` 0..1 = 1 |

**Stylize**

| Kind | Params (range = default) |
| --- | --- |
| `pixelate` — Pixelate | `size` 0.0023..0.0338 = 0.0113 (of height) |
| `halftone` — Halftone | `size` 0.0023..0.0281 = 0.0068 (of height) |
| `dotMatrix` — LED Matrix | `size` 0.0023..0.0281 = 0.0068 (of height) |
| `crosshatch` — Crosshatch | `spacing` 0.0011..0.0113 = 0.0034 (of height) |
| `neonEdges` — Neon Edges | `intensity` 0..1 = 1<br>`color` #22d3ee |
| `sketch` — Pencil Sketch | `intensity` 0..1 = 1 |
| `emboss` — Emboss | `intensity` 0..1 = 1 |
| `sharpen` — Sharpen | `amount` 0..2 = 0.8 |
| `toon` — Cartoon | `intensity` 0..1 = 1 |
| `oilPaint` — Oil Paint | `brush` 0.0003..0.0034 = 0.0008 (of height) |
| `hexPixelate` — Hex Mosaic | `size` 0.0023..0.0338 = 0.0101 (of height) |
| `retro8bit` — 8-Bit | `size` 0.0017..0.0225 = 0.0068 (of height) |
| `dither` — Dither | `intensity` 0..1 = 1<br>`levels` 2..8 = 3<br>`scale` 0.0003..0.0034 = 0.0008 (of height) |
| `frostedGlass` — Frosted Glass | `amount` 0.0006..0.0113 = 0.0034 (of height) |

**Glitch & Retro**

| Kind | Params (range = default) |
| --- | --- |
| `rgbSplit` — RGB Split | `amount` 0..0.0169 = 0.0045 (of height) |
| `scanlines` — Scanlines | `intensity` 0..1 = 0.5<br>`spacing` 0.0011..0.0113 = 0.0023 (of height) |
| `crt` — CRT | `curve` 0..1 = 0.5 |
| `vhs` — VHS | `intensity` 0..1 = 0.6<br>`seed` 0..100 = 7 |
| `glitch` — Glitch | `intensity` 0..1 = 0.5<br>`seed` 0..100 = 7 |
| `tvStatic` — TV Static | `intensity` 0..1 = 0.35<br>`seed` 0..100 = 7 |
| `lensFringe` — Lens Fringe | `amount` 0..0.05 = 0.008 |

**Blur & Light**

| Kind | Params (range = default) |
| --- | --- |
| `blur` — Blur | `amount` 0..0.25 = 0.02 (of height) |
| `vignette` — Vignette | `intensity` 0..1 = 0.6<br>`size` 0..1 = 0.5 |
| `glow` — Glow | `intensity` 0..1 = 0.6<br>`radius` 0.0011..0.0225 = 0.0068 (of height)<br>`threshold` 0..1 = 0.55 |
| `dreamy` — Dreamy | `intensity` 0..1 = 0.6<br>`radius` 0.0011..0.0225 = 0.0068 (of height) |
| `tiltShift` — Tilt Shift | `blur` 0.0011..0.0169 = 0.0056 (of height)<br>`focus` 0..1 = 0.5<br>`band` 0..1 = 0.25 |
| `zoomBlur` — Zoom Blur | `amount` 0..0.3 = 0.08 |
| `motionBlur` — Motion Blur | `distance` 0..0.045 = 0.0113 (of height)<br>`angle` -180..180 = 0° |
| `colorVignette` — Color Vignette | `intensity` 0..1 = 0.8<br>`color` #7c3aed<br>`size` 0..1 = 0.5 |
| `lightLeak` — Light Leak | `intensity` 0..1 = 0.8<br>`color` #ff7a18 |

**Distort**

| Kind | Params (range = default) |
| --- | --- |
| `fisheye` — Fisheye | `strength` 0..1.5 = 0.6 |
| `pinch` — Pinch | `strength` 0..1.5 = 0.6 |
| `swirl` — Swirl | `angle` -720..720 = 180°<br>`radius` 0.05..1 = 0.5 |
| `wave` — Wave | `amplitude` 0..0.05 = 0.015<br>`frequency` 1..30 = 8 |
| `ripple` — Ripple | `amplitude` 0..0.03 = 0.01<br>`frequency` 2..60 = 20 |
| `mirrorX` — Mirror ↔ | — |
| `mirrorY` — Mirror ↕ | — |
| `kaleidoscope` — Kaleidoscope | `segments` 2..16 = 6<br>`rotation` -180..180 = 0° |

**Frame & Key**

| Kind | Params (range = default) |
| --- | --- |
| `chromaKey` — Green Screen | `color` #00ff00<br>`similarity` 0..1 = 0.4<br>`smoothness` 0..1 = 0.1<br>`spill` 0..1 = 0.1 |
| `letterbox` — Letterbox | `size` 0..0.3 = 0.12 |
| `roundedCorners` — Rounded Corners | `radius` 0..0.5 = 0.08 |

Effects take no time input, so noise-style looks (`vhs`, `glitch`, `tvStatic`) are static per `seed`.

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

## Custom effect kinds

Register your own kind — schema in core, filter in the renderer: [Custom Effects & Transitions](../extensibility). Custom renderers are functions, so they draw in preview, browser export and stills, but not in worker or server export — prefer a built-in when one fits.

## Good to know

- Effects apply pre-transform, in sRGB; stack order = array order.
- Full payload schemas: [command catalog](../../command-catalog).
- Bring your own kinds: [Custom Effects & Transitions](../extensibility).
