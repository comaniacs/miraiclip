# @miraiclip/mcp

## 0.1.2

### Patch Changes

- Updated dependencies [399ef67]
  - @miraiclip/server-export@0.4.0

## 0.1.1

### Patch Changes

- Updated dependencies [a27c4ef]
- Updated dependencies [a27c4ef]
  - @miraiclip/core@0.4.0
  - @miraiclip/server-export@0.3.1

## 0.1.0

### Minor Changes

- fc2827e: New package: an MCP server that lets Claude, Codex, or any MCP client edit a Miraiclip project over stdio — validating `dispatch` with machine-readable failures, transactional `apply_commands`, undo/redo, `preview_frame` (the agent sees the actual pixels, rendered through the export pipeline), and `export` to file. `npx @miraiclip/mcp --project ./video.miraiclip.json`; every successful edit autosaves atomically.

### Patch Changes

- Updated dependencies [fc2827e]
  - @miraiclip/server-export@0.3.0
