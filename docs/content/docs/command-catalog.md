---
title: Command Catalog
weight: 7
---

Every built-in command in `@miraiclip/core`, with its payload schema. This page mirrors what `project.commandCatalog()` returns at runtime — one JSON Schema per command type, ready to hand to an LLM as tool definitions (see [AI Integration](../ai-integration) for the ready-made helpers). Custom commands registered with `registerCommand` are included in the runtime catalog automatically.

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
| `fps` | number | no | > 0; 29.97, 23.976, 59.94… are stored as their exact /1001 ratio |
| `frameRate` | `{ num, den }` | no | exact rate, positive integers, e.g. `{ num: 30000, den: 1001 }`; must agree with `fps` if both are given |
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
| `weight` | integer | no | font assets: 100–900, step 100 (default 400) |
| `style` | `"normal"` \| `"italic"` | no | font assets (default `"normal"`) |
| `weightRange` | `[min, max]` | no | variable font assets: the weight axis, e.g. `[100, 900]` |
| `name` | string | no | display name (library title, file name) |
| `source` | `{ provider, id, url? }` | no | where the asset came from: `"upload"`, `"recording"`, or a library/generator id |
| `license` | `{ id, url?, commercial, attributionRequired }` | no | e.g. `{ id: "CC-BY-4.0", commercial: true, attributionRequired: true }` |
| `attribution` | string | no | the credit line to show, when the license asks for one |


## `asset/set-property`

Edit an asset's display name and provenance. `null` clears a field.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | non-empty |
| `name` | string \| null | no |  |
| `source` | object \| null | no | as in `asset/add` |
| `license` | object \| null | no | as in `asset/add` |
| `attribution` | string \| null | no |  |


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
| `hidden` | boolean | no | visual tracks: clips aren't drawn in preview, export or stills (audio follows `muted`); `false` removes the flag |


## `clip/add`

