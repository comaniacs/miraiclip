# @miraiclip/core

## 0.10.0

### Minor Changes

- 9ac0cee: Crop for video and image clips. `VideoClip` and `ImageClip` take an optional `crop` (`{ x, y, width, height }`, fractions of the source from its top-left, staying inside the picture), set with `clip/add` or `clip/set-property` (`null` clears it; `crop` on any other clip kind is rejected with `not-media`). A whole-picture crop is not stored, so documents that never crop are unchanged. The preview and the worker/server exports draw only the cropped part, and for video it is the cropped part that is fitted to the frame. Everything else (transform, effects, animation) applies to the cropped clip.

## 0.9.0

### Minor Changes

- 5fa8674: Stretch and flip. A clip's `transform` takes optional `scaleX` and `scaleY` (default 1, multiplied with `scale`; negative mirrors the content, 0 is rejected; not animatable). They are set with `clip/add` / `clip/set-property` like the other transform fields, and documents that never use them are unchanged: a value of 1 is not stored. The preview, worker export and server export draw them the same way, `getClipBounds` / `hitTest` follow them (`ClipBounds` and `Placement` gain optional `scaleX` / `scaleY`), and `EvaluatedClip` carries them. `@miraiclip/editor` adds the `stretch-x` and `stretch-y` modes to `beginTransformDrag` for side handles: the pointer's distance along the clip's own axis scales only that axis (pivoting at the origin like `scale`), never flips through the origin, keeps a mirrored clip mirrored, and is one undo step.

## 0.8.0

### Minor Changes

- ba096e4: Sound and music for a continuous shot. `planSoundFromEvents` (core) plans one sound effect clip at each hit a sequence declared, with one sound per hit kind, and volume keyframes that duck a music clip under the hits. `applyBeatGrid` (core) writes a music beat grid onto a sequence's stage root. The stage kit reads `data-downbeats` (`S.downbeats`, `S.downbeat(n)`) next to `data-beats`, and the shot report lists the sequence's `events`. The MCP server and the assistant gain `place_sfx_from_events` (the assistant's only when the host supplies `checkSequence`) and `set_beat_grid`. The Claude Code plugin's `mc.mjs beats <file>` analyses a music file into beats and downbeats.
- cdd6cf6: A new built-in transition, `zoomThrough`: the camera dives into a region of the outgoing clip (`rect`, as fractions of the frame; `ease`) and arrives in the incoming clip, so a cut reads as one continuous move. It holds the outgoing clip's last frame and the incoming clip's first frame through the window, so it needs no spare footage; `transition/add` and `transition/update` reject it only when it is longer than the shorter clip (`transition-too-long`). `findCuts` reports `maxHoldTransitionUs`, and core exports `transitionHoldsFrames(kind)`. Renderer transitions gain `affine` (scale and translate) in `TransitionFrameEffects` and a `holdsFrames` flag. `add_transition` in `@miraiclip/assistant` accepts `zoomThrough` with `rect` and `ease`, and `checkShot` treats a `zoomThrough` between two sequence clips as the hand-over, so no `act-join` warning.

## 0.7.0

### Minor Changes

- 7477fe6: AI that works with any model provider, and with the user's own key.
  
  `@miraiclip/assistant`: native `anthropicChatModel` (Messages API, streaming, tool use, extended-thinking replay) and `geminiChatModel` (`generateContent`, streaming, full JSON Schema tools, thought signatures kept for tool calls) next to `openAIChatModel`. `createChatModel({ provider, apiKey, model })` builds any provider in the new `AI_PROVIDERS` catalog: OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, xAI, Together, Ollama, LM Studio and any OpenAI-compatible server. `chatModelsFromEnv(env)` sets up every provider whose `{PROVIDER}_API_KEY` is set (`_MODEL`, `_MODELS`, `_BASE_URL` too; `OPENAI_BASE_URL` keeps its meaning). `routedChatModel(models)` serves several providers as one model, picked per request as "provider/model". Adapters can list the account's models live (`listModels`). Tool calls carry adapter `meta` so provider-specific state survives the agent loop.
  
  Bring your own key: `createChatHandler(model, { userKeys })` accepts the user's provider and key per request (headers `x-ai-provider`, `x-ai-key`), builds a model for that request only and never stores the key; `providers`, `allowBaseUrl` and `required` control what's allowed, and `createChatHandler(null, { userKeys: true })` runs with no server key at all. The handler adds `GET {base}/models`; `remoteChatModel` takes `credentials` and exposes `listModels` and the server's `info`. `openAIChatModel` gains `maxTokensField` and `streamUsage` for compatible servers. The live evals run against any configured provider (`EVAL_PROVIDER`).
  
  `@miraiclip/core`: `toToolDefinitions` takes `style: "gemini"` (function declarations with `parametersJsonSchema`); new `toolDefinition` helper and `ToolStyle` type. `@miraiclip/templates` (`toFieldToolDefinition`) and `@miraiclip/audio-sources` (`audioToolDefinitions`) take `style: "gemini"` too.

## 0.6.0

### Minor Changes

- fd07ee1: Clip speed and freeze frames, timeline markers, effect regions, gestures, custom-kind props editing and idempotent kind registration.
- fd07ee1: Self-describing plugins (`doc.plugins`): custom kinds load and render in the browser, worker export, server export and MCP.
- fd07ee1: Scripted html clips (`scripted: true`): GSAP, Lottie, anime.js and Web Animations templates seeked frame-exactly in every renderer.

## 0.5.8

### Patch Changes

- 24f64e4: Exact frame rates and a frame mapping that round-trips. `ProjectSettings.frameRate` stores the rate as a ratio (`{ num: 30000, den: 1001 }` for 29.97); `createProject` and `project/set-settings` store decimal NTSC rates exactly and keep `fps` in sync, and `project/set-settings` takes `frameRate`. `frameToUs` now returns the first whole µs inside the frame (⌈n·1e6·den/num⌉) and `usToFrame` floors, in exact integer math, so `usToFrame(frameToUs(n)) === n` for every frame (before, a third of frames at 30 / 29.97 fps mapped back one early). New: `toFrameRate`, `projectFrameRate`, `formatFrameRate`, `frameCount`, and `usToTimecode(us, rate, { dropFrame: true })`.

## 0.5.7

### Patch Changes

- f7fc1da: `clip/set-property` edits an html clip's code: `template` replaces the markup, `unsetParams` drops params the new markup no longer uses, and `widthPx` / `heightPx` change the raster size (`null` clears back to the composition size). The clip keeps its id, keyframes, effects and transitions.

## 0.5.6

### Patch Changes

- af16150: Html clips take `animated: true` (on `clip/add` and `clip/set-property`) to re-rasterize every frame so CSS animations inside the template play and export frame-exactly; `clip/split` sets `animationOffsetUs` on the right half so the animation continues across the cut.

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
