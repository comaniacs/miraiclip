---
title: Command Catalog
weight: 6
---

Every built-in command in `@miraiclip/core`, with its payload schema. This page mirrors what `project.commandCatalog()` returns at runtime — one JSON Schema per command type, ready to hand to an LLM as tool definitions. Custom commands registered with `registerCommand` are included in the runtime catalog automatically.

Dispatch shape:

```ts
project.dispatch({ type: "<command type>", payload: { ... } });
```

All time values are integer microseconds (1 s = 1,000,000 µs). Commands with a `newClipId` field generate an id when it's omitted — supply one for deterministic replay across peers.

## `project/set-settings`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `width` | integer | no | > 0, integer |
| `height` | integer | no | > 0, integer |
| `fps` | number | no | > 0 |
| `name` | string | no |  |


## `asset/add`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | non-empty |
| `kind` | `"video"` \| `"audio"` \| `"image"` \| `"font"` | yes | font assets require `family` |
| `src` | string | yes | non-empty |
| `durationUs` | integer | no | > 0, integer |
| `width` | integer | no | > 0, integer |
| `height` | integer | no | > 0, integer |
| `fps` | number | no | > 0 |
| `family` | string | no | font assets: the CSS font-family name |


## `asset/remove`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | non-empty |


## `track/add`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | non-empty |
| `kind` | `"video"` \| `"audio"` | yes |  |
| `name` | string | no |  |
| `index` | integer | no | min 0, integer |


## `track/remove`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | non-empty |


## `track/reorder`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `trackId` | string | yes | non-empty |
| `index` | integer | yes | min 0, integer |


## `track/rename`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `trackId` | string | yes | non-empty |
| `name` | string | yes | non-empty |


## `track/set-property`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `trackId` | string | yes | non-empty |
| `muted` | boolean | no |  |
| `solo` | boolean | no |  |
| `locked` | boolean | no |  |


## `clip/add`

Discriminated on `kind`: `video`/`audio` (assetId, trimStartUs, volume), `image` (assetId), `text` (text, fontFamily, fontSizePx, color), `caption` (words `[{text, startUs, durationUs}]` clip-relative + style `{preset, fontFamily, fontSizeFrac, color, highlightColor, backgroundColor?}`), or a registered custom kind (payload under `props`, validated by its schema). All take `id`, `trackId`, `startUs`, `durationUs`, optional partial `transform`. Asset-backed kinds reject asset-kind mismatches.



## `clip/remove`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |


## `clip/move`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `startUs` | integer | no | min 0, integer |
| `trackId` | string | no | non-empty |


## `clip/trim`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `startUs` | integer | no | min 0, integer |
| `durationUs` | integer | no | > 0, integer |
| `trimStartUs` | integer | no | min 0, integer |


## `clip/split`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `atUs` | integer | yes | > 0, integer |
| `newClipId` | string | no | non-empty |


## `clip/duplicate`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `newClipId` | string | no | non-empty |
| `startUs` | integer | no | min 0, integer |
| `trackId` | string | no | non-empty |


## `clip/set-property`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `transform` | object | no |  |
| `volume` | number | no | min 0 |
| `text` | string | no |  |
| `fontFamily` | string | no |  |
| `fontSizePx` | number | no | > 0 |
| `color` | string | no |  |
| `style` | object | no | caption clips: partial style merge |

## `keyframe/set`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `property` | enum | yes | x, y, scale, rotation, opacity, volume |
| `timeUs` | integer | yes | clip-relative, min 0 |
| `value` | number | yes | opacity 0..1; scale/volume ≥ 0 |
| `easing` | enum \| object | no | preset (linear, hold, easeIn, easeOut, easeInOut) or `{kind:"bezier", x1,y1,x2,y2}`; default linear. Curve from this keyframe to the next. Upserts at an existing time. |

## `keyframe/remove`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `property` | enum | yes | as above |
| `timeUs` | integer | yes | must match an existing keyframe exactly |

## `keyframe/clear`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `property` | enum | no | omit to clear every property |

## `effect/add`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `kind` | string | yes | colorAdjust, blur, chromaKey, or a registered custom kind |
| `params` | object | no | validated against the kind's schema; omitted fields take defaults. Length params are composition-relative fractions, not pixels |
| `enabled` | boolean | no | default true |
| `index` | integer | no | stack insertion index (default: end) |
| `effectId` | string | no | supply for deterministic replay |

## `effect/update`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `effectId` | string | yes | non-empty |
| `params` | object | no | merged onto current params, then re-validated whole |
| `enabled` | boolean | no |  |

## `effect/remove`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `effectId` | string | yes | non-empty |

## `effect/reorder`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `effectId` | string | yes | non-empty |
| `index` | integer | yes | new stack position |

## `transition/add`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | string | yes | crossDissolve, dipToBlack, dipToWhite, wipe, slide, or custom |
| `fromClipId` | string | yes | the clip ending at the cut |
| `toClipId` | string | yes | must start exactly where fromClip ends, same track |
| `durationUs` | integer | yes | > 0; centered on the cut — each side needs half the window of source trim headroom |
| `params` | object | no | e.g. `{direction}` for wipe/slide |
| `id` | string | no | supply for deterministic replay |

Rejections: `not-adjacent`, `different-tracks`, `duplicate-boundary` (one transition per cut), `insufficient-handles` (a clip has no source media past its visible range). Editing or removing a participating clip drops the transition.

## `transition/update`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `transitionId` | string | yes | non-empty |
| `durationUs` | integer | no | re-validates headroom |
| `params` | object | no | merged, then re-validated whole |

## `transition/remove`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `transitionId` | string | yes | non-empty |
