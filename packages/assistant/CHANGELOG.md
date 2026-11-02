# @miraiclip/assistant

## 0.5.1

### Patch Changes

- Updated dependencies [5fa8674]
  - @miraiclip/core@0.9.0

## 0.5.0

### Minor Changes

- 9207399: 3D in scripted sequences. `three` is now a registered scripted library: `data-libs="stage three"` gives a sequence a global `THREE` (three.js 0.170 with `RoundedBoxGeometry`, `RoomEnvironment` and `mergeGeometries`), bundled so it renders with no network. Draw the scene inside `tl.frame((t) => …)`; `tl.frame(fn, { motion })` reports how far the picture moves between two times so motion blur can size its samples. A template can ask for slower frames with `data-frame-timeout="<seconds>"` on its root (raises the 10 s per-frame limit, up to 10 minutes; `frameTimeoutMs` is exported). `lintSequence` adds `three-clock` (no `setAnimationLoop`, `THREE.Clock` or `getDelta`). The renderer exports `THREE_SOURCE` and `THREE_VERSION` from `@miraiclip/renderer/stage`.

### Patch Changes

- dedf3d8: Faster, checkable 3D films.
  
  - **ThreeKit**: a new scripted library, `three-kit` (`data-libs="stage three three-kit"`), defines a global `ThreeKit`. It includes constant-pixel-width lines that can be drawn to a moving head, glow sprites, GLSL simplex noise, `ThreeKit.shots` (one camera blended from several shots, on position and look-at point), `ThreeKit.place`, overlay helpers, and `ThreeKit.motionOf` / `ThreeKit.subjectOf` for the checks below. `THREE_KIT_SOURCE` is exported from `@miraiclip/renderer/stage`.
  - **`tl.subject(name, fn, { from, to, minPx })`**: declares a painted subject the shot check keeps in frame. It reports when the subject leaves the frame or shrinks below `minPx`.
  - **`tl.frame(fn, { hold: true })`**: the painter is called with the time at the start of the output frame (`data-fps`, default 30), so motion-blur samples of one frame agree, and type and counters no longer ghost.
  - **`tl.rest`**: also fails when a `tl.frame` motion function reports movement inside the rest (`allow: ["frame"]` exempts it). The shot check warns (`rest-unverified`) when a painter has no motion function.
  - **`miraiclip-export stills <project> --at 1,9.5,15 [--sheet]`**: frames from one warm browser.
  - **`miraiclip-export check <project>`**: the continuous-shot check without the MCP server.
  - **`miraiclip-export doctor`**: browser, ffmpeg and, inside the monorepo, stale generated bundles.
  - **Export flags**: `--workers N` renders parallel chunks; `--motion-blur` turns on the default shutter.
  - **`renderDistributed` takes `motionBlur`**: it applies to every video chunk.

## 0.4.0

### Minor Changes

- e82dd58: Three stage-kit additions for continuous shots. `tl.hop` can now be chained: hopping the same element again starts from where it landed (a hop that would begin before the previous one ends throws, naming the time). `tl.shadow(target, opts)` and `hop({ shadow })` add a contact shadow that follows hops along the ground, thins and widens as the element lifts, and fades with the element's opacity. `tl.focus(target | depth | null, opts)` adds depth of field: elements marked `data-dof` blur by their distance from the focus depth, and a second call racks the focus. `tl.frame(fn)` calls `fn(t)` on every seek so a canvas can be painted as a pure function of time. `lintSequence` knows the new verbs, and the sequence-core skill documents them.

## 0.3.0

### Minor Changes

- 63276db: Skills: playbooks the assistant loads when a request needs one. `createAssistant({ skills })` lists each skill's name and description in the system prompt and adds `load_skill` and `read_skill_file` tools, so the model reads a playbook (and its reference files, in parts when long) only when it uses it. `run(project, request, { skills: ["captions"] })` starts a request with a skill already loaded, e.g. from a button. `MIRAICLIP_SKILLS` bundles the Claude Code plugin's skills in their editor versions (edit-video, captions, talking-head, launch-video, screen-tutorial, reformat, make-template) with their references; unused, it's tree-shaken. `parseSkill`, `skillsFromFiles` (a folder of skill folders, e.g. from `import.meta.glob`) and `defineSkill` load your own.
- 63276db: Tools can return images, and films from a brief have a new skill set.
  
  - `ToolOutput` takes `images` (`ChatImage`: `mimeType` plus base64 `data`), and the assistant sends them to the model with the tool's result:
    - Anthropic gets them inside the `tool_result`.
    - OpenAI and Gemini get them in a message right after the run of tool results.
  - Only the latest two image-bearing results keep their pictures. If a model refuses images (400), the turn continues with text only.
  - `tool-end` events carry the tool's `images`, so apps can show them, for example a storyboard.
  - `MIRAICLIP_SKILLS` splits film-making by job:
    - `direction`: brief to treatment;
    - `look`: palette, type and finish from the subject;
    - `media-sound`: pictures, music first, sound effects;
    - `sequence-core`: the contract for stage-kit sequences;
    - `motion`: the motion-graphics grammar, 32 techniques with working code, and breakdowns of whole films.
  - `make-film` and `launch-video` are recipes on top of these skills: direct, plan the look, approve, music first, build continuous acts, check.
