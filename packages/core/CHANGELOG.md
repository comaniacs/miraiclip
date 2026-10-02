# @miraiclip/core

## 0.5.5

### Patch Changes

- 1adfca3: Animation presets and cuts as shared logic: `ANIMATION_PRESETS` (in / loop / out), `animationCommands(clip, recipe)`, `readAnimation`, `describeAnimation`, `fitAnimation`, and `findCuts(doc)` / `clipHeadroomUs` for where transitions fit and how long they can be.

## 0.5.4

### Patch Changes

- 2ca45f2: End-anchored keyframes: `keyframe/set` and `keyframe/remove` accept `anchor: "end"`, measuring `timeUs` back from the clip's visible end so exit animations follow trims. Adds `resolveKeyframes` and `keyframeTimeUs`; `evaluateKeyframes` takes an optional clip duration (`evaluateClipAt`/`evaluateClipInto` pass it). `clip/split` keeps end-anchored keyframes on the right half only. `describeProject` marks properties with end-anchored keyframes.
- 2ca45f2: Tracks can be hidden: `track/set-property { hidden }` sets an optional `Track.hidden` (`false` removes it, so documents stay minimal). `describeProject` now lists track flags (muted, solo, locked, hidden).

## 0.5.3

### Patch Changes

- f72deb3: Audio groundwork. Assets accept optional `name`, `source` (`{ provider, id, url? }`), `license` (`{ id, url?, commercial, attributionRequired }`) and `attribution`, editable with the new `asset/set-property` command (`null` clears). Video and audio clips accept `fadeInUs` / `fadeOutUs` (on `clip/add` and `clip/set-property`); `clip/split` keeps the fade-in on the left half and the fade-out on the right. New pure helpers `usedAssets`, `creditsFor` and `licenseReport`. `describeProject` shows asset names, licenses, clip volume and fades.

## 0.5.2

### Patch Changes

- 16901eb: Caption styles grow optional decorations: `display: "word"` (word-by-word), `textTransform`, outline (`strokeColor`, `strokeWidthFrac`), drop shadow / glow (`shadowColor`, `shadowBlurFrac`, `shadowOffsetFrac`) and `activeBackgroundColor` (a box behind each emphasized word), plus a `reveal` preset (words appear as spoken). All optional, so existing documents are unchanged; `clip/set-property` clears any of them (and `backgroundColor`) with `null`. Caption `words` can now be replaced with `clip/set-property`. New pure helpers `captionsToSrt`, `captionsToVtt`, `captionsToText` and `retimeWords`. Font assets accept `weightRange` for variable fonts.

## 0.5.1

### Patch Changes

- 6e75056: Effect library: 76 new built-in effect kinds (79 with colorAdjust, blur, chromaKey) across seven categories — color, film, stylize, glitch & retro, blur & light, distort, frame & key. `EFFECT_CATALOG` is the single source of truth: each entry's param schema is derived from it (so `effect/add` validates and fills defaults), the `effect/add` AI tool description lists every kind, and editors read labels, categories, ranges, steps and display formats from it (`EFFECT_CATEGORIES`, `getEffectInfo`, `defaultEffectParams`). Length params are fractions of composition height. Existing documents are unchanged.

## 0.5.0

### Minor Changes

- 880ad42: Typography for text and caption clips. Text clips take optional `fontWeight` (100–900, steps of 100), `fontStyle` (`"normal"` | `"italic"`), `lineHeight` (multiple of font size), `letterSpacing` (em, so it scales with font size), and `textAlign` (`"left"` | `"center"` | `"right"`, lines within the block — independent of the anchor); caption `style` takes the same minus `textAlign` (caption lines stay centered). Font assets take `weight` and `style` descriptors — add one asset per face. `clip/add` and `clip/set-property` accept every field; in `set-property`, `null` clears a field back to its default. All fields are optional with no schema defaults, so existing documents load, render, and serialize unchanged; `TYPOGRAPHY_DEFAULTS` exports what an absent field means. `describeProject` lists typography only where it was set.

## 0.4.0

### Minor Changes

- a27c4ef: New built-in `html` clip kind: `clip/add { kind: "html", template, params?, widthPx?, heightPx? }` — HTML/CSS overlays with `{{param}}` substitution (values HTML-escaped), sized in composition pixels, first-class in the schema/catalog so they serialize and cross process boundaries. `clip/set-property { params }` merges params.

## 0.3.0

### Minor Changes

- 34a0d60: AI command interface: `toToolDefinitions` (command catalog as Anthropic/OpenAI tool definitions, per-command or single-dispatch mode), `tryDispatch`/`applyCommands` (machine-readable command failures an agent can self-correct from; batches apply as one all-or-nothing transaction), and `describeProject` (compact deterministic state summary for prompts). Zero new dependencies.

## 0.2.0

### Minor Changes

- 260cf57: v4 creative-features model: per-property keyframe animation with cubic-bezier easings and a pure, alloc-free evaluator (`evaluateClipAt`/`evaluateClipInto`); per-clip effect stacks (`effect/add|update|remove|reorder`) with built-in Zod param schemas (colorAdjust, blur, chromaKey); transitions on the adjacent-clips + trim-handles model (`transition/add|update|remove` with adjacency and source-headroom validation; crossDissolve, dipToBlack, dipToWhite, wipe, slide); the `caption` clip kind with word-level timing and style presets; font assets (`kind: "font"`); SRT/VTT and ASR word-timestamp caption import producing plain commands; `registerClipKind`/`registerEffectKind`/`registerTransitionKind` extension seams and exported clip type guards. Existing documents hydrate unchanged (schemaVersion stays 1).

## 0.1.1

### Patch Changes

- e4c8d9d: Point the package homepage at the documentation site (https://comaniacs.github.io/miraiclip/) and link the docs from the README.
