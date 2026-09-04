---
title: Changelog
weight: 6
---

All notable changes to Miraiclip. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/). The canonical file lives at [`CHANGELOG.md`](https://github.com/comaniacs/miraiclip/blob/main/CHANGELOG.md) in the repo.

## Unreleased

### Added

- `applyJsonPatches` and `fromJsonPointer` exports: apply the engine's emitted RFC-6902 patches to a plain document copy — the follower side of the sync story.
- Determinism and collaboration test suite: identical documents from replayed command scripts, leader→follower patch sync, inverse-patch rollback, full undo/redo round-trips, history-limit eviction, frame-boundary splits, JSON Pointer escaping in entity ids (26 tests total).
- [Command Catalog](../command-catalog) reference page, generated from the actual Zod schemas.
- Changesets release tooling (`pnpm changeset`, `pnpm release`) and npm publish metadata for `@miraiclip/core`.
- CI workflow: typecheck, tests, and build for all workspace packages on every push and pull request to `main`.

## 0.1.0 — 2026-09-04

First implementation of `@miraiclip/core` (in-repo, not yet published to npm).

### Added

- **Project state** — Zustand (vanilla) store: composition document under `state.doc`, ephemeral `playheadUs`/`selection` beside it, selector subscriptions.
- **Command engine** — `dispatch` with Zod v4 validation and Immer application; typed errors leave state untouched on failure.
- **15 built-in commands** across `project/`, `asset/`, `track/`, and `clip/` namespaces, with semantic validation (entity existence, track-kind constraints, asset-in-use protection, split-range checks).
- **History** — undo/redo from inverse patches; atomic `transaction(fn, label?)` with rollback on failure; configurable history limit.
- **Patches & events** — every document change emitted as RFC-6902 JSON Patch ops with inverses and a `source` tag; `patches`, `history`, `playhead`, `selection` events.
- **AI catalog** — `commandCatalog()` exports one JSON Schema per command type, suitable as LLM tool definitions.
- **Custom commands** — `registerCommand({ type, schema, handler })` with full validation/history/patch semantics.
- **Serialization** — `toJSON()` round-trips through `createProject`, with `schemaVersion` checking.
- **Timeline utilities** — µs ↔ seconds/frames/timecode, frame snapping, range overlap.
- **Tooling** — pnpm monorepo, tsup build (ESM + CJS + d.ts), Vitest suite (18 tests), strict TypeScript.
- **This docs site** — Hugo + Hextra.
