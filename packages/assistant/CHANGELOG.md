# @miraiclip/assistant

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
