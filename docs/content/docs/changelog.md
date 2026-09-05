---
title: Changelog
weight: 6
---

All notable changes to Miraiclip. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/). The canonical file lives at [`CHANGELOG.md`](https://github.com/comaniacs/miraiclip/blob/main/CHANGELOG.md) in the repo.

## Unreleased

### Changed

- Package homepage now points at this documentation site; docs linked from the package and repo READMEs; "not yet published" notes removed after the 0.1.0 npm release.

## 0.1.0 — 2026-09-05

First release of `@miraiclip/core`.

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
- **Sync utilities** — `applyJsonPatches` and `fromJsonPointer`: apply emitted RFC-6902 patches to a plain document copy, the follower side of collaboration.
- **Determinism & collaboration tests** — replayed command scripts converge, leader→follower patch sync, inverse-patch rollback, undo/redo round-trips, history-limit eviction, frame-boundary splits, JSON Pointer escaping (26 tests).
- **Tooling** — pnpm monorepo, tsup build (ESM + CJS + d.ts, verified exports), Vitest, strict TypeScript, CI, Changesets.
- **This docs site** — Hugo + Hextra, including the [Command Catalog](../command-catalog) reference generated from the actual schemas.
