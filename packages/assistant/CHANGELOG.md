# @miraiclip/assistant

## 0.1.0

### Minor Changes

- 1adfca3: First release: an AI editing assistant. A vendor-neutral `ChatModel` contract with an OpenAI adapter (`openAIChatModel`: Chat Completions, function calling, streaming; `baseUrl` for OpenAI-compatible servers), `createAssistant` (agent loop on a working copy, one undo step per request, review mode, streamed events, cancel), editing tools (`get_state`, `get_command_schema`, `apply_commands`, `add_transition`, `animate_clip`), `defineTool` / `toolsFromDefinitions`, `createChatHandler` + `remoteChatModel` (keys stay server-side) and `scriptedChatModel` for tests.

### Patch Changes

- Updated dependencies [1adfca3]
  - @miraiclip/core@0.5.5
