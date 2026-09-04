# Changelog

All notable changes to Miraiclip are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added

- `applyJsonPatches` and `fromJsonPointer` exports in `@miraiclip/core`: apply the engine's emitted RFC-6902 patches to a plain document copy — the follower side of the sync story.
- Determinism and collaboration test suite (`test/replay.test.ts`): identical documents from replayed command scripts, leader→follower patch sync, inverse-patch rollback, full undo/redo round-trips, history-limit eviction, frame-boundary splits, JSON Pointer escaping in entity ids (26 tests total).
- Command Catalog reference page in the docs, generated from the actual Zod schemas.
- Changesets release tooling (`pnpm changeset`, `pnpm release`) and npm publish metadata (keywords, homepage, `publishConfig.access: public`) for `@miraiclip/core`.
- CI workflow (`.github/workflows/ci.yaml`): typecheck, tests, and build for all workspace packages on every push and pull request to `main`.

## [0.1.0] — 2026-09-04

First implementation of `@miraiclip/core` (in-repo, not yet published to npm).

### Added

- **Project state**: Zustand (vanilla) store with the composition document under `state.doc` and ephemeral session state (`playheadUs`, `selection`) beside it; selector subscriptions via `project.subscribe`.
- **Command engine**: `dispatch` validates payloads with Zod v4 schemas and applies them via Immer; typed errors (`CommandValidationError`, `CommandRejectedError`, `UnknownCommandError`) guarantee state is untouched on failure.
- **Built-in command catalog** (15 commands): `project/set-settings`; `asset/add`, `asset/remove`; `track/add`, `track/remove`, `track/reorder`, `track/rename`, `track/set-property`; `clip/add`, `clip/remove`, `clip/move`, `clip/trim`, `clip/split`, `clip/duplicate`, `clip/set-property` — with semantic validation (entity existence, track-kind constraints, asset-in-use protection, split-range checks).
- **History**: undo/redo from inverse patches, `canUndo`/`canRedo`/`clearHistory`, configurable history limit; `transaction(fn, label?)` groups dispatches into one atomic history entry with rollback on failure.
- **Patches & events**: every document change emitted as RFC-6902 JSON Patch ops (with inverses and a `source` tag) on a typed emitter — `patches`, `history`, `playhead`, `selection`.
- **AI catalog**: `project.commandCatalog()` exports one JSON Schema per command type (built-in and custom) via Zod's native converter, suitable as LLM tool definitions.
- **Custom commands**: `project.registerCommand({ type, schema, handler })` with full validation/history/patch semantics.
- **Serialization**: `project.toJSON()` round-trips through `createProject`, with `schemaVersion` checking.
- **Timeline utilities**: µs ↔ seconds/frames/timecode conversion, frame snapping, range overlap.
- **Tooling**: pnpm monorepo, tsup build (ESM + CJS + type declarations), Vitest suite (18 tests), strict TypeScript.
- **Docs site** under `docs/`: Hugo + Hextra with landing page, quickstart, core-concepts pages, roadmap, and this changelog.

[Unreleased]: https://github.com/comaniacs/miraiclip/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/comaniacs/miraiclip/releases/tag/v0.1.0
