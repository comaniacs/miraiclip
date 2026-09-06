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
| `kind` | `"video"` \| `"audio"` \| `"image"` | yes |  |
| `src` | string | yes | non-empty |
| `durationUs` | integer | no | > 0, integer |
| `width` | integer | no | > 0, integer |
| `height` | integer | no | > 0, integer |
| `fps` | number | no | > 0 |


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

| Field | Type | Required | Notes |
| --- | --- | --- | --- |


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