- 1240743: Check a sequence as one continuous shot. The stage kit now reports, for every label, whether something survives into the next beat (carried, anchored or bare), subjects that leave the frame (`data-keep-in-frame="t0,t1[,whole]"`), uneven beat spacing and stray hard cuts. `@miraiclip/server-export` exports `checkShot(doc, options)`, the MCP server gains a `check_sequence` tool, and `editorTools({ checkSequence })` in `@miraiclip/assistant` offers the same tool to a host that can run the check. `MOTION_TARGETS.shot` is a stricter target for a continuous shot, and `motionFindings` takes `{ rests }` so declared rests are not flagged. The skills now allow stillness only inside a declared `tl.rest`. Warnings never block an export. `probeScriptedHtml` in `@miraiclip/renderer` runs the check in the editor's own sandboxed frame, and `@miraiclip/editor` adds `shotWarnings`, `staleShotChecks` and `shotCheckKey` for a badge, timeline markers and re-checking after edits. `check_sequence` can return before/after frames for bare boundaries (`frames: true`).
- 02fa701: Shutter motion blur on export. Pass `motionBlur` (`{}` for the defaults, or `{ shutterAngle, minSamples, maxSamples, gapPx }`) to `exportProject`, `exportProjectInWorker`/`exportViaWorker`, `exportProjectFile` and the MCP `export` tool. Each frame is rendered at several instants inside the open shutter and averaged in linear light on the GPU, in a floating-point texture. The sample count follows how far things travel on screen (keyframes, transitions, the camera, and the elements of a stage sequence), a frame where nothing moves renders once, and a hard cut (a clip edge without a transition, a `tl.cut`) is never blended. Sub-frame times are whole microseconds and mirror around the frame centre. Video footage uses the nearest decoded frame. The kit gains `window.__miraiclipMotion(from, to)`. Where the browser can't render to float textures the export finishes without blur and warns. The continuous-shot skill suggests blur for the final export only.
- ba096e4: Sound and music for a continuous shot. `planSoundFromEvents` (core) plans one sound effect clip at each hit a sequence declared, with one sound per hit kind, and volume keyframes that duck a music clip under the hits. `applyBeatGrid` (core) writes a music beat grid onto a sequence's stage root. The stage kit reads `data-downbeats` (`S.downbeats`, `S.downbeat(n)`) next to `data-beats`, and the shot report lists the sequence's `events`. The MCP server and the assistant gain `place_sfx_from_events` (the assistant's only when the host supplies `checkSequence`) and `set_beat_grid`. The Claude Code plugin's `mc.mjs beats <file>` analyses a music file into beats and downbeats.
- cdd6cf6: A new built-in transition, `zoomThrough`: the camera dives into a region of the outgoing clip (`rect`, as fractions of the frame; `ease`) and arrives in the incoming clip, so a cut reads as one continuous move. It holds the outgoing clip's last frame and the incoming clip's first frame through the window, so it needs no spare footage; `transition/add` and `transition/update` reject it only when it is longer than the shorter clip (`transition-too-long`). `findCuts` reports `maxHoldTransitionUs`, and core exports `transitionHoldsFrames(kind)`. Renderer transitions gain `affine` (scale and translate) in `TransitionFrameEffects` and a `holdsFrames` flag. `add_transition` in `@miraiclip/assistant` accepts `zoomThrough` with `rect` and `ease`, and `checkShot` treats a `zoomThrough` between two sequence clips as the hand-over, so no `act-join` warning.

### Patch Changes

- 63276db: `apply_commands` now rejects an html clip whose markup won't render, before anything is applied: the template is parsed as XML (unclosed `<br>`, a bare `&` or `<`, HTML-only entities like `&nbsp;`, unquoted attributes, mismatched tags) and `asset:<id>` references must name an asset in the project or one added in the same batch. The error says what's wrong and where, so the model fixes it instead of landing a scene that renders blank. `markupProblem` and `assetRefs` are exported.
- 63276db: New bundled skill `make-film`: it makes any film from a brief (a course promo, trailer, documentary, recap, explainer or launch). It first picks the format and style that fit the subject and tone, from the reference styles or a custom one, then builds the film from scenes. `launch-video` and `edit-video` route to it. It uses the image tools (`find_images`, `generate_image`) when the editor has them.
- 888c1eb: The bundled `sequence-core` and `motion` skills document the continuous-shot verbs, the operated camera and the new lint rules, with version 2 snippets for morph, zoom-through, carry-over, whip pan and parallax.
- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
  - @miraiclip/core@0.8.0

## 0.2.0

### Minor Changes

- 7477fe6: AI that works with any model provider, and with the user's own key.
  
  `@miraiclip/assistant`: native `anthropicChatModel` (Messages API, streaming, tool use, extended-thinking replay) and `geminiChatModel` (`generateContent`, streaming, full JSON Schema tools, thought signatures kept for tool calls) next to `openAIChatModel`. `createChatModel({ provider, apiKey, model })` builds any provider in the new `AI_PROVIDERS` catalog: OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, xAI, Together, Ollama, LM Studio and any OpenAI-compatible server. `chatModelsFromEnv(env)` sets up every provider whose `{PROVIDER}_API_KEY` is set (`_MODEL`, `_MODELS`, `_BASE_URL` too; `OPENAI_BASE_URL` keeps its meaning). `routedChatModel(models)` serves several providers as one model, picked per request as "provider/model". Adapters can list the account's models live (`listModels`). Tool calls carry adapter `meta` so provider-specific state survives the agent loop.
  
  Bring your own key: `createChatHandler(model, { userKeys })` accepts the user's provider and key per request (headers `x-ai-provider`, `x-ai-key`), builds a model for that request only and never stores the key; `providers`, `allowBaseUrl` and `required` control what's allowed, and `createChatHandler(null, { userKeys: true })` runs with no server key at all. The handler adds `GET {base}/models`; `remoteChatModel` takes `credentials` and exposes `listModels` and the server's `info`. `openAIChatModel` gains `maxTokensField` and `streamUsage` for compatible servers. The live evals run against any configured provider (`EVAL_PROVIDER`).
  
  `@miraiclip/core`: `toToolDefinitions` takes `style: "gemini"` (function declarations with `parametersJsonSchema`); new `toolDefinition` helper and `ToolStyle` type. `@miraiclip/templates` (`toFieldToolDefinition`) and `@miraiclip/audio-sources` (`audioToolDefinitions`) take `style: "gemini"` too.

### Patch Changes

- Updated dependencies [7477fe6]
  - @miraiclip/core@0.7.0

## 0.1.2

### Patch Changes

- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
  - @miraiclip/core@0.6.0

## 0.1.1

### Patch Changes

- 51b81c7: Fixes from the first live eval run: `apply_commands` rejects fields a command would silently ignore and reports commands that changed nothing; new `add_effect` / `remove_effects` (every catalog kind and its params in the description), `trim_clip` (edge trims, ripple) and `close_gaps` tools; the system prompt's project summary (`describeForAssistant`) includes each clip's transform, text style, volume, effects and animation; clearer guidance for relative edits, "here" / "this", transitions vs animations, and slide directions.
  
  `openAIChatModel` retries rate limits (429) and server errors (5xx), waiting as long as the server asks (`maxRetries`, default 4). New `rateLimitedChatModel(model, { tokensPerMinute, requestsPerMinute })` keeps any model under a per-minute budget. The live eval throttles itself (`EVAL_TPM`, `EVAL_RPM`), reports rate-limit and network failures as "errored" outside the pass rate, and reruns just those with `EVAL_RERUN=errored` (or `failed`).
  
  Fixes from the second live eval run: new `set_keyframes` (timeline seconds; spins, pans, ducking, audio ramps) and `set_effects_enabled` tools; `trim_clip` takes `startSeconds` / `endSeconds`. `apply_commands` rejects tool names used as commands and html params that match no template placeholder, and adds hints to common rejections. `add_transition` explains why two clips have no cut (different tracks, not touching) and refuses a `nearSeconds` more than 1.5 s from any cut. The project summary shows track solo/mute/hidden flags, caption words and style, html params and volume keyframes. Clearer guidance for visual vs audio fades, "the whole video", backgrounds, solo, "again", and failed batches.
  
  New `set_background` tool (solid color behind everything: add, recolor, re-time, remove; `BACKGROUND_TEMPLATE` is exported). Guidance for "replace X with Y" and for fading the whole video (first clip in, last clip out).
  
  From the third live eval run: `set_keyframes` refuses constant values (one point, or all equal) and says to use `clip/set-property` or `keyframe/clear`. `animate_clip` accepts slide edges (`from-right`, `to-left`…) and notes when a video clip's entrance sits on a cut (a transition may be meant). A failed batch lists the commands it didn't apply. The project summary lists the cuts, locked tracks and caption boxes. Stronger guidance for selections, constant vs animated values, cuts, extra footage and caption styling. `openAIChatModel` doesn't retry quota / no-credit errors, and the live eval stops sending cases once the account is out of credits.
  
  From the fourth run: the selection is stated as a scope rule in the system prompt; hand-made keyframes are no longer read as presets (a "stale" loop reading needs enough keyframes to be a loop), are listed in the project summary, and `animate_clip` won't overwrite them without `reset: true`.

## 0.1.0

### Minor Changes

- 1adfca3: First release: an AI editing assistant. A vendor-neutral `ChatModel` contract with an OpenAI adapter (`openAIChatModel`: Chat Completions, function calling, streaming; `baseUrl` for OpenAI-compatible servers), `createAssistant` (agent loop on a working copy, one undo step per request, review mode, streamed events, cancel), editing tools (`get_state`, `get_command_schema`, `apply_commands`, `add_transition`, `animate_clip`), `defineTool` / `toolsFromDefinitions`, `createChatHandler` + `remoteChatModel` (keys stay server-side) and `scriptedChatModel` for tests.

### Patch Changes

- Updated dependencies [1adfca3]
  - @miraiclip/core@0.5.5