Discriminated on `kind`: `video`/`audio` (assetId, trimStartUs, volume, optional `fadeInUs`/`fadeOutUs`), `image` (assetId), `text` (text, fontFamily, fontSizePx, color, + [typography](#typography)), `caption` (words `[{text, startUs, durationUs}]` clip-relative + style `{preset, fontFamily, fontSizeFrac, color, highlightColor, backgroundColor?}` + [typography](#typography) minus `textAlign`), or a registered custom kind (payload under `props`, validated by its schema). All take `id`, `trackId`, `startUs`, `durationUs`, optional partial `transform`. Asset-backed kinds reject asset-kind mismatches.



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
| `fadeInUs` / `fadeOutUs` | integer \| null | no | video/audio: linear fade length, ≥ 0; `null` clears |
| `text` | string | no |  |
| `fontFamily` | string | no |  |
| `fontSizePx` | number | no | > 0 |
| `color` | string | no |  |
| `fontWeight` `fontStyle` `lineHeight` `letterSpacing` `textAlign` | see [typography](#typography) | no | text clips; `null` clears to default |
| `props` | object | no | custom clip kinds: merged into the clip's props, then re-validated against the kind's schema |
| `unsetProps` | string[] | no | custom clip kinds: props to drop (they fall back to schema defaults) |
| `style` | object | no | caption clips: partial style merge; typography keys accept `null` |

### Typography

Optional on text clips and caption `style`. Absent = default = how clips rendered before these fields existed (`TYPOGRAPHY_DEFAULTS`).

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `fontWeight` | integer | 400 | 100–900, step 100; needs a matching font asset `weight` or the browser synthesizes it |
| `fontStyle` | `"normal"` \| `"italic"` | `"normal"` | same: pair with a font asset `style` |
| `lineHeight` | number | font's natural (captions 1.3) | multiple of font size, > 0, ≤ 5 |
| `letterSpacing` | number | 0 | em (scales with font size), −0.5–2 |
| `textAlign` | `"left"` \| `"center"` \| `"right"` | `"left"` | text clips only; aligns lines within the block, not the anchor |

```ts
project.dispatch({ type: "asset/add", payload: { id: "inter-700", kind: "font", src: "/Inter-Bold.woff2", family: "Inter", weight: 700 } });
project.dispatch({
  type: "clip/add",
  payload: { kind: "text", id: "t1", trackId: "v1", startUs: 0, durationUs: 2_000_000,
    text: "SALE\nToday only", fontFamily: "Inter", fontWeight: 700, lineHeight: 1.1, letterSpacing: 0.04, textAlign: "center" },
});
project.dispatch({ type: "clip/set-property", payload: { clipId: "t1", letterSpacing: null } }); // back to 0
```

## `clip/set-speed`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | a video or audio clip |
| `speed` | number | yes | `0` (freeze frame, video only) or 0.0625–16 |
| `keepDuration` | boolean | no | default false: keep the same footage, so the clip's length changes; true keeps the length |
| `ripple` | boolean | no | shift later clips on the track by the length change (default false) |

## `clip/freeze`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | a video clip |
| `atUs` | integer | yes | inside the clip, or exactly its end (holds the last frame) |
| `durationUs` | integer | yes | > 0: how long the frame holds |
| `freezeClipId` | string | no | id for the freeze-frame clip |
| `rightClipId` | string | no | id for the part after the freeze |
| `ripple` | boolean | no | push later clips on the track back by `durationUs` (default true) |

## `keyframe/set`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `property` | enum | yes | x, y, scale, rotation, opacity, volume |
| `timeUs` | integer | yes | clip-relative, min 0; measured back from the clip's end when `anchor` is "end" |
| `anchor` | enum | no | start (default), end. End-anchored keyframes follow trims of the clip's end; stored with `anchor: "end"`, omitted for start |
| `value` | number | yes | opacity 0..1; scale/volume ≥ 0 |
| `easing` | enum \| object | no | preset (linear, hold, easeIn, easeOut, easeInOut) or `{kind:"bezier", x1,y1,x2,y2}`; default linear. Curve from this keyframe to the next. Upserts at an existing time and anchor. |

## `keyframe/remove`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `property` | enum | yes | as above |
| `timeUs` | integer | yes | must match an existing keyframe exactly |
| `anchor` | enum | no | start (default), end; must match too |

## `keyframe/clear`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `property` | enum | no | omit to clear every property |

## `effect/add`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `kind` | string | yes | any [built-in kind](../rendering/effects#built-in-kinds) (`EFFECT_CATALOG`), or a registered custom kind |
| `params` | object | no | validated against the kind's schema; omitted fields take defaults. Length params are composition-relative fractions, not pixels |
| `enabled` | boolean | no | default true |
| `index` | integer | no | stack insertion index (default: end) |
| `effectId` | string | no | supply for deterministic replay |
| `region` | object | no | limit the effect to part of the clip: `{ x, y, width, height }` as fractions of the clip's frame, plus optional `shape` (`"rect"` \| `"ellipse"`), `feather` (0–1) and `invert` |

## `effect/update`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` | string | yes | non-empty |
| `effectId` | string | yes | non-empty |
| `params` | object | no | merged onto current params, then re-validated whole |
| `enabled` | boolean | no |  |
| `region` | object \| null | no | limit the effect to part of the clip: `{ x, y, width, height }` as fractions of the clip's frame, plus optional `shape` (`"rect"` \| `"ellipse"`), `feather` (0–1) and `invert`; `null` = whole clip again (keyframes are kept on update) |

## `effect/set-region-keyframe`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` / `effectId` | string | yes | the effect must have a `region` |
| `property` | `"x"` \| `"y"` \| `"width"` \| `"height"` | yes | fractions of the clip's frame |
| `timeUs` | integer | yes | clip-relative (see `keyframe/set`) |
| `anchor` | `"start"` \| `"end"` | no |  |
| `value` | number | yes | `width`/`height` > 0 |
| `easing` | preset or bézier | no | default `"linear"` |

## `effect/clear-region-keyframes`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clipId` / `effectId` | string | yes |  |
| `property` | `"x"` \| `"y"` \| `"width"` \| `"height"` | no | omit to clear all |

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

## `marker/add`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | no | generated when omitted |
| `timeUs` | integer | yes | ≥ 0 |
| `label` | string | yes |  |
| `durationUs` | integer | no | > 0: the marker spans a range (a chapter or step) |
| `data` | object | no | free-form JSON |

## `marker/update`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `markerId` | string | yes |  |
| `timeUs` | integer | no |  |
| `label` | string | no |  |
| `durationUs` | integer \| null | no | `null` removes the span |
| `data` | object \| null | no | replaces the payload; `null` removes it |

## `marker/remove`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `markerId` | string | yes |  |

## `plugin/add`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | unique in the document |
| `version` | string | yes |  |
| `url` | string | yes | the plugin's standalone ES module |
| `integrity` | string | no | SRI hash: `sha256-…`, `sha384-…` or `sha512-…` |
| `replace` | boolean | no | replace an entry with the same name (upgrade) |

## `plugin/remove`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes |  |
