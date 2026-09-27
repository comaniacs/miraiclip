# @miraiclip/core

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
